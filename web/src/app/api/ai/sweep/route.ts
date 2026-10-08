export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { categorizeExpenseWithAI } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const apply = Boolean(body.apply);

    // 1. Buscar todas as categorias ativas
    const { data: dbCategories } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .eq("is_deleted", false);

    const categoriesList = (dbCategories || []).map((c: { name: string }) => c.name);
    const categoryMap = new Map((dbCategories || []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id]));

    // 2. Buscar cards em "Outros" ou sem categoria
    const { data: cardsToSweep, error: fetchError } = await supabaseAdmin
      .from("payment_requests")
      .select("id, title, notes, amount, category, ai_category_suggestion")
      .or("category.eq.Outros,category.is.null,category.eq.''")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    if (!cardsToSweep || cardsToSweep.length === 0) {
      return NextResponse.json({
        totalProcessed: 0,
        message: "Nenhuma solicitação encontrada em 'Outros' ou sem categoria.",
        results: [],
      });
    }

    const results = [];

    for (const card of cardsToSweep) {
      const aiResult = await categorizeExpenseWithAI({
        title: card.title || "",
        notes: card.notes || "",
        amount: card.amount,
        existingCategories: categoriesList,
      });

      const chosenCategory = aiResult.is_new_category_suggested
        ? aiResult.suggested_category_name || "Outros"
        : aiResult.category || "Outros";

      results.push({
        id: card.id,
        title: card.title,
        notes: card.notes,
        amount: card.amount,
        currentCategory: card.category || "Outros",
        suggestedCategory: chosenCategory,
        isNewCategory: aiResult.is_new_category_suggested,
        suggestedNewCategoryName: aiResult.suggested_category_name,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
      });

      // Se solicitado aplicar automaticamente
      if (apply) {
        const catId = categoryMap.get(chosenCategory.toLowerCase()) || null;

        // Atualiza a categoria do card
        await supabaseAdmin
          .from("payment_requests")
          .update({
            category: chosenCategory,
            category_id: catId,
            ai_category_suggestion: aiResult,
          })
          .eq("id", card.id);

        // Se for nova categoria, registra em category_suggestions
        if (aiResult.is_new_category_suggested && aiResult.suggested_category_name) {
          const suggestedName = aiResult.suggested_category_name.trim();

          const { data: existingSuggestions } = await supabaseAdmin
            .from("category_suggestions")
            .select("id")
            .ilike("name", suggestedName)
            .eq("status", "PENDENTE")
            .limit(1);

          if (!existingSuggestions || existingSuggestions.length === 0) {
            await supabaseAdmin.from("category_suggestions").insert({
              name: suggestedName,
              reason: aiResult.reason,
              confidence: aiResult.confidence,
              sample_request_id: card.id,
              sample_request_title: card.title,
              status: "PENDENTE",
            });
          }
        }
      }
    }

    return NextResponse.json({
      totalProcessed: results.length,
      applied: apply,
      results,
    });
  } catch (error: any) {
    console.error("Erro na varredura de categorias com IA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
