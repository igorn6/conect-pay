export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const chatId = url.searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    // 1. Buscar mensagens do chat (bypassa RLS com supabaseAdmin)
    const { data: msgs, error } = await supabaseAdmin
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (!msgs || msgs.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Buscar dados dos remetentes
    const senderIds = [...new Set(msgs.map((m: any) => m.sender_id))];
    const { data: senderProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", senderIds);
    const senderMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));

    // 3. Buscar detalhes de cards anexados se houver
    const cardIds = [...new Set(msgs.filter((m: any) => m.card_request_id).map((m: any) => m.card_request_id))];
    let cardMap = new Map();
    if (cardIds.length > 0) {
      const { data: cards } = await supabaseAdmin
        .from("payment_requests")
        .select("id, title, amount, status")
        .in("id", cardIds);
      cardMap = new Map((cards || []).map((c: any) => [c.id, c]));
    }

    // 4. Enriquecer mensagens
    const enriched = msgs.map((m: any) => {
      const sender = senderMap.get(m.sender_id);
      const card = m.card_request_id ? cardMap.get(m.card_request_id) : null;
      return {
        ...m,
        sender_name: sender?.name || "Usuário",
        sender_avatar: sender?.avatar_url || null,
        card_title: card?.title,
        card_amount: card?.amount,
        card_status: card?.status,
      };
    });

    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { chatId, senderId, text, fileUrl, fileName, fileType, cardRequestId } = await req.json();

    if (!chatId || !senderId) {
      return NextResponse.json({ error: "Missing chatId or senderId" }, { status: 400 });
    }

    // Inserir mensagem usando supabaseAdmin (ignora RLS, prevenindo recursão infinita)
    const { data: newMsg, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        text: text || null,
        file_url: fileUrl || null,
        file_name: fileName || null,
        file_type: fileType || null,
        card_request_id: cardRequestId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting chat message with admin:", error);
      throw error;
    }

    return NextResponse.json({ success: true, message: newMsg });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
