import type { PaymentRequest, StageHistoryItem } from "@/types/database";

/**
 * Atualiza o histórico de etapas registrando a saída da etapa anterior
 * e a entrada na nova etapa com timestamps e duração.
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
    const durSec = Math.max(0, Math.round((now.getTime() - new Date(initialEnteredAt).getTime()) / 1000));
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
      const enteredAtDate = new Date(last.entered_at);
      const durSec = Math.max(0, Math.round((now.getTime() - enteredAtDate.getTime()) / 1000));
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
 * Extrai as métricas de SLA do card com foco em:
 * 1) Nova Solicitação -> Pendente
 * 2) Pendente -> Finalizado
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
    timeToPendenteSeconds = Math.max(0, Math.round((pendenteStart - createdStart) / 1000));
  } else if (card.status === "NOVA_SOLICITACAO") {
    // Ainda está em Nova Solicitação
    timeToPendenteSeconds = Math.max(0, Math.round((nowMs - createdMs) / 1000));
    isPendenteOngoing = true;
  } else if (novaItem && novaItem.left_at) {
    timeToPendenteSeconds = novaItem.duration_seconds || null;
  }

  // 2. Pendente -> Finalizado
  let pendenteToFinalizadoSeconds: number | null = null;
  let isFinalizadoOngoing = false;

  if (finalizadoItem) {
    const finalizadoStart = new Date(finalizadoItem.entered_at).getTime();
    if (pendenteItem) {
      const pendenteStart = new Date(pendenteItem.entered_at).getTime();
      pendenteToFinalizadoSeconds = Math.max(0, Math.round((finalizadoStart - pendenteStart) / 1000));
    } else {
      // Se pulou pendente direto para finalizado
      pendenteToFinalizadoSeconds = Math.max(0, Math.round((finalizadoStart - createdMs) / 1000));
    }
  } else if (pendenteItem) {
    // Já entrou em Pendente, mas ainda não foi Finalizado
    const pendenteStart = new Date(pendenteItem.entered_at).getTime();
    pendenteToFinalizadoSeconds = Math.max(0, Math.round((nowMs - pendenteStart) / 1000));
    isFinalizadoOngoing = true;
  }

  // 3. Ciclo Total (Criação -> Finalizado)
  let totalCycleSeconds: number | null = null;
  if (finalizadoItem) {
    const finalizadoStart = new Date(finalizadoItem.entered_at).getTime();
    totalCycleSeconds = Math.max(0, Math.round((finalizadoStart - createdMs) / 1000));
  } else {
    totalCycleSeconds = Math.max(0, Math.round((nowMs - createdMs) / 1000));
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
