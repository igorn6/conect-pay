import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/utils/supabase/server";
import {
  NUBANK_INITIAL_BALANCE,
  isNubankAccount,
  isRechargeKind,
  type NubankMovement,
  type NubankSnapshot,
} from "@/constants/nubank";

type AllowedRole = "MASTER" | "FINANCEIRO" | "GESTOR";

export type AuthResult =
  | { ok: true; userId: string; name: string; role: AllowedRole }
  | { ok: false; status: number; error: string };

/**
 * Autentica o usuário suportando:
 *  1. Bearer Token no header Authorization
 *  2. Sessão via Cookies SSR (@supabase/ssr)
 *  3. Header x-user-id ou providedUserId
 */
export async function authorize(
  allowed: AllowedRole[],
  req?: Request,
  providedUserId?: string | null
): Promise<AuthResult> {
  let user: any = null;

  // 1. Tenta por Bearer token no header Authorization
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      try {
        const { data: tokenUser } = await supabaseAdmin.auth.getUser(token);
        if (tokenUser?.user) {
          user = tokenUser.user;
        }
      } catch (e) {
        console.warn("[Authorize] Erro ao validar Bearer token:", e);
      }
    }
  }

  // 2. Se não encontrou, tenta por cookies SSR
  if (!user) {
    try {
      const supabase = await createClient();
      const {
        data: { user: cookieUser },
      } = await supabase.auth.getUser();
      if (cookieUser) {
        user = cookieUser;
      }
    } catch (cookieErr) {
      // Cookies SSR podem não estar presentes no client fetch
    }
  }

  // 3. Fallback: header x-user-id ou providedUserId
  if (!user && req) {
    const headerUserId = req.headers.get("x-user-id");
    const targetId = headerUserId || providedUserId;
    if (targetId) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetId);
        if (authUser?.user) {
          user = authUser.user;
        }
      } catch (e) {
        console.warn("[Authorize] Erro ao buscar usuário por ID:", e);
      }
    }
  }

  const targetUserId = user?.id || providedUserId;
  if (!targetUserId) {
    return { ok: false, status: 401, error: "Não autorizado. Faça login novamente." };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, name, role")
    .eq("id", targetUserId)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "Perfil do usuário não encontrado." };
  }

  const role = (profile.role || "").trim().toUpperCase() as AllowedRole;
  if (!allowed.includes(role)) {
    return {
      ok: false,
      status: 403,
      error: `Acesso negado. Apenas ${allowed.join(" ou ")} podem executar esta ação.`,
    };
  }

  return { ok: true, userId: profile.id, name: profile.name || "Usuário", role };
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

/** Chama a função atômica de estorno (devolve saldo ao Nubank e seta balance_processed = false). */
export async function revertMovement(args: {
  requestId: string;
  userId: string | null;
  description?: string;
}): Promise<ApplyResult> {
  await ensureNubankBalance();

  const { data, error } = await supabaseAdmin.rpc("revert_nubank_movement", {
    p_request_id: args.requestId,
    p_user: args.userId,
    p_description: args.description ?? null,
  });

  if (error) throw error;
  const r = (data || {}) as any;
  return {
    processed: Boolean(r.processed),
    balance: round2(Number(r.balance)),
    delta: r.delta !== undefined ? Number(r.delta) : undefined,
  };
}

/** Status onde a despesa já foi paga ou validada/finalizada. */
export const NUBANK_ACTIVE_STATUSES = [
  "VALIDACAO_GESTOR",
  "CORRECAO_PENDENTE",
  "VALIDADO_GESTOR",
  "AGUARDANDO_PAGAMENTO",
  "FINALIZADO",
];

/** Status inativos (não pagos ou cancelados) onde o saldo Nubank não deve estar descontado. */
export const NUBANK_IDLE_STATUSES = ["NOVA_SOLICITACAO", "EM_APROVACAO", "RECUSADO"];

export type CardDecision =
  | { action: "SKIP"; reason: string }
  | { action: "APPLY"; type: "ENTRADA" | "SAIDA"; delta: number; description: string }
  | { action: "REVERT"; reason: string; description: string };

/**
 * Regra de negócio bidirecional e idempotente baseada no estado real do cartão:
 *  - Se balance_processed === true mas o cartão foi excluído, recusado, voltou para Pendente ou trocou para outro banco:
 *      -> REVERT: Estorna o saldo de volta ao Nubank.
 *  - Se balance_processed === false e o cartão for Nubank em status ativo (Validação do Gestor, Correção Pendente, Validado pelo Gestor, Aguardando Nota ou Finalizado):
 *      -> APPLY: Desconta o saldo do Nubank (SAÍDA).
 *  - Se for Recarga Nubank que chegou em FINALIZADO:
 *      -> APPLY: Adiciona saldo ao Nubank (ENTRADA).
 */
export function decideCardMovement(
  card: any,
  creatorRole: string | null
): CardDecision {
  if (!card) return { action: "SKIP", reason: "Cartão não encontrado." };

  const amount = round2(Number(card.amount) || 0);
  const title = card.title || "Sem título";

  // =========================================================================
  // CENÁRIO 1: Cartão JÁ teve o saldo processado (balance_processed === true).
  // Devemos manter o processamento ou REVERTER (estornar) o saldo ao Nubank?
  // =========================================================================
  if (card.balance_processed) {
    // 1.1 Se o cartão foi excluído (enviado para lixeira)
    if (card.is_deleted) {
      return {
        action: "REVERT",
        reason: "Cartão excluído / movido para a lixeira.",
        description: `Estorno por exclusão: ${title}`,
      };
    }

    // 1.2 Se o cartão foi recusado
    if (card.status === "RECUSADO") {
      return {
        action: "REVERT",
        reason: "Cartão recusado.",
        description: `Estorno por recusa: ${title}`,
      };
    }

    // 1.3 Se o cartão retornou para status anterior ao pagamento (Nova Solicitação ou Pendente)
    if (card.status === "NOVA_SOLICITACAO" || card.status === "EM_APROVACAO") {
      return {
        action: "REVERT",
        reason: "Cartão retornou para status anterior ao pagamento.",
        description: `Estorno por retorno de status: ${title}`,
      };
    }

    // 1.4 Se for Recarga Nubank
    if (card.request_kind === "RECARGA_NUBANK") {
      if (card.status !== "FINALIZADO") {
        return {
          action: "REVERT",
          reason: "Recarga Nubank não está mais finalizada.",
          description: `Estorno de recarga: ${title}`,
        };
      }
      if (creatorRole !== "MASTER" && creatorRole !== "FINANCEIRO") {
        return {
          action: "REVERT",
          reason: "Recarga criada por perfil sem permissão.",
          description: `Estorno de recarga: ${title}`,
        };
      }
      return { action: "SKIP", reason: "Recarga Nubank já creditada." };
    }

    // 1.5 Para despesas normais: o cartão deixou de ser conta Nubank?
    if (!isNubankAccount(card.cnpj)) {
      return {
        action: "REVERT",
        reason: "Cartão alterado para conta não Nubank.",
        description: `Estorno por alteração de pagador: ${title}`,
      };
    }

    // Se continua sendo Nubank e em status ativo:
    return { action: "SKIP", reason: "Cartão já debitado e no estado correto." };
  }

  // =========================================================================
  // CENÁRIO 2: Cartão AINDA NÃO teve o saldo processado (balance_processed !== true).
  // Devemos DEBITAR (SAÍDA) ou CREDITAR (ENTRADA)?
  // =========================================================================

  // 2.1 Se estiver na lixeira, não processa
  if (card.is_deleted) {
    return { action: "SKIP", reason: "Cartão na lixeira." };
  }

  // 2.2 Se o valor não for válido (> 0)
  if (!(amount > 0)) {
    return { action: "SKIP", reason: "Valor inválido." };
  }

  // 2.3 Se ainda estiver em status inativo (NOVA_SOLICITACAO, EM_APROVACAO, RECUSADO)
  if (NUBANK_IDLE_STATUSES.includes(card.status)) {
    return { action: "SKIP", reason: "Cartão ainda não saiu de Pendente ou foi recusado." };
  }

  // 2.4 Se for Recarga de Saldo Nubank
  if (card.request_kind === "RECARGA_NUBANK") {
    if (card.status !== "FINALIZADO") {
      return { action: "SKIP", reason: "Recarga só entra ao finalizar." };
    }
    if (creatorRole !== "MASTER" && creatorRole !== "FINANCEIRO") {
      return { action: "SKIP", reason: "Recarga criada por perfil sem permissão." };
    }
    return {
      action: "APPLY",
      type: "ENTRADA",
      delta: amount,
      description: `Recarga de Saldo Nubank: ${title}`,
    };
  }

  // 2.5 Para despesas normais: se a conta pagadora for Nubank e estiver em status ativo
  if (isNubankAccount(card.cnpj)) {
    if (NUBANK_ACTIVE_STATUSES.includes(card.status)) {
      const prefix = isRechargeKind(card.request_kind) ? "Recarga Caju paga via NU" : "Pagamento";
      return {
        action: "APPLY",
        type: "SAIDA",
        delta: -amount,
        description: `${prefix}: ${title}`,
      };
    }
  }

  return { action: "SKIP", reason: "Cartão não utiliza o Nubank ou não atingiu etapa aplicável." };
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

  if (decision.action === "REVERT") {
    const result = await revertMovement({
      requestId: card.id,
      userId,
      description: decision.description,
    });
    return {
      processed: result.processed,
      action: "REVERT" as const,
      type: "REEMBOLSO" as const,
      delta: result.delta,
      balance: result.balance,
      reason: result.processed ? undefined : "Cartão já revertido.",
    };
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
    action: "APPLY" as const,
    reason: result.processed ? undefined : "Cartão já processado.",
    type: decision.type,
    delta: decision.delta,
    balance: result.balance,
  };
}
