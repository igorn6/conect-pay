export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { categorizeExpenseWithAI } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, notes, amount, saveSuggestion, requestId } = body;

    if (!title && !notes) {
      return NextResponse.json(
        { error: "Informe ao menos o título ou a descrição da solicitação." },
        { status: 400 }
      );
    }

    // 1. Buscar categorias ativas no sistema
    const { data: dbCategories } = await supabaseAdmin
      .from("categories")
      .select("name")
      .eq("is_deleted", false);

    const existingCategories = (dbCategories || []).map((c: { name: string }) => c.name);

    // 2. Classificar com a IA Gemini
    const result = await categorizeExpenseWithAI({
      title: title || "",
      notes: notes || "",
      amount: amount ? Number(amount) : null,
      existingCategories,
    });

    // 3. Se sugeriu nova categoria e deve salvar para aprovação do Master
    if (result.is_new_category_suggested && result.suggested_category_name && saveSuggestion) {
      const suggestedName = result.suggested_category_name.trim();

      // Verificar se já não existe uma sugestão pendente com esse nome
      const { data: existingSuggestions } = await supabaseAdmin
        .from("category_suggestions")
        .select("id, status")
        .ilike("name", suggestedName)
        .eq("status", "PENDENTE")
        .limit(1);

      if (!existingSuggestions || existingSuggestions.length === 0) {
        await supabaseAdmin.from("category_suggestions").insert({
          name: suggestedName,
          reason: result.reason,
          confidence: result.confidence,
          sample_request_id: requestId || null,
          sample_request_title: title || null,
          status: "PENDENTE",
        });
      }

      // Se temos o ID do request, gravar também a sugestão no card
      if (requestId) {
        await supabaseAdmin
          .from("payment_requests")
          .update({ ai_category_suggestion: result })
          .eq("id", requestId);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Erro na API de categorização com IA:", error);
    return NextResponse.json(
      { error: error.message || "Falha ao categorizar com IA" },
      { status: 500 }
    );
  }
}
