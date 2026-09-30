"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// ---------- Types ----------
export interface ChatParticipant {
  profile_id: string;
  name: string;
  avatar_url: string | null;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  card_request_id: string | null;
  created_at: string;
  read_at: string | null;
  // joined fields
  sender_name?: string;
  sender_avatar?: string | null;
  // card preview
  card_title?: string;
  card_amount?: number;
  card_status?: string;
}

export interface Chat {
  id: string;
  created_at: string;
  participants: ChatParticipant[];
  last_message?: ChatMessage | null;
  unread_count: number;
}

// Pending card attachment (like WhatsApp "reply")
export interface PendingCardAttachment {
  requestId: string;
  title: string;
  amount: number;
  status: string;
}

interface ChatContextType {
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  chats: Chat[];
  messages: ChatMessage[];
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (text: string, file?: File | null, cardRequestId?: string | null) => Promise<void>;
  startChat: (targetUserId: string) => Promise<string>;
  pendingCard: PendingCardAttachment | null;
  setPendingCard: (card: PendingCardAttachment | null) => void;
  allProfiles: { id: string; name: string; avatar_url: string | null }[];
  totalUnread: number;
  openChatWithCard: (targetUserId: string, card: PendingCardAttachment) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { userId, userName } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingCard, setPendingCard] = useState<PendingCardAttachment | null>(null);
  const [allProfiles, setAllProfiles] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const subscriptionRef = useRef<any>(null);

  // Load all profiles for contact list
  useEffect(() => {
    if (!userId) return;
    fetch("/api/admin/users")
      .then(res => res.json())
      .then(data => {
         if (Array.isArray(data)) {
             const profiles = data.filter((u) => u.id !== userId).map((u) => ({
                 id: u.id,
                 name: u.name,
                 avatar_url: u.avatar_url
             }));
             setAllProfiles(profiles);
         }
      })
      .catch(err => console.error("Erro ao carregar contatos:", err));
  }, [userId]);

  // Load user chats
  const loadChats = useCallback(async () => {
    if (!userId) return;

    const { data: participantRows } = await supabase
      .from("chat_participants")
      .select("chat_id")
      .eq("profile_id", userId);

    if (!participantRows || participantRows.length === 0) {
      setChats([]);
      setTotalUnread(0);
      return;
    }

    const chatIds = participantRows.map((r) => r.chat_id);

    const { data: allParticipants } = await supabase
      .from("chat_participants")
      .select("chat_id, profile_id")
      .in("chat_id", chatIds);

    const participantIds = [...new Set((allParticipants || []).map((p) => p.profile_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, avatar_url")
      .in("id", participantIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const chatList: Chat[] = [];
    let unread = 0;

    for (const chatId of chatIds) {
      const chatParticipants = (allParticipants || [])
        .filter((p) => p.chat_id === chatId && p.profile_id !== userId)
        .map((p) => {
          const prof = profileMap.get(p.profile_id);
          return {
            profile_id: p.profile_id,
            name: prof?.name || "Usuario",
            avatar_url: prof?.avatar_url || null,
          };
        });

      const { data: lastMsg } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("chat_id", chatId)
        .neq("sender_id", userId)
        .is("read_at", null);

      unread += count || 0;

      chatList.push({
        id: chatId,
        created_at: lastMsg?.created_at || "",
        participants: chatParticipants,
        last_message: lastMsg || null,
        unread_count: count || 0,
      });
    }

    chatList.sort((a, b) => {
      const ta = a.last_message?.created_at || a.created_at;
      const tb = b.last_message?.created_at || b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    setChats(chatList);
    setTotalUnread(unread);
  }, [userId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!chatId) return;

      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (!data) return;

      const senderIds = [...new Set(data.map((m) => m.sender_id))];
      const { data: senderProfiles } = await supabase
        .from("profiles")
        .select("id, name, avatar_url")
        .in("id", senderIds);
      const senderMap = new Map((senderProfiles || []).map((p) => [p.id, p]));

      const cardIds = [...new Set(data.filter((m) => m.card_request_id).map((m) => m.card_request_id!))];
      let cardMap = new Map<string, any>();
      if (cardIds.length > 0) {
        const { data: cards } = await supabase
          .from("payment_requests")
          .select("id, title, amount, status")
          .in("id", cardIds);
        cardMap = new Map((cards || []).map((c) => [c.id, c]));
      }

      const enriched: ChatMessage[] = data.map((m) => {
        const sender = senderMap.get(m.sender_id);
        const card = m.card_request_id ? cardMap.get(m.card_request_id) : null;
        return {
          ...m,
          sender_name: sender?.name || "Usuario",
          sender_avatar: sender?.avatar_url || null,
          card_title: card?.title,
          card_amount: card?.amount,
          card_status: card?.status,
        };
      });

      setMessages(enriched);

      await supabase
        .from("chat_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .neq("sender_id", userId!)
        .is("read_at", null);

      loadChats();
    },
    [userId, loadChats]
  );

  // Realtime
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.chat_id === activeChatId && activeChatId) {
            loadMessages(activeChatId);
          }
          loadChats();
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeChatId, loadMessages, loadChats]);

  const sendMessage = useCallback(
    async (text: string, file?: File | null, cardRequestId?: string | null) => {
      if (!userId || !activeChatId) return;

      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;

      if (file) {
        const path = `${activeChatId}/${Date.now()}_${file.name}`;
        const { data: uploadData, error } = await supabase.storage
          .from("chat_attachments")
          .upload(path, file);

        if (!error && uploadData) {
          const { data: urlData } = supabase.storage
            .from("chat_attachments")
            .getPublicUrl(uploadData.path);
          fileUrl = urlData.publicUrl;
          fileName = file.name;
          fileType = file.type;
        }
      }

      await supabase.from("chat_messages").insert({
        chat_id: activeChatId,
        sender_id: userId,
        text: text || null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        card_request_id: cardRequestId || null,
      });

      setPendingCard(null);
    },
    [userId, activeChatId]
  );

  const startChat = useCallback(
      async (targetUserId: string): Promise<string> => {
        if (!userId) throw new Error("Not authenticated");

        const { data: myChats } = await supabase
          .from("chat_participants")
          .select("chat_id")
          .eq("profile_id", userId);

        const chatIds = (myChats || []).map((c) => c.chat_id);
        let commonChatId = null;

        if (chatIds.length > 0) {
          const { data: allParticipants } = await supabase
            .from("chat_participants")
            .select("chat_id, profile_id")
            .in("chat_id", chatIds);
          
          commonChatId = (allParticipants || []).find(p => p.profile_id === targetUserId)?.chat_id;
        }

        if (commonChatId) return commonChatId;

        // Try to insert directly
        const { data: newChat, error: chatError } = await supabase
          .from("chats")
          .insert({})
          .select("id")
          .single();

        if (!newChat || chatError) {
            // Fallback to API if RLS blocks insert
            const res = await fetch("/api/admin/chats", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ userId, targetUserId })
            });
            const data = await res.json();
            if (data.chatId) {
                await loadChats();
                return data.chatId;
            }
            throw new Error("Failed to create chat via API");
        }

        const { error: partError } = await supabase.from("chat_participants").insert([
          { chat_id: newChat.id, profile_id: userId },
          { chat_id: newChat.id, profile_id: targetUserId },
        ]);

        if (partError) {
             console.error("Error creating participants:", partError);
             // Fallback to API if RLS blocks participant insert
             const res = await fetch("/api/admin/chats", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ userId, targetUserId })
             });
             const data = await res.json();
             if (data.chatId) {
                 await loadChats();
                 return data.chatId;
             }
        }

        await loadChats();
        return newChat.id;
      },
      [userId, loadChats]
    );

  const openChatWithCard = useCallback(
    (targetUserId: string, card: PendingCardAttachment) => {
      setPendingCard(card);
      setIsChatOpen(true);
      startChat(targetUserId).then((chatId) => {
        setActiveChatId(chatId);
      });
    },
    [startChat]
  );

  return (
    <ChatContext.Provider
      value={{
        isChatOpen,
        setIsChatOpen,
        activeChatId,
        setActiveChatId,
        chats,
        messages,
        loadChats,
        loadMessages,
        sendMessage,
        startChat,
        pendingCard,
        setPendingCard,
        allProfiles,
        totalUnread,
        openChatWithCard,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}

