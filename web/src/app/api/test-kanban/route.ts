export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorize } from "@/lib/nubankBalance";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Endpoint desativado em produção." }, { status: 403 });
  }

  const auth = await authorize(["MASTER"], req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await supabaseAdmin
    .from("payment_requests")
    .select(`
      *,
      profiles!payment_requests_real_requester_id_fkey(
        sector
      )
    `)
    .or("is_deleted.eq.false,is_deleted.is.null")
    .limit(1);

  return NextResponse.json({ data, error });
}
