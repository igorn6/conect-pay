/**
 * Validador IA Automático do Caju.
 * Cruza os DEPÓSITOS do extrato Caju com as solicitações CAJU do Kanban usando sinais
 * de nome do colaborador, proximidade de data, categoria/adiantamento e valor —
 * incluindo cards que agrupam múltiplos depósitos (lote).
 *
 * Função pura e determinística: mesmas entradas => mesmas conciliações.
 */
import { round2, type CajuMatchDetails, type CajuMatchKind } from "@/constants/caju";
import { stripAccents } from "./cajuCsvParser";

export interface DepositInput {
  id: string;
  collaborator_name: string;
  amount: number;
  occurred_at: string;
  advance_name: string | null;
}

export interface KanbanCardInput {
  id: string;
  title: string | null;
  amount: number;
  status: string | null;
  category: string | null;
  notes: string | null;
  pix_owner: string | null;
  pix_name: string | null;
  caju_phone: string | null;
  created_at: string;
  updated_at: string | null;
  splits: any[] | null;
}

export interface DepositMatchResult {
  depositId: string;
  status: "CONCILIADO" | "SEM_CONCILIACAO";
  kind: CajuMatchKind | null;
  requestId: string | null;
  details: CajuMatchDetails | null;
}

interface Slot {
  key: string;
  card: KanbanCardInput;
  amount: number;
  beneficiary: string | null;
  text: string; // texto completo do card para sinais de nome
  dates: number[];
  used: boolean;
}

const DAY = 86_400_000;
const STOP = new Set([
  "de", "da", "do", "das", "dos", "e", "para", "com", "por", "em", "solicitacao", "ticket", "pagamento",
  "caju", "almoco", "janta", "jantar", "cafe", "alimentacao", "abastecimento", "combustivel", "hospedagem",
  "recarga", "saldo", "reembolso", "treinamento", "dia", "dias", "junior", "filho", "neto",
]);

const BRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function tokens(s: string | null | undefined): string[] {
  return stripAccents(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));
}

/** Sinal de nome: o colaborador do extrato aparece no beneficiário/texto do card? */
function nameSignal(collaborator: string, slot: Slot): boolean {
  const person = tokens(collaborator);
  if (person.length === 0) return false;
  const first = person[0];
  const benef = new Set(tokens(slot.beneficiary));
  const text = new Set(tokens(slot.text));

  const overlapBenef = person.filter((t) => benef.has(t)).length;
  if (overlapBenef >= 2) return true;
  // Beneficiário cadastrado só com o primeiro nome (ex.: "Laysa", "Ari")
  if (benef.size > 0 && benef.size <= 1 && benef.has(first)) return true;

  const overlapText = person.filter((t) => text.has(t)).length;
  if (overlapText >= 2) return true;
  // Primeiro nome distintivo citado no título/observações (ex.: "Ticket alimentação Ari e Filipe")
  return text.has(first) && first.length >= 3;
}

function categorySignal(advance: string | null, slot: Slot): boolean {
  const a = stripAccents(String(advance || "")).toLowerCase();
  if (!a) return false;
  const cat = stripAccents(`${slot.card.category || ""} ${slot.card.title || ""}`).toLowerCase();
  return a
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 4)
    .some((t) => cat.includes(t.slice(0, 5)));
}

function minDaysDiff(depositTime: number, slot: Slot): number {
  if (slot.dates.length === 0) return 999;
  return Math.min(...slot.dates.map((d) => Math.abs(depositTime - d) / DAY));
}

function isCajuSplit(s: any): boolean {
  return String(s?.payment_type || "").toUpperCase() === "CAJU";
}

function buildSlots(cards: KanbanCardInput[]): Slot[] {
  const slots: Slot[] = [];
  for (const card of cards) {
    const splits = Array.isArray(card.splits) ? card.splits : [];
    const cajuSplits = splits.filter(isCajuSplit);
    const dates = [card.created_at, card.updated_at]
      .filter(Boolean)
      .map((d) => new Date(String(d)).getTime())
      .filter((t) => Number.isFinite(t));
    const beneficiaries = cajuSplits.map((s) => s.caju_phone || s.pix_owner).filter(Boolean).join(" ");
    const text = [card.title, card.notes, card.pix_owner, card.pix_name, card.caju_phone, beneficiaries]
      .filter(Boolean)
      .join(" ");

    if (cajuSplits.length > 0) {
      cajuSplits.forEach((s, i) =>
        slots.push({
          key: `${card.id}#${i}`,
          card,
          amount: round2(Number(s.amount) || 0),
          beneficiary: s.caju_phone || s.pix_owner || card.caju_phone || null,
          text,
          dates,
          used: false,
        })
      );
    } else {
      slots.push({
        key: `${card.id}#0`,
        card,
        amount: round2(Number(card.amount) || 0),
        beneficiary: card.caju_phone || card.pix_owner || card.pix_name || null,
        text,
        dates,
        used: false,
      });
    }
  }
  return slots.filter((s) => s.amount > 0);
}

function describeDate(days: number): string {
  if (days < 1) return "mesmo dia";
  const d = Math.round(days);
  return `${d} dia${d > 1 ? "s" : ""} de diferença`;
}

function makeDetails(args: {
  kind: CajuMatchKind;
  slot: Slot;
  deposit: DepositInput;
  name: boolean;
  days: number;
  category: boolean;
  amountSignal: CajuMatchDetails["signals"]["amount"];
  group?: CajuMatchDetails["group"];
  confidence: number;
}): CajuMatchDetails {
  const { slot, deposit, name, days, category, amountSignal, group, kind, confidence } = args;
  const diff = round2(deposit.amount - slot.amount);
  const cardLabel = `"${slot.card.title || "Sem título"}" (${BRL(slot.card.amount)})`;
  const reasons: string[] = [];
  if (name) reasons.push("nome do colaborador confirmado no card");
  if (days <= 7) reasons.push(`data compatível (${describeDate(days)})`);
  if (category) reasons.push("categoria do adiantamento coerente");

  let explanation: string;
  if (amountSignal === "LOTE" && group) {
    explanation =
      `Este depósito faz parte de um lote de ${group.count} depósitos (${BRL(group.sum)} no total) ` +
      `agrupados em um único card do Kanban ${cardLabel}. Colaboradores do lote: ${group.members.join(", ")}.` +
      (Math.abs(round2(group.sum - slot.amount)) >= 0.01
        ? ` Divergência parcial: soma do lote ${BRL(group.sum)} vs. valor do card ${BRL(slot.amount)} (diferença ${BRL(round2(group.sum - slot.amount))}).`
        : " A soma do lote bate exatamente com o valor do card.");
  } else if (amountSignal === "EXATO") {
    explanation = `Valor idêntico (${BRL(deposit.amount)}) ao esperado no card ${cardLabel}${reasons.length ? `, com ${reasons.join(", ")}` : ""}.`;
  } else {
    explanation =
      `Divergência parcial de valor: depósito de ${BRL(deposit.amount)} vs. ${BRL(slot.amount)} esperado ` +
      `(diferença ${diff > 0 ? "+" : ""}${BRL(diff)}). Vinculado ao card ${cardLabel} por ${reasons.join(", ") || "proximidade de dados"}.`;
  }

  return {
    kind,
    requestId: slot.card.id,
    requestTitle: slot.card.title || "Sem título",
    requestAmount: round2(slot.card.amount),
    requestStatus: slot.card.status,
    requestDate: slot.card.created_at,
    requestBeneficiary: slot.beneficiary,
    confidence: round2(Math.min(1, confidence)),
    signals: { name, date: days <= 7, amount: amountSignal, category },
    group,
    amountDifference: amountSignal === "LOTE" && group ? round2(group.sum - slot.amount) : diff,
    explanation,
  };
}

/** Busca subconjunto (até 8 itens) cuja soma == alvo. */
function findSubsetSum(items: DepositInput[], target: number): DepositInput[] | null {
  const pool = items.slice(0, 14);
  const targetC = Math.round(target * 100);
  let best: DepositInput[] | null = null;
  const walk = (i: number, acc: DepositInput[], sumC: number) => {
    if (best) return;
    if (sumC === targetC && acc.length >= 2) {
      best = [...acc];
      return;
    }
    if (i >= pool.length || sumC > targetC || acc.length >= 8) return;
    walk(i + 1, [...acc, pool[i]], sumC + Math.round(pool[i].amount * 100));
    walk(i + 1, acc, sumC);
  };
  walk(0, [], 0);
  return best;
}

export function reconcileCajuDeposits(deposits: DepositInput[], cards: KanbanCardInput[]): DepositMatchResult[] {
  const slots = buildSlots(cards);
  const results = new Map<string, DepositMatchResult>();
  const sorted = [...deposits].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  // ---------- Passo 1: pares individuais (exato e parcial) por pontuação ----------
  type Cand = { dep: DepositInput; slot: Slot; score: number; kind: CajuMatchKind; name: boolean; days: number; category: boolean; amountSignal: "EXATO" | "PROXIMO" | "DIVERGENTE" };
  const cands: Cand[] = [];
  for (const dep of sorted) {
    const t = new Date(dep.occurred_at).getTime();
    for (const slot of slots) {
      const days = minDaysDiff(t, slot);
      if (days > 10) continue;
      const diff = Math.abs(dep.amount - slot.amount);
      const amountSignal = diff < 0.01 ? "EXATO" : diff <= Math.max(2, slot.amount * 0.05) ? "PROXIMO" : "DIVERGENTE";
      const name = nameSignal(dep.collaborator_name, slot);
      const category = categorySignal(dep.advance_name, slot);

      let kind: CajuMatchKind | null = null;
      if (amountSignal === "EXATO" && (name || days <= 2)) kind = "EXATO";
      else if (amountSignal === "EXATO" && days <= 7) kind = "PARCIAL";
      else if (name && days <= 7 && amountSignal !== "DIVERGENTE") kind = "PARCIAL";
      else if (name && days <= 4 && dep.amount <= slot.amount) kind = "PARCIAL"; // valor menor: possível parte do card
      if (!kind) continue;

      const score =
        (amountSignal === "EXATO" ? 0.45 : amountSignal === "PROXIMO" ? 0.25 : 0.05) +
        (name ? 0.35 : 0) +
        (days <= 1 ? 0.15 : days <= 3 ? 0.1 : days <= 7 ? 0.05 : 0) +
        (category ? 0.05 : 0);
      cands.push({ dep, slot, score, kind, name, days, category, amountSignal });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.days - b.days);

  for (const c of cands) {
    if (results.has(c.dep.id) || c.slot.used) continue;
    // PARCIAL com valor menor e sem nome não consome o slot isoladamente (pode ser lote)
    if (c.kind === "PARCIAL" && c.amountSignal === "DIVERGENTE") continue;
    c.slot.used = true;
    results.set(c.dep.id, {
      depositId: c.dep.id,
      status: "CONCILIADO",
      kind: c.kind,
      requestId: c.slot.card.id,
      details: makeDetails({ ...c, deposit: c.dep, slot: c.slot, confidence: c.score }),
    });
  }

  // ---------- Passo 2: lotes (1 card agrupando vários depósitos) ----------
  for (const slot of slots) {
    if (slot.used) continue;
    const window = sorted.filter((d) => {
      if (results.has(d.id)) return false;
      const days = minDaysDiff(new Date(d.occurred_at).getTime(), slot);
      return days <= 4 && d.amount < slot.amount + 0.01;
    });
    if (window.length < 2) continue;

    // Prioriza colaboradores citados no card
    const ranked = [...window].sort((a, b) => Number(nameSignal(b.collaborator_name, slot)) - Number(nameSignal(a.collaborator_name, slot)));
    let members = findSubsetSum(ranked, slot.amount);
    let exactSum = true;

    if (!members) {
      // Lote parcial: colaboradores citados no card cuja soma não excede o valor do card
      const named = ranked.filter((d) => nameSignal(d.collaborator_name, slot));
      let acc = 0;
      const picked: DepositInput[] = [];
      for (const d of named) {
        if (acc + d.amount <= slot.amount + 0.01) {
          picked.push(d);
          acc += d.amount;
        }
      }
      if (picked.length >= 2) {
        members = picked;
        exactSum = false;
      }
    }
    if (!members) continue;

    slot.used = true;
    const sum = round2(members.reduce((s, d) => s + d.amount, 0));
    const group = { count: members.length, sum, members: members.map((m) => m.collaborator_name) };
    for (const dep of members) {
      const days = minDaysDiff(new Date(dep.occurred_at).getTime(), slot);
      const name = nameSignal(dep.collaborator_name, slot);
      results.set(dep.id, {
        depositId: dep.id,
        status: "CONCILIADO",
        kind: "PARCIAL",
        requestId: slot.card.id,
        details: makeDetails({
          kind: "PARCIAL",
          slot,
          deposit: dep,
          name,
          days,
          category: categorySignal(dep.advance_name, slot),
          amountSignal: "LOTE",
          group,
          confidence: (exactSum ? 0.7 : 0.55) + (name ? 0.15 : 0) + (days <= 1 ? 0.1 : 0),
        }),
      });
    }
  }

  // ---------- Passo 3: sinal forte de nome + data, mesmo com slot já utilizado (card agrupador) ----------
  for (const dep of sorted) {
    if (results.has(dep.id)) continue;
    const t = new Date(dep.occurred_at).getTime();
    const best = slots
      .map((slot) => ({ slot, days: minDaysDiff(t, slot), name: nameSignal(dep.collaborator_name, slot) }))
      .filter((x) => x.name && x.days <= 3)
      .sort((a, b) => a.days - b.days)[0];
    if (!best) continue;
    results.set(dep.id, {
      depositId: dep.id,
      status: "CONCILIADO",
      kind: "PARCIAL",
      requestId: best.slot.card.id,
      details: makeDetails({
        kind: "PARCIAL",
        slot: best.slot,
        deposit: dep,
        name: true,
        days: best.days,
        category: categorySignal(dep.advance_name, best.slot),
        amountSignal: Math.abs(dep.amount - best.slot.amount) < 0.01 ? "EXATO" : "DIVERGENTE",
        confidence: 0.5,
      }),
    });
  }

  return sorted.map(
    (d) => results.get(d.id) || { depositId: d.id, status: "SEM_CONCILIACAO", kind: null, requestId: null, details: null }
  );
}
