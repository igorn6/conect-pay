export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorize } from "@/lib/nubankBalance";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = await props.params;
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const id = params?.id || pathParts[pathParts.length - 1];

    const isMaster = auth.role === "MASTER";
    if (!isMaster && auth.userId !== id) {
      return NextResponse.json(
        { error: "Acesso negado. Você só pode atualizar sua própria senha." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { newPassword, password, mustChangePassword } = body;
    const pwd = newPassword || password;

    if (!id || !pwd) {
      return NextResponse.json(
        { error: "ID do usuário e nova senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (pwd.length < 6) {
      return NextResponse.json(
        { error: "A senha deve conter no mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    // 1. Atualiza senha no Supabase Auth via Admin
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: pwd,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Erro ao atualizar senha no Auth: " + authError.message },
        { status: 400 }
      );
    }

    // 2. Atualiza flag must_change_password no perfil
    const mustChange = isMaster && typeof mustChangePassword === "boolean" ? mustChangePassword : false;
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: mustChange })
      .eq("id", id);

    return NextResponse.json({ success: true, message: "Senha atualizada com sucesso!" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  return PATCH(req, props);
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  return PATCH(req, props);
}
