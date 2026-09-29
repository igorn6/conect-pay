import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    let user: any = null;

    // 1. Tentar pegar bearer token do header Authorization se enviado pelo cliente
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const { data: tokenUser } = await supabaseAdmin.auth.getUser(token);
      if (tokenUser?.user) {
        user = tokenUser.user;
      }
    }

    // 2. Se não pegou por Bearer token, tentar pelos cookies de sessão SSR
    if (!user) {
      const cookieStore = await cookies();
      const supabaseUser = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {}
            },
          },
        }
      );

      const { data } = await supabaseUser.auth.getUser();
      if (data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Usar supabaseAdmin para carregar o perfil
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role, sector, must_change_password, avatar_url")
      .eq("id", user.id)
      .single();

    const role = (profile?.role || (user.email === "igornaraujo6@gmail.com" ? "MASTER" : "GESTOR")).trim().toUpperCase();

    const fallbackName = user.user_metadata?.name || user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Usuário");
    const resolvedName = (profile?.name && profile.name.trim() !== "") ? profile.name.trim() : fallbackName;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: resolvedName,
      role: role,
      sector: profile?.sector || null,
      must_change_password: !!profile?.must_change_password,
      avatar_url: profile?.avatar_url || null
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    let user: any = null;

    // 1. Tentar pegar bearer token do header Authorization se enviado pelo cliente
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const { data: tokenUser } = await supabaseAdmin.auth.getUser(token);
      if (tokenUser?.user) {
        user = tokenUser.user;
      }
    }

    // 2. Fallback para cookies
    if (!user) {
      const cookieStore = await cookies();
      const supabaseUser = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {}
            },
          },
        }
      );

      const { data } = await supabaseUser.auth.getUser();
      if (data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, avatar_url } = await req.json();

    const updatePayload: Record<string, any> = {};
    if (typeof name === "string" && name.trim()) {
      updatePayload.name = name.trim();
    }
    if (typeof avatar_url === "string") {
      updatePayload.avatar_url = avatar_url;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    // 1. Atualizar na tabela public.profiles
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Erro update profiles:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Atualizar também nos metadados do Auth do Supabase (user_metadata)
    try {
      if (updatePayload.name) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            name: updatePayload.name,
            full_name: updatePayload.name
          }
        });
      }
    } catch (authErr) {
      console.warn("Aviso ao atualizar auth metadata:", authErr);
    }

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
