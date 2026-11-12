export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/prospectors
export async function GET(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await auth.db
      .from("prospectors")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}

