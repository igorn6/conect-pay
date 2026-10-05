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
      try {
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
      } catch (cookieErr) {
        console.warn("Cookie auth error:", cookieErr);
      }
    }

    // 3. Fallback: Se não encontrou por token ou cookie, checar header x-user-id ou query param userId
    if (!user) {
      const url = new URL(req.url);
      const headerUserId = req.headers.get("x-user-id");
      const paramUserId = url.searchParams.get("userId");
      const targetId = headerUserId || paramUserId;

      if (targetId) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetId);
        if (authUser?.user) {
          user = authUser.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Usar supabaseAdmin para carregar o perfil sem bloqueio de RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role, sector, must_change_password, avatar_url")
      .eq("id", user.id)
      .single();

    const role = (profile?.role || (user.email === "igornaraujo6@gmail.com" ? "MASTER" : "GESTOR")).trim().toUpperCase();

    const fallbackName = user.user_metadata?.name || user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Usuário");
    const resolvedName = (profile?.name && profile.name.trim() !== "") ? profile.name.trim() : fallbackName;

    let resolvedSectorName: string | null = null;
    if (profile?.sector) {
      const { data: sec } = await supabaseAdmin
        .from("sectors")
        .select("name")
        .eq("id", profile.sector)
        .maybeSingle();

      resolvedSectorName = sec?.name || profile.sector;
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: resolvedName,
      role: role,
      sector: profile?.sector || null,
      sector_name: resolvedSectorName,
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

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const { data: tokenUser } = await supabaseAdmin.auth.getUser(token);
      if (tokenUser?.user) {
        user = tokenUser.user;
      }
    }

    if (!user) {
      try {
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
      } catch {}
    }

    if (!user) {
      const url = new URL(req.url);
      const headerUserId = req.headers.get("x-user-id");
      const paramUserId = url.searchParams.get("userId");
      const targetId = headerUserId || paramUserId;

      if (targetId) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetId);
        if (authUser?.user) {
          user = authUser.user;
        }
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
