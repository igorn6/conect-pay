import type { PaymentRequest, StageHistoryItem } from "@/types/database";

/**
 * Calcula a duração em segundos úteis (Horário Comercial: Segunda a Sexta, das 08h às 18h no fuso de Brasília UTC-3).
 * Qualquer tempo fora deste intervalo (finais de semana ou antes das 08h / após as 18h) é pausado e desconsiderado.
 */
export function calculateBusinessHoursDuration(
  startDateInput: Date | string | number | null | undefined,
  endDateInput: Date | string | number | null | undefined
): number {
  if (!startDateInput || !endDateInput) return 0;
  const start = new Date(startDateInput).getTime();
  const end = new Date(endDateInput).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 0;

  // Fuso horário padrão de Brasília = UTC-3
  const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

  let totalSeconds = 0;

  // Ajusta timestamps para a régua civil de Brasília
  const startBrtMs = start + BRT_OFFSET_MS;
  const endBrtMs = end + BRT_OFFSET_MS;

  const startDateBrt = new Date(startBrtMs);
  const currentDayBrt = new Date(
    Date.UTC(startDateBrt.getUTCFullYear(), startDateBrt.getUTCMonth(), startDateBrt.getUTCDate())
  );

  while (currentDayBrt.getTime() <= endBrtMs) {
    const dayOfWeek = currentDayBrt.getUTCDay(); // 0 = Domingo, 6 = Sábado

    // Segunda a Sexta-feira (1 a 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Janela útil: 08:00 às 18:00 BRT
      const workStartMs = currentDayBrt.getTime() + 8 * 3600 * 1000 - BRT_OFFSET_MS;
      const workEndMs = currentDayBrt.getTime() + 18 * 3600 * 1000 - BRT_OFFSET_MS;

      const overlapStart = Math.max(start, workStartMs);
      const overlapEnd = Math.min(end, workEndMs);

      if (overlapEnd > overlapStart) {
        totalSeconds += Math.round((overlapEnd - overlapStart) / 1000);
      }
    }

    // Avança para o próximo dia civil (24h)
    currentDayBrt.setUTCDate(currentDayBrt.getUTCDate() + 1);
  }

  return totalSeconds;
}

/**
 * Atualiza o histórico de etapas registrando a saída da etapa anterior
 * e a entrada na nova etapa com timestamps e duração útil (SLA comercial).
 */
export function computeNextStageHistory(
  existingHistory: StageHistoryItem[] | null | undefined,
  oldStatus: string,
  newStatus: string,
  userId?: string | null,
  createdAt?: string
): StageHistoryItem[] {
  const now = new Date();
  const nowIso = now.toISOString();
  const history: StageHistoryItem[] = Array.isArray(existingHistory)
    ? JSON.parse(JSON.stringify(existingHistory))
    : [];

  if (history.length === 0) {
    const initialEnteredAt = createdAt ? new Date(createdAt).toISOString() : nowIso;
    const durSec = calculateBusinessHoursDuration(initialEnteredAt, now);
    history.push({
      stage: oldStatus,
      entered_at: initialEnteredAt,
      left_at: nowIso,
      duration_seconds: durSec,
      moved_by: userId || null,
    });
  } else {
    // Fecha a última etapa aberta se existir
    const last = history[history.length - 1];
    if (!last.left_at) {
      const durSec = calculateBusinessHoursDuration(last.entered_at, now);
      last.left_at = nowIso;
      last.duration_seconds = durSec;
    }
  }

  // Insere a nova etapa
  history.push({
    stage: newStatus,
    entered_at: nowIso,
    left_at: null,
    duration_seconds: null,
    moved_by: userId || null,
  });

  return history;
}

/**
 * Formata duração em segundos para texto amigável em português
 */
export function formatSlaDuration(seconds: number | null | undefined, short = false): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return "-";
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}min`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    if (short) {
      return remMinutes > 0 ? `${hours}h${remMinutes}m` : `${hours}h`;
    }
    return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (short) {
    return remHours > 0 ? `${days}d${remHours}h` : `${days}d`;
  }
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export interface CardSlaSummary {
  // 1. Tempo de Nova Solicitação até Pendente
  timeToPendenteSeconds: number | null;
  isPendenteOngoing: boolean;
  timeToPendenteFormatted: string;

  // 2. Tempo de Pendente até Finalizado
  pendenteToFinalizadoSeconds: number | null;
  isFinalizadoOngoing: boolean;
  pendenteToFinalizadoFormatted: string;

  // 3. Ciclo Total
  totalCycleSeconds: number | null;
  totalCycleFormatted: string;
}

/**
 * Extrai as métricas de SLA do card com base em horário comercial (Seg-Sex, 08h-18h):
 * 1) Nova Solicitação -> Pendente
 * 2) Pendente -> Finalizado
 * 3) Ciclo Total
 */
export function getCardSlaMetrics(card: PaymentRequest): CardSlaSummary {
  const history = Array.isArray(card.stage_history) ? card.stage_history : [];
  const nowMs = Date.now();
  const createdMs = new Date(card.created_at).getTime();

  // Procurar entradas de etapas
  const novaItem = history.find((h) => h.stage === "NOVA_SOLICITACAO");
  const pendenteItem = history.find((h) => h.stage === "EM_APROVACAO");
  const finalizadoItem = history.find((h) => h.stage === "FINALIZADO");

  // 1. Nova Solicitação -> Pendente
  let timeToPendenteSeconds: number | null = null;
  let isPendenteOngoing = false;

  if (pendenteItem) {
    const pendenteStart = new Date(pendenteItem.entered_at).getTime();
    const createdStart = novaItem ? new Date(novaItem.entered_at).getTime() : createdMs;
    timeToPendenteSeconds = calculateBusinessHoursDuration(createdStart, pendenteStart);
  } else if (card.status === "NOVA_SOLICITACAO") {
    // Ainda está em Nova Solicitação
    timeToPendenteSeconds = calculateBusinessHoursDuration(createdMs, nowMs);
    isPendenteOngoing = true;
  } else if (novaItem && novaItem.left_at) {
    timeToPendenteSeconds = calculateBusinessHoursDuration(novaItem.entered_at, novaItem.left_at);
  }

  // 2. Pendente -> Finalizado
  let pendenteToFinalizadoSeconds: number | null = null;
  let isFinalizadoOngoing = false;

  if (finalizadoItem) {
    const finalizadoStart = new Date(finalizadoItem.entered_at).getTime();
    if (pendenteItem) {
      const pendenteStart = new Date(pendenteItem.entered_at).getTime();
      pendenteToFinalizadoSeconds = calculateBusinessHoursDuration(pendenteStart, finalizadoStart);
    } else {
      // Se pulou pendente direto para finalizado
      pendenteToFinalizadoSeconds = calculateBusinessHoursDuration(createdMs, finalizadoStart);
    }
  } else if (pendenteItem) {
    // Já entrou em Pendente, mas ainda não foi Finalizado
    const pendenteStart = new Date(pendenteItem.entered_at).getTime();
    pendenteToFinalizadoSeconds = calculateBusinessHoursDuration(pendenteStart, nowMs);
    isFinalizadoOngoing = true;
  }

  // 3. Ciclo Total (Criação -> Finalizado)
  let totalCycleSeconds: number | null = null;
  if (finalizadoItem) {
    const finalizadoStart = new Date(finalizadoItem.entered_at).getTime();
    totalCycleSeconds = calculateBusinessHoursDuration(createdMs, finalizadoStart);
  } else {
    totalCycleSeconds = calculateBusinessHoursDuration(createdMs, nowMs);
  }

  return {
    timeToPendenteSeconds,
    isPendenteOngoing,
    timeToPendenteFormatted: formatSlaDuration(timeToPendenteSeconds, true),
    pendenteToFinalizadoSeconds,
    isFinalizadoOngoing,
    pendenteToFinalizadoFormatted: formatSlaDuration(pendenteToFinalizadoSeconds, true),
    totalCycleSeconds,
    totalCycleFormatted: formatSlaDuration(totalCycleSeconds, true),
  };
}

export interface DashboardSlaMetrics {
  avgNovaToPendenteSeconds: number;
  avgNovaToPendenteFormatted: string;
  countNovaToPendente: number;

  avgPendenteToFinalizadoSeconds: number;
  avgPendenteToFinalizadoFormatted: string;
  countPendenteToFinalizado: number;

  avgTotalCycleSeconds: number;
  avgTotalCycleFormatted: string;
  countTotalFinalizados: number;
}

export type DashboardSlaAverages = DashboardSlaMetrics;

/**
 * Calcula as médias de SLA para o dashboard
 */
export function calculateDashboardSlaAverages(cards: PaymentRequest[]): DashboardSlaMetrics {
  const validNovaToPendente: number[] = [];
  const validPendenteToFinalizado: number[] = [];
  const validTotalCycle: number[] = [];

  for (const card of cards) {
    const metrics = getCardSlaMetrics(card);

    // Contar tempo de Nova Solicitação -> Pendente (apenas transições concluídas)
    if (!metrics.isPendenteOngoing && metrics.timeToPendenteSeconds !== null) {
      validNovaToPendente.push(metrics.timeToPendenteSeconds);
    }

    // Contar tempo de Pendente -> Finalizado (apenas cards finalizados)
    if (card.status === "FINALIZADO" && metrics.pendenteToFinalizadoSeconds !== null) {
      validPendenteToFinalizado.push(metrics.pendenteToFinalizadoSeconds);
    }

    // Contar ciclo total (apenas cards finalizados)
    if (card.status === "FINALIZADO" && metrics.totalCycleSeconds !== null) {
      validTotalCycle.push(metrics.totalCycleSeconds);
    }
  }

  const avg = (arr: number[]) => (arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

  const avgNova = avg(validNovaToPendente);
  const avgPendente = avg(validPendenteToFinalizado);
  const avgTotal = avg(validTotalCycle);

  return {
    avgNovaToPendenteSeconds: avgNova,
    avgNovaToPendenteFormatted: formatSlaDuration(avgNova),
    countNovaToPendente: validNovaToPendente.length,

    avgPendenteToFinalizadoSeconds: avgPendente,
    avgPendenteToFinalizadoFormatted: formatSlaDuration(avgPendente),
    countPendenteToFinalizado: validPendenteToFinalizado.length,

    avgTotalCycleSeconds: avgTotal,
    avgTotalCycleFormatted: formatSlaDuration(avgTotal),
    countTotalFinalizados: validTotalCycle.length,
  };
}
