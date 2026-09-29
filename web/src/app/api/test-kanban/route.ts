export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
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
