export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorize } from "@/lib/nubankBalance";

export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { userId, newPassword, mustChangePassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: "ID do usuário e nova senha são obrigatórios." }, { status: 400 });
    }

    const isMaster = auth.role === "MASTER";
    if (!isMaster && auth.userId !== userId) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas MASTER pode alterar a senha de outros usuários." },
        { status: 403 }
      );
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
      const targetFlag = isMaster ? mustChangePassword : false;
      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: targetFlag })
        .eq("id", userId);
    }

    return NextResponse.json({ success: true, message: "Senha atualizada com sucesso!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno no servidor." }, { status: 500 });
  }
}
