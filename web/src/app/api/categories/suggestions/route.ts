export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDENTE";

    let query = supabaseAdmin
      .from("category_suggestions")
      .select("*")
      .order("created_at", { ascending: false });

    if (status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Erro ao listar sugestões de categorias:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { suggestionId, action, targetCategoryName } = body;

    if (!suggestionId || !action) {
      return NextResponse.json(
        { error: "suggestionId e action são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Buscar a sugestão
    const { data: suggestion, error: findError } = await supabaseAdmin
      .from("category_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (findError || !suggestion) {
      return NextResponse.json({ error: "Sugestão não encontrada." }, { status: 404 });
    }

    if (action === "APPROVE") {
      const categoryName = suggestion.name.trim();

      // Verificar se a categoria já existe
      const { data: existingCat } = await supabaseAdmin
        .from("categories")
        .select("id, name")
        .ilike("name", categoryName)
        .eq("is_deleted", false)
        .limit(1);

      let catId = existingCat?.[0]?.id;

      if (!catId) {
        // Cores harmoniosas modernas para novas categorias
        const palette = ["#0ea5e9", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#6366f1", "#14b8a6"];
        const randomColor = palette[Math.floor(Math.random() * palette.length)];

        const { data: newCat, error: insertError } = await supabaseAdmin
          .from("categories")
          .insert({
            name: categoryName,
            color: randomColor,
            is_deleted: false,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        catId = newCat.id;
      }

      // Atualizar status da sugestão
      await supabaseAdmin
        .from("category_suggestions")
        .update({ status: "APROVADO", updated_at: new Date().toISOString() })
        .eq("id", suggestionId);

      // Se havia um card associado como amostra, atualiza a categoria dele!
      if (suggestion.sample_request_id) {
        await supabaseAdmin
          .from("payment_requests")
          .update({ category: categoryName, category_id: catId })
          .eq("id", suggestion.sample_request_id);
      }

      return NextResponse.json({
        success: true,
        message: `Categoria "${categoryName}" aprovada e criada com sucesso!`,
        categoryName,
      });
    }

    if (action === "REJECT") {
      await supabaseAdmin
        .from("category_suggestions")
        .update({ status: "REJEITADO", updated_at: new Date().toISOString() })
        .eq("id", suggestionId);

      return NextResponse.json({
        success: true,
        message: `Sugestão "${suggestion.name}" descartada.`,
      });
    }

    if (action === "MERGE") {
      if (!targetCategoryName) {
        return NextResponse.json(
          { error: "targetCategoryName é obrigatório para mesclar." },
          { status: 400 }
        );
      }

      // Buscar id da categoria alvo
      const { data: targetCat } = await supabaseAdmin
        .from("categories")
        .select("id, name")
        .eq("name", targetCategoryName)
        .limit(1);

      const targetId = targetCat?.[0]?.id || null;

      await supabaseAdmin
        .from("category_suggestions")
        .update({ status: "APROVADO", updated_at: new Date().toISOString() })
        .eq("id", suggestionId);

      if (suggestion.sample_request_id) {
        await supabaseAdmin
          .from("payment_requests")
          .update({ category: targetCategoryName, category_id: targetId })
          .eq("id", suggestion.sample_request_id);
      }

      return NextResponse.json({
        success: true,
        message: `Sugestão vinculada à categoria existente "${targetCategoryName}".`,
      });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error: any) {
    console.error("Erro ao processar ação de sugestão de categoria:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
