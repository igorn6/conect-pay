import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/utils/supabase/server";
import {
  NUBANK_INITIAL_BALANCE,
  isNubankAccount,
  isRechargeKind,
  type NubankMovement,
  type NubankSnapshot,
} from "@/constants/nubank";

type AllowedRole = "MASTER" | "FINANCEIRO";

export type AuthResult =
  | { ok: true; userId: string; name: string; role: AllowedRole }
  | { ok: false; status: number; error: string };

/** Autentica via sessão (@supabase/ssr) e exige um dos perfis informados. */
export async function authorize(allowed: AllowedRole[]): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Não autorizado. Faça login novamente." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "Perfil do usuário não encontrado." };
  }

  if (!allowed.includes(profile.role as AllowedRole)) {
    return {
      ok: false,
      status: 403,
      error: `Acesso negado. Apenas ${allowed.join(" ou ")} podem executar esta ação.`,
    };
  }

  return { ok: true, userId: user.id, name: profile.name || "Usuário", role: profile.role as AllowedRole };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Fallback automático: garante que exista o registro de saldo (inicia em 609,74). */
export async function ensureNubankBalance(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("nubank_balance")
    .upsert({ id: "nubank", balance: NUBANK_INITIAL_BALANCE }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function getNubankSnapshot(limit = 5): Promise<NubankSnapshot> {
  await ensureNubankBalance();

  const [{ data: bal, error: balError }, { data: movs, error: movError }] = await Promise.all([
    supabaseAdmin.from("nubank_balance").select("balance, updated_at").eq("id", "nubank").single(),
    supabaseAdmin
      .from("nubank_movements")
      .select("id, type, amount, balance_after, description, payment_request_id, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (balError) throw balError;
  if (movError) throw movError;

  return {
    balance: round2(Number(bal?.balance ?? NUBANK_INITIAL_BALANCE)),
    updatedAt: bal?.updated_at ?? null,
    movements: (movs || []).map((m: any) => ({
      ...m,
      amount: Number(m.amount),
      balance_after: Number(m.balance_after),
    })) as NubankMovement[],
  };
}

export interface ApplyResult {
  processed: boolean;
  balance: number;
  delta?: number;
}

/** Chama a função atômica do banco (lock da linha de saldo + trava anti-duplicidade). */
export async function applyMovement(args: {
  type: "ENTRADA" | "SAIDA" | "REEMBOLSO" | "AJUSTE";
  delta?: number;
  absolute?: number;
  description: string;
  userId: string | null;
  requestId?: string | null;
}): Promise<ApplyResult> {
  await ensureNubankBalance();

  const { data, error } = await supabaseAdmin.rpc("apply_nubank_movement", {
    p_type: args.type,
    p_delta: args.delta ?? 0,
    p_description: args.description,
    p_user: args.userId,
    p_request_id: args.requestId ?? null,
    p_absolute: args.absolute ?? null,
  });

  if (error) throw error;
  const r = (data || {}) as any;
  return {
    processed: Boolean(r.processed),
    balance: round2(Number(r.balance)),
    delta: r.delta !== undefined ? Number(r.delta) : undefined,
  };
}

const IDLE_STATUSES = ["NOVA_SOLICITACAO", "EM_APROVACAO", "RECUSADO"];

export type CardDecision =
  | { action: "SKIP"; reason: string }
  | { action: "APPLY"; type: "ENTRADA" | "SAIDA"; delta: number; description: string };

/**
 * Regra de negócio (idempotente, baseada no estado do cartão):
 *  - Enquanto o cartão está em Nova Solicitação / Pendente (ou foi recusado) não mexe no saldo.
 *  - SAÍDA (-): cartão pago via Nubank (qualquer despesa ou Recarga Caju paga via NU) que já saiu de Pendente.
 *  - ENTRADA (+): "Recarga de Saldo Nubank" que chegou em FINALIZADO.
 *  - balance_processed garante que o cartão nunca mexe no saldo duas vezes (ex.: voltou p/ Correção Pendente).
 */
export function decideCardMovement(
  card: any,
  creatorRole: string | null
): CardDecision {
  if (!card) return { action: "SKIP", reason: "Cartão não encontrado." };
  if (card.is_deleted) return { action: "SKIP", reason: "Cartão na lixeira." };
  if (card.balance_processed) return { action: "SKIP", reason: "Cartão já processado." };
  if (IDLE_STATUSES.includes(card.status)) return { action: "SKIP", reason: "Cartão ainda não saiu de Pendente." };

  const amount = round2(Number(card.amount) || 0);
  if (!(amount > 0)) return { action: "SKIP", reason: "Valor inválido." };

  const title = card.title || "Sem título";

  if (card.request_kind === "RECARGA_NUBANK") {
    if (card.status !== "FINALIZADO") return { action: "SKIP", reason: "Recarga só entra ao finalizar." };
    // Só Financeiro/Master podem criar recargas: ignora cartões forjados por outros perfis.
    if (creatorRole !== "MASTER" && creatorRole !== "FINANCEIRO") {
      return { action: "SKIP", reason: "Recarga criada por perfil sem permissão." };
    }
    return { action: "APPLY", type: "ENTRADA", delta: amount, description: `Recarga de Saldo Nubank: ${title}` };
  }

  if (isNubankAccount(card.cnpj)) {
    const prefix = isRechargeKind(card.request_kind) ? "Recarga Caju paga via NU" : "Pagamento";
    return { action: "APPLY", type: "SAIDA", delta: -amount, description: `${prefix}: ${title}` };
  }

  return { action: "SKIP", reason: "Cartão não utiliza o Nubank." };
}

export async function processCardMovement(paymentId: string, userId: string) {
  const { data: card, error } = await supabaseAdmin
    .from("payment_requests")
    .select("id, title, amount, status, cnpj, request_kind, balance_processed, is_deleted, created_by")
    .eq("id", paymentId)
    .single();

  if (error || !card) {
    return { processed: false, reason: "Solicitação não encontrada.", notFound: true as const };
  }

  let creatorRole: string | null = null;
  if (card.request_kind === "RECARGA_NUBANK" && card.created_by) {
    const { data: creator } = await supabaseAdmin.from("profiles").select("role").eq("id", card.created_by).maybeSingle();
    creatorRole = creator?.role ?? null;
  }

  const decision = decideCardMovement(card, creatorRole);
  if (decision.action === "SKIP") {
    return { processed: false, reason: decision.reason };
  }

  const result = await applyMovement({
    type: decision.type,
    delta: decision.delta,
    description: decision.description,
    userId,
    requestId: card.id,
  });

  return {
    processed: result.processed,
    reason: result.processed ? undefined : "Cartão já processado.",
    type: decision.type,
    delta: decision.delta,
    balance: result.balance,
  };
}
