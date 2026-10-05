export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@/utils/supabase/server";

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
        email: authUser?.email || "Sem email",
        is_active: !authUser?.banned_until
      };
    });

    return NextResponse.json(merged);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, role, sector, password } = await req.json();

    if (!name || !email || !role) {
      return NextResponse.json({ error: "Faltam campos obrigatórios." }, { status: 400 });
    }

    let userId = null;
    let authUser = null;

    // 1. Tenta criar o usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: password || "Conectsol123",
      email_confirm: true,
    });

    if (authError) {
      // Se o erro for que já existe, tentamos resgatar o usuário órfão
      if (authError.message.includes("already been registered")) {
        // Busca a lista de usuários para encontrar este email
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email === email);
        if (existing) {
          userId = existing.id;
          authUser = existing;
          
          // Verifica se já existe perfil ativo ou inativo
          const { data: existingProfile } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).single();
          if (existingProfile) {
            return NextResponse.json({ error: "Este e-mail já possui um perfil. Se estiver inativo, peça suporte para reativá-lo." }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: authError.message }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    } else {
      userId = authData.user.id;
      authUser = authData.user;
    }

    // 2. Insere o perfil na tabela `profiles`
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          id: userId,
          name,
          role,
          sector: sector || null,
          must_change_password: true
        }
      ]);

    if (profileError) {
      return NextResponse.json({ error: "Erro ao criar perfil: " + profileError.message }, { status: 400 });
    }

    // Se resgatamos um órfão que estava banido, desbanimos
    await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });

    return NextResponse.json({ success: true, user: authUser });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

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

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, role, sector, password, email } = body;
    
    if (!id || !name || !role) {
      return NextResponse.json({ error: "Faltam campos obrigatórios." }, { status: 400 });
    }

    // Alteração de e-mail: somente usuários MASTER (validado no servidor)
    const newEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (newEmail) {
      const supabase = await createClient();
      const { data: { user: caller } } = await supabase.auth.getUser();
      if (!caller) {
        return NextResponse.json({ error: "Não autorizado. Faça login novamente." }, { status: 401 });
      }
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", caller.id)
        .single();
      if (callerProfile?.role !== "MASTER") {
        return NextResponse.json({ error: "Apenas o perfil MASTER pode alterar e-mails." }, { status: 403 });
      }

      const { data: current } = await supabaseAdmin.auth.admin.getUserById(id);
      if (current?.user && current.user.email?.toLowerCase() !== newEmail) {
        const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(id, {
          email: newEmail,
          email_confirm: true,
        });
        if (emailError) {
          return NextResponse.json({ error: "Erro ao atualizar e-mail: " + emailError.message }, { status: 400 });
        }
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ name, role, sector: sector || null })
      .eq("id", id);
      
    if (error) throw error;

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "A senha deve conter no mínimo 6 caracteres." }, { status: 400 });
      }
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password,
      });
      if (authError) throw authError;
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
