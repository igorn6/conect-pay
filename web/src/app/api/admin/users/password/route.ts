export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { userId, newPassword, mustChangePassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: "ID do usuário e nova senha são obrigatórios." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "A senha deve conter no mínimo 6 caracteres." }, { status: 400 });
    }

    // 1. Atualiza a senha no Supabase Auth com privilégios de Admin
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (authError) {
      return NextResponse.json({ error: "Erro ao atualizar senha no Auth: " + authError.message }, { status: 400 });
    }

    // 2. Se especificado, atualiza flag must_change_password no perfil
    if (typeof mustChangePassword === "boolean") {
      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: mustChangePassword })
        .eq("id", userId);
    }

    return NextResponse.json({ success: true, message: "Senha atualizada com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno no servidor." }, { status: 500 });
  }
}
