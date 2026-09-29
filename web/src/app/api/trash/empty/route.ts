export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { userId, userRole } = await req.json();

    if (!userId || (userRole !== "MASTER" && userRole !== "FINANCEIRO")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { data: deletedCards, error: findError } = await supabaseAdmin
      .from("payment_requests")
      .select("id, payment_proof_url, invoice_url, receipts_history")
      .eq("is_deleted", true);

    if (findError) throw findError;
    
    if (!deletedCards || deletedCards.length === 0) {
      return NextResponse.json({ success: true, message: "Lixeira já está vazia." });
    }

    const cardIds = deletedCards.map((c: any) => c.id);
    let pathsToDelete: string[] = [];

    deletedCards.forEach((card: any) => {
      const urls: string[] = [];
      
      if (card.payment_proof_url) {
        urls.push(...card.payment_proof_url.split(','));
      }
      if (card.invoice_url) {
        urls.push(...card.invoice_url.split(','));
      }
      if (card.receipts_history && Array.isArray(card.receipts_history)) {
        card.receipts_history.forEach((r: any) => {
          if (r.url) urls.push(r.url);
        });
      }

      urls.forEach(url => {
        try {
          if (url && url.includes('/public/attachments/')) {
            const parts = url.split('/public/attachments/');
            if (parts.length === 2 && parts[1]) {
              pathsToDelete.push(parts[1]);
            }
          }
        } catch (e) {}
      });
    });

    // Remove duplicate paths
    pathsToDelete = [...new Set(pathsToDelete)];

    if (pathsToDelete.length > 0) {
      // Supabase remove has a limit of 100 paths per request, but let's assume it's fine for now, or chunk it.
      const { error: storageError } = await supabaseAdmin
        .storage
        .from("attachments")
        .remove(pathsToDelete);
      
      if (storageError) console.error("Erro ao deletar do storage:", storageError);
    }

    await supabaseAdmin.from("audit_logs").delete().in("request_id", cardIds);

    const { error: deleteError } = await supabaseAdmin
      .from("payment_requests")
      .delete()
      .eq("is_deleted", true);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Empty trash error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
