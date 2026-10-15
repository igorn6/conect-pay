export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReceiptHistoryItem, PaymentConversionLog } from "@/types/database";

interface ConvertCajuPixPayload {
  paymentId: string;
  collaboratorPixKey: string;
  reason?: string;
  cajuBalanceWithdrawn: boolean;
  newReceiptUrl: string;
}

export async function POST(req: Request) {
  try {
    // 1. Autenticação estrita de sessão via @supabase/ssr
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autorizado. Faça login novamente." },
        { status: 401 }
      );
    }

    // 2. Verificação de Perfil e RBAC (Apenas MASTER e FINANCEIRO)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Perfil do usuário não encontrado." },
        { status: 403 }
      );
    }

    if (profile.role !== "MASTER" && profile.role !== "FINANCEIRO") {
      return NextResponse.json(
        {
          error:
            "Acesso negado. Apenas perfis MASTER ou FINANCEIRO têm permissão para converter modalidades pós-fechamento.",
        },
        { status: 403 }
      );
    }

    // 3. Validação dos dados do corpo da requisição
    const body: ConvertCajuPixPayload = await req.json();
    const {
      paymentId,
      collaboratorPixKey,
      reason,
      cajuBalanceWithdrawn,
      newReceiptUrl,
    } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "O ID da solicitação (paymentId) é obrigatório." },
        { status: 400 }
      );
    }

    if (!collaboratorPixKey || typeof collaboratorPixKey !== "string" || !collaboratorPixKey.trim()) {
      return NextResponse.json(
        { error: "A Chave Pix ou nome do colaborador recebedor é obrigatória." },
        { status: 400 }
      );
    }

    if (!newReceiptUrl || typeof newReceiptUrl !== "string" || !newReceiptUrl.trim()) {
      return NextResponse.json(
        { error: "O comprovante do Pix anexado é obrigatório." },
        { status: 400 }
      );
    }

    // 4. Buscar a solicitação de pagamento existente
    const { data: card, error: cardError } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Solicitação de pagamento não encontrada." },
        { status: 404 }
      );
    }

    if (card.status !== "FINALIZADO") {
      return NextResponse.json(
        { error: "Esta conversão é exclusiva para solicitações no status FINALIZADO." },
        { status: 400 }
      );
    }

    // 5. Preservar o comprovante antigo no receipts_history
    const receiptsHistory: ReceiptHistoryItem[] = Array.isArray(card.receipts_history)
      ? [...card.receipts_history]
      : [];

    if (card.payment_proof_url) {
      const oldUrls = card.payment_proof_url
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean);

      for (const oldUrl of oldUrls) {
        if (!receiptsHistory.some((r) => r.url === oldUrl)) {
          receiptsHistory.push({
            url: oldUrl,
            uploadedAt: card.updated_at || new Date().toISOString(),
            uploadedBy: card.moved_by || card.created_by || user.id,
          });
        }
      }
    }

    // Adicionar o novo comprovante do Pix como ativo
    const cleanNewReceiptUrl = newReceiptUrl.trim();
    if (!receiptsHistory.some((r) => r.url === cleanNewReceiptUrl)) {
      receiptsHistory.push({
        url: cleanNewReceiptUrl,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
      });
    }

    // 6. Montar o log de conversão
    const conversionLog: PaymentConversionLog = {
      convertedAt: new Date().toISOString(),
      convertedBy: profile.name || user.id,
      originalMethod: card.payment_method || card.payment_type || "CAJU",
      newMethod: "PIX",
      collaboratorPixKey: collaboratorPixKey.trim(),
      cajuBalanceWithdrawn: Boolean(cajuBalanceWithdrawn),
      reason: (reason && reason.trim()) || "Local não aceita Caju / Falha no cartão",
    };

    // 7. Atualizar splits caso existam
    let updatedSplits = card.splits;
    if (Array.isArray(updatedSplits) && updatedSplits.length > 0) {
      updatedSplits = updatedSplits.map((split: any) => {
        const typeStr = String(split.payment_type || "").toUpperCase();
        if (typeStr === "CAJU") {
          return {
            ...split,
            payment_type: "Pix",
            pix_key: collaboratorPixKey.trim(),
            pix_owner: collaboratorPixKey.trim(),
          };
        }
        return split;
      });
    }

    // 8. Atualizar registro no banco (mantendo estritamente FINALIZADO)
    const updatePayload: Record<string, any> = {
      payment_method: "PIX (Convertido de Caju)",
      payment_type: "PIX",
      pix_key: collaboratorPixKey.trim(),
      pix_owner: collaboratorPixKey.trim(),
      payment_proof_url: cleanNewReceiptUrl,
      receipts_history: receiptsHistory,
      payment_conversion_log: conversionLog,
      splits: updatedSplits,
      status: "FINALIZADO", // Mantido sem exigir nota fiscal nem envio para gestor
      updated_at: new Date().toISOString(),
    };

    const { data: updatedCard, error: updateError } = await supabaseAdmin
      .from("payment_requests")
      .update(updatePayload)
      .eq("id", paymentId)
      .select()
      .single();

    if (updateError) {
      console.error("Erro ao atualizar conversão Caju->Pix:", updateError);
      return NextResponse.json(
        { error: "Erro ao salvar a conversão no banco de dados." },
        { status: 500 }
      );
    }

    // 9. Registrar em audit_logs para conformidade e rastreabilidade
    await supabaseAdmin.from("audit_logs").insert({
      request_id: paymentId,
      action: "CONVERSAO_CAJU_PIX",
      performed_by: user.id,
      old_status: "FINALIZADO",
      new_status: "FINALIZADO",
      notes: `Conversão de Caju para Pix realizada por ${profile.name}. Motivo: ${conversionLog.reason}. Saldo Caju retirado: ${cajuBalanceWithdrawn ? "Sim" : "Não"}. Chave Pix: ${collaboratorPixKey.trim()}`,
    });

    return NextResponse.json({
      success: true,
      message: "Conversão de Caju para Pix realizada com sucesso.",
      card: updatedCard,
    });
  } catch (err: any) {
    console.error("Erro interno na rota convert-caju-pix:", err);
    return NextResponse.json(
      { error: err.message || "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
