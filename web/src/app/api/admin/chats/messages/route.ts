export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorize } from "@/lib/nubankBalance";

async function isChatMember(
  db: any,
  chatId: string,
  userId: string
): Promise<boolean> {
  const { data } = await db
    .from("chat_participants")
    .select("chat_id")
    .eq("chat_id", chatId)
    .eq("profile_id", userId)
    .maybeSingle();
  return Boolean(data?.chat_id);
}

export async function GET(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const chatId = url.searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    const member = await isChatMember(auth.db, chatId, auth.userId);
    if (!member) {
      return NextResponse.json({ error: "Acesso negado a esta conversa." }, { status: 403 });
    }

    // 1. Buscar mensagens do chat
    const { data: msgs, error } = await auth.db
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
    const { data: senderProfiles } = await auth.db
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", senderIds);
    const senderMap = new Map((senderProfiles || []).map((p: any) => [p.id, p]));

    // 3. Buscar detalhes de cards anexados se houver
    const cardIds = [...new Set(msgs.filter((m: any) => m.card_request_id).map((m: any) => m.card_request_id))];
    let cardMap = new Map();
    if (cardIds.length > 0) {
      const { data: cards } = await auth.db
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
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { chatId, text, fileUrl, fileName, fileType, cardRequestId } = await req.json();
    const senderId = auth.userId;

    if (!chatId) {
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    const member = await isChatMember(auth.db, chatId, senderId);
    if (!member) {
      return NextResponse.json({ error: "Acesso negado a esta conversa." }, { status: 403 });
    }

    // Inserir mensagem usando auth.db (service_role em produção, authenticated JWT em dev)
    const { data: newMsg, error } = await auth.db
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
