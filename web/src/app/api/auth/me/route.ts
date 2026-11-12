import { NextResponse } from "next/server";
import { hasServiceRoleKey, supabaseAdmin } from "@/lib/supabaseAdmin";
import { getVerifiedSessionContext } from "@/lib/nubankBalance";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getVerifiedSessionContext(req);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, db } = session;

    const { data: profile } = await db
      .from("profiles")
      .select("id, name, role, sector, must_change_password, avatar_url")
      .eq("id", user.id)
      .single();

    const role = (profile?.role || (user.email === "igornaraujo6@gmail.com" ? "MASTER" : "GESTOR")).trim().toUpperCase();

    const fallbackName = user.user_metadata?.name || user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "Usuário");
    const resolvedName = (profile?.name && profile.name.trim() !== "") ? profile.name.trim() : fallbackName;

    let resolvedSectorName: string | null = null;
    if (profile?.sector) {
      const { data: sec } = await db
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
    const session = await getVerifiedSessionContext(req);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, db, userSupabase } = session;
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

    const { data: updated, error: updateError } = await db
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
        if (hasServiceRoleKey) {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: {
              ...user.user_metadata,
              name: updatePayload.name,
              full_name: updatePayload.name
            }
          });
        } else {
          await userSupabase.auth.updateUser({
            data: {
              ...user.user_metadata,
              name: updatePayload.name,
              full_name: updatePayload.name,
            },
          });
        }
      }
    } catch (authErr) {
      console.warn("Aviso ao atualizar auth metadata:", authErr);
    }

    return NextResponse.json({ success: true, profile: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
