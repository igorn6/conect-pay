export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    // 2. Buscar perfil do usuario para saber a role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role")
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

    // ========== REGRAS DE NEGOCIO (RBAC) ==========

    if (action === "APPROVE") {
      // Somente o donão (gestor criador/solicitante real) pode validar
      if (card.status !== "VALIDACAO_GESTOR") {
        return NextResponse.json(
          { error: "Status invalido para validacao. Esperado: VALIDACAO_GESTOR." },
          { status: 400 }
        );
      }

      const isOwner =
        user.id === card.created_by || user.id === card.real_requester_id;

      if (!isOwner) {
        return NextResponse.json(
          { error: "Apenas o solicitante original pode validar o pagamento." },
          { status: 403 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "VALIDADO_GESTOR",
          rejection_reason: null,
        })
        .eq("id", paymentId);

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        message: "Pagamento validado pelo gestor.",
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

      const isOwner =
        user.id === card.created_by || user.id === card.real_requester_id;

      if (!isOwner) {
        return NextResponse.json(
          { error: "Apenas o solicitante original pode exigir correcao." },
          { status: 403 }
        );
      }

      if (!reason || !reason.trim()) {
        return NextResponse.json(
          { error: "O motivo da rejeicao e obrigatorio." },
          { status: 400 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "CORRECAO_PENDENTE",
          rejection_reason: reason.trim(),
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

      const { error: updateError } = await supabaseAdmin
        .from("payment_requests")
        .update({
          status: "VALIDADO_GESTOR",
          rejection_reason: null,
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
