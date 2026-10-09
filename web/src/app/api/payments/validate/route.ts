export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeNextStageHistory } from "@/utils/sla";

type ValidateAction = "APPROVE" | "REJECT" | "FORCE_APPROVE";

interface ValidatePayload {
  paymentId: string;
  action: ValidateAction;
  reason?: string;
}

export async function POST(req: Request) {
  try {
    // 1. Autenticar via SSR
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autorizado. Faca login novamente." },
        { status: 401 }
      );
    }

    // 2. Buscar perfil do usuario para saber a role e setor
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role, sector")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Perfil não encontrado." },
        { status: 403 }
      );
    }

    // 3. Parsear body
    const body: ValidatePayload = await req.json();
    const { paymentId, action, reason } = body;

    if (!paymentId || !action) {
      return NextResponse.json(
        { error: "paymentId e action sao obrigatorios." },
        { status: 400 }
      );
    }

    // 4. Buscar o card
    const { data: card, error: cardError } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Solicitacao não encontrada." },
        { status: 404 }
      );
    }

    // Buscar perfil do solicitante original para verificar setor
    const requesterId = card.real_requester_id || card.created_by;
    let requesterSector: string | null = null;
    let requesterName: string = "Solicitante";

    if (requesterId) {
      const { data: reqProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, sector")
        .eq("id", requesterId)
        .maybeSingle();

      if (reqProfile) {
        requesterSector = reqProfile.sector;
        requesterName = reqProfile.name || "Solicitante";
      }
    }

    const isCreator = user.id === card.created_by || user.id === card.real_requester_id;
    const isSameSector = !!(
      profile.sector &&
      requesterSector &&
      String(profile.sector) === String(requesterSector)
    );
    const isMaster = profile.role === "MASTER";

    // ========== REGRAS DE NEGOCIO (RBAC E AUDITORIA) ==========

    if (action === "APPROVE") {
      if (card.status !== "VALIDACAO_GESTOR") {
        return NextResponse.json(
          { error: "Status invalido para validacao. Esperado: VALIDACAO_GESTOR." },
          { status: 400 }
        );
      }

      if (!isCreator && !isSameSector && !isMaster) {
        return NextResponse.json(
          { error: "Apenas o solicitante original ou membros do mesmo setor podem validar o pagamento." },
          { status: 403 }
        );
      }

      const nextStageHistory = computeNextStageHistory(
        card.stage_history,
        card.status,
        "VALIDADO_GESTOR",
        user.id,
        card.created_at
      );

      const last = nextStageHistory[nextStageHistory.length - 1];
      if (last) {
        (last as any).validator_name = profile.name || "Gestor";
        (last as any).is_creator = isCreator;
        (last as any).validated_at = new Date().toISOString();
      }

      const { error: updateError } = await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "VALIDADO_GESTOR",
          rejection_reason: null,
          stage_history: nextStageHistory,
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      const actionMessage = isCreator
        ? "Pagamento validado pelo solicitante."
        : `Pagamento validado por ${profile.name} (mesmo setor de ${requesterName}).`;

      return NextResponse.json({
        success: true,
        message: actionMessage,
        newStatus: "VALIDADO_GESTOR",
      });
    }

    if (action === "REJECT") {
      if (card.status !== "VALIDACAO_GESTOR") {
        return NextResponse.json(
          { error: "Status invalido para rejeicao. Esperado: VALIDACAO_GESTOR." },
          { status: 400 }
        );
      }

      if (!isCreator && !isSameSector && !isMaster) {
        return NextResponse.json(
          { error: "Apenas o solicitante original ou membros do mesmo setor podem exigir correcao." },
          { status: 403 }
        );
      }

      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: "O motivo da rejeicao e obrigatorio." },
          { status: 400 }
        );
      }

      const nextStageHistory = computeNextStageHistory(
        card.stage_history,
        card.status,
        "CORRECAO_PENDENTE",
        user.id,
        card.created_at
      );

      const last = nextStageHistory[nextStageHistory.length - 1];
      if (last) {
        (last as any).rejected_by_name = profile.name || "Gestor";
        (last as any).is_creator = isCreator;
        (last as any).rejected_at = new Date().toISOString();
        (last as any).reason = reason.trim();
      }

      const formattedReason = isCreator
        ? reason.trim()
        : `${reason.trim()} (Exigido por: ${profile.name || "Colega de Setor"})`;

      const { error: updateError } = await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "CORRECAO_PENDENTE",
          rejection_reason: formattedReason,
          stage_history: nextStageHistory,
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: "Solicitacao movida para Correcao Pendente.",
        newStatus: "CORRECAO_PENDENTE",
      });
    }

    if (action === "FORCE_APPROVE") {
      if (profile.role !== "MASTER") {
        return NextResponse.json(
          { error: "Apenas o perfil MASTER pode forcar aprovacao." },
          { status: 403 }
        );
      }

      if (card.status !== "VALIDACAO_GESTOR" && card.status !== "CORRECAO_PENDENTE") {
        return NextResponse.json(
          { error: "Status invalido para aprovacao forcada." },
          { status: 400 }
        );
      }

      const nextStageHistory = computeNextStageHistory(
        card.stage_history,
        card.status,
        "VALIDADO_GESTOR",
        user.id,
        card.created_at
      );

      const { error: updateError } = await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "VALIDADO_GESTOR",
          rejection_reason: null,
          stage_history: nextStageHistory,
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: "Aprovacao forcada pelo Master.",
        newStatus: "VALIDADO_GESTOR",
      });
    }

    return NextResponse.json(
      { error: "Acao invalida. Use: APPROVE, REJECT ou FORCE_APPROVE." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[API /payments/validate]", err);
    return NextResponse.json(
      { error: "Erro internão não servidor: " + (err?.message || JSON.stringify(err)) },
      { status: 500 }
    );
  }
}
