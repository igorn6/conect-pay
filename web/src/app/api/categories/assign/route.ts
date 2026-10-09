export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId, categoryName } = body;

    if (!requestId || !categoryName || !categoryName.trim()) {
      return NextResponse.json(
        { error: "requestId e categoryName são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanName = categoryName.trim();

    // 1. Verificar se a categoria já existe na tabela categories
    const { data: existingCat, error: fetchError } = await supabaseAdmin
      .from("categories")
      .select("id, name")
      .ilike("name", cleanName)
      .eq("is_deleted", false)
      .limit(1);

    if (fetchError) throw fetchError;

    let catId: string | null = null;
    let isCreated = false;

    if (existingCat && existingCat.length > 0) {
      catId = existingCat[0].id;
    } else {
      // Cria a nova categoria se não existir
      const palette = ["#0ea5e9", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#6366f1", "#14b8a6"];
      const randomColor = palette[Math.floor(Math.random() * palette.length)];

      const { data: newCat, error: insertError } = await supabaseAdmin
        .from("categories")
        .insert({
          name: cleanName,
          color: randomColor,
          is_deleted: false,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      catId = newCat.id;
      isCreated = true;
    }

    // 2. Atualizar o payment_request com a nova categoria e category_id
    const { error: updateError } = await supabaseAdmin
      .from("payment_requests")
      .update({
        category: cleanName,
        category_id: catId,
      })
      .eq("id", requestId);

    if (updateError) throw updateError;

    // 3. Atualizar qualquer sugestão pendente associada a essa despesa ou nome
    await supabaseAdmin
      .from("category_suggestions")
      .update({ status: "APROVADO", updated_at: new Date().toISOString() })
      .or(`sample_request_id.eq.${requestId},name.ilike.${cleanName}`);

    return NextResponse.json({
      success: true,
      message: `Solicitação atualizada para "${cleanName}"!`,
      categoryName: cleanName,
      categoryId: catId,
      createdNewCategory: isCreated,
    });
  } catch (error: any) {
    console.error("Erro ao atribuir categoria:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
