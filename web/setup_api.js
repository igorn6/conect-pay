const fs = require("fs");
const path = require("path");
const apiPath = path.join(__dirname, "src/app/api");

if (!fs.existsSync(path.join(apiPath, "admin"))) {
  fs.mkdirSync(path.join(apiPath, "admin"));
}
if (!fs.existsSync(path.join(apiPath, "admin", "users"))) {
  fs.mkdirSync(path.join(apiPath, "admin", "users"));
}

const newRoutePath = path.join(apiPath, "admin", "users", "route.ts");

const routeContent = `import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const { data: profiles, error: profilesError } = await supabaseAdmin.from("profiles").select("*").order("name");
    if (profilesError) throw profilesError;

    const merged = profiles.map((p: any) => {
      const authUser = authData.users.find((u: any) => u.id === p.id);
      return {
        ...p,
        email: authUser?.email || "Sem email"
      };
    });

    return NextResponse.json(merged);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, role } = await req.json();

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Faltam campos obrigat\u00f3rios." }, { status: 400 });
    }

    // 1. Cria o usu\u00e1rio no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "Conectsol123",
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Insere o perfil na tabela \`profiles\`
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: userId,
          name,
          role,
          is_active: true,
          must_change_password: true
        }
      ]);

    if (profileError) {
      return NextResponse.json({ error: "Erro ao criar perfil: " + profileError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user: authData.user });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID inv\u00e1lido" }, { status: 400 });

    // 1. Atualiza na tabela p\u00fablica (Soft Delete)
    const { error: dbError } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: false })
      .eq("id", id);
      
    if (dbError) throw dbError;

    // 2. Bane do Auth (bloqueia o login via update user ban_duration)
    // O Supabase tem auth.admin.updateUserById({ id, ban_duration: '876000h' }) ou similar
    // Um m\u00e9todo robusto \u00e9 simplesmente usar updateUserById
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { ban_duration: '876000h' } // Banne por 100 anos
    );

    if (authError) throw authError;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
`;

fs.writeFileSync(newRoutePath, routeContent, "utf-8");

// Remove a pasta antiga
fs.rmSync(path.join(apiPath, "users"), { recursive: true, force: true });
console.log("Moved and updated API route.");
