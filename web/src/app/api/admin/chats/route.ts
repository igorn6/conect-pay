export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authorize } from "@/lib/nubankBalance";

export async function GET(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userId = auth.userId;

    // 1. Buscar chats onde o usuário é participante
    const { data: myParticipants, error: partError } = await auth.db
      .from("chat_participants")
      .select("chat_id")
      .eq("profile_id", userId);

    if (partError) throw partError;

    const chatIds = (myParticipants || []).map((p: any) => p.chat_id);
    if (chatIds.length === 0) {
      return NextResponse.json([]);
    }

    // 2. Buscar todos os participantes desses chats
    const { data: allParticipants, error: allPartError } = await auth.db
      .from("chat_participants")
      .select("chat_id, profile_id")
      .in("chat_id", chatIds);

    if (allPartError) throw allPartError;

    // 3. Buscar perfis de todos os participantes
    const participantIds = [...new Set((allParticipants || []).map((p: any) => p.profile_id))];
    const { data: profiles, error: profError } = await auth.db
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", participantIds);

    if (profError) throw profError;

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // 4. Montar lista de chats enriquecida com última mensagem e não lidas
    const chatList = [];
    for (const chatId of chatIds) {
      const participants = (allParticipants || [])
        .filter((p: any) => p.chat_id === chatId && p.profile_id !== userId)
        .map((p: any) => {
          const prof = profileMap.get(p.profile_id);
          return {
            profile_id: p.profile_id,
            name: prof?.name || "Usuário",
            avatar_url: prof?.avatar_url || null,
          };
        });

      if (participants.length === 0) {
        const myProf = profileMap.get(userId);
        participants.push({
          profile_id: userId,
          name: myProf?.name || "Você",
          avatar_url: myProf?.avatar_url || null,
        });
      }

      // Última mensagem
      const { data: lastMsg } = await auth.db
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Descartar chats sem nenhuma mensagem (não devem aparecer na lista)
      if (!lastMsg) {
        continue;
      }

      // Contagem de não lidas
      const { count: unreadCount } = await auth.db
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chatId)
        .neq("sender_id", userId)
        .is("read_at", null);

      chatList.push({
        id: chatId,
        participants,
        last_message: lastMsg,
        unread_count: unreadCount || 0,
        updated_at: lastMsg.created_at,
      });
    }

    // Ordenar pelo mais recente (da última mensagem mais recente para a primeira enviada)
    chatList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Deduplicar: manter apenas 1 conversa por contato (a mais recente)
    const uniqueChatList: typeof chatList = [];
    const seenContacts = new Set<string>();

    for (const chat of chatList) {
      const otherId = chat.participants.find((p: any) => p.profile_id !== userId)?.profile_id || chat.participants[0]?.profile_id;
      if (!otherId || seenContacts.has(otherId)) {
        continue;
      }
      seenContacts.add(otherId);
      uniqueChatList.push(chat);
    }

    return NextResponse.json(uniqueChatList);
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

    const { targetUserId } = await req.json();
    const userId = auth.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1. Checar se já existe chat comum entre os dois
    const { data: myChats } = await auth.db
      .from("chat_participants")
      .select("chat_id")
      .eq("profile_id", userId);

    const chatIds = (myChats || []).map((c: any) => c.chat_id);
    if (chatIds.length > 0) {
      const { data: otherParts } = await auth.db
        .from("chat_participants")
        .select("chat_id")
        .eq("profile_id", targetUserId)
        .in("chat_id", chatIds);

      if (otherParts && otherParts.length > 0) {
        return NextResponse.json({ success: true, chatId: otherParts[0].chat_id });
      }
    }

    // 2. Se não existe, criar novo chat
    const { data: newChat, error: chatError } = await auth.db
      .from("chats")
      .insert({})
      .select("id")
      .single();

    if (chatError || !newChat) {
      throw chatError || new Error("Failed to create chat");
    }

    const { error: partError } = await auth.db.from("chat_participants").insert([
      { chat_id: newChat.id, profile_id: userId },
      { chat_id: newChat.id, profile_id: targetUserId },
    ]);

    if (partError) {
      throw partError;
    }

    return NextResponse.json({ success: true, chatId: newChat.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
