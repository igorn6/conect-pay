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

    try {
      const res = await fetch(`/api/admin/chats?userId=${userId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Erro ao carregar chats");
      const chatList: Chat[] = await res.json();
      
      let unread = 0;
      for (const c of chatList) {
        unread += c.unread_count || 0;
      }

      setChats(chatList);
      setTotalUnread(unread);
    } catch (err) {
      console.error("Erro ao carregar chats via API:", err);
    }
  }, [userId]);

  useEffect(() => {
    loadChats();
  }, [loadChats, allProfiles, userName]);

  // Helper de som para mensagens recebidas
  const playMessageSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // AudioContext bloqueado ou não suportado
    }
  }, []);

  const loadMessages = useCallback(
    async (chatId: string) => {
      if (!chatId) return;

      try {
        const res = await fetch(`/api/admin/chats/messages?chatId=${chatId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Erro ao carregar mensagens");
        const enriched: ChatMessage[] = await res.json();
        setMessages(enriched);

        // Marca como lidas em background sem travar a interface
        supabase
          .from("chat_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("chat_id", chatId)
          .neq("sender_id", userId!)
          .is("read_at", null)
          .then(() => loadChats());
      } catch (err) {
        console.error("Erro ao carregar mensagens via API:", err);
      }
    },
    [userId, loadChats]
  );

  // Realtime
  useEffect(() => {
    if (!userId) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

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

          // Notificar caso a mensagem seja de outro usuário
          if (newMsg.sender_id !== userId) {
            playMessageSound();
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Nova mensagem no Chat", {
                body: newMsg.text || (newMsg.file_name ? `Arquivo: ${newMsg.file_name}` : "Solicitação anexada"),
                icon: "/icon.png",
              });
            }
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, activeChatId, loadMessages, loadChats, playMessageSound]);

  const sendMessage = useCallback(
    async (text: string, file?: File | null, cardRequestId?: string | null) => {
      if (!userId || !activeChatId) return;

      // Adiciona mensagem instantaneamente na tela (Optimistic UI)
      const tempId = "temp-" + Date.now();
      const optimisticMsg: ChatMessage = {
        id: tempId,
        chat_id: activeChatId,
        sender_id: userId,
        text: text || null,
        file_url: null,
        file_name: file ? file.name : null,
        file_type: file ? file.type : null,
        card_request_id: cardRequestId || null,
        created_at: new Date().toISOString(),
        read_at: null,
        card_title: pendingCard?.title,
        card_amount: pendingCard?.amount,
        card_status: pendingCard?.status,
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setPendingCard(null);

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

      try {
        const res = await fetch("/api/admin/chats/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: activeChatId,
            senderId: userId,
            text: text || null,
            fileUrl,
            fileName,
            fileType,
            cardRequestId: cardRequestId || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao enviar mensagem");

        await loadMessages(activeChatId);
        loadChats();
      } catch (sendErr: any) {
        console.error("Error sending message via API:", sendErr);
        // Remove mensagem otimista em caso de erro
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert("Erro ao enviar mensagem: " + sendErr.message);
      }
    },
    [userId, activeChatId, loadMessages, loadChats, pendingCard]
  );

  const startChat = useCallback(
    async (targetUserId: string): Promise<string> => {
      if (!userId) throw new Error("Not authenticated");

      try {
        const res = await fetch("/api/admin/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, targetUserId }),
        });

        const data = await res.json();
        if (!res.ok || !data.chatId) {
          throw new Error(data.error || "Failed to create chat via API");
        }

        await loadChats();
        return data.chatId;
      } catch (err: any) {
        console.error("Erro ao iniciar chat via API:", err);
        throw err;
      }
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

