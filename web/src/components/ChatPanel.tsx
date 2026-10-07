"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  ArrowLeft,
  Send,
  Paperclip,
  Search,
  MessageSquare,
  FileText,
  DollarSign,
  Check,
  CheckCheck,
  Download,
  ExternalLink,
} from "lucide-react";
import { useChat, type Chat, type ChatMessage, type PendingCardAttachment } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import CardDetailModal from "@/components/CardDetailModal";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest } from "@/types/database";

// ---------- Status labels ----------
const STATUS_LABELS: Record<string, string> = {
  NOVA_SOLICITACAO: "Nova",
  EM_APROVACAO: "Em Aprovação",
  AGUARDANDO_PAGAMENTO: "Aguardando Pgto",
  VALIDADO_GESTOR: "Validado",
  VALIDACAO_GESTOR: "Em Validação",
  CORRECAO_PENDENTE: "Correção",
  FINALIZADO: "Finalizado",
  RECUSADO: "Recusado",
};

const STATUS_COLORS: Record<string, string> = {
  NOVA_SOLICITACAO: "#3b82f6",
  EM_APROVACAO: "#f59e0b",
  AGUARDANDO_PAGAMENTO: "#8b5cf6",
  VALIDADO_GESTOR: "#10b981",
  VALIDACAO_GESTOR: "#06b6d4",
  CORRECAO_PENDENTE: "#ef4444",
  FINALIZADO: "#10b981",
  RECUSADO: "#ef4444",
};

function getAvatarUrl(name: string, avatarUrl?: string | null): string {
  if (avatarUrl) return avatarUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=10b981&color=fff&size=40`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ==================== CARD PREVIEW BUBBLE ====================
function CardPreview({ title, amount, status, onClick }: {
  title?: string;
  amount?: number;
  status?: string;
  onClick?: () => void;
}) {
  const color = STATUS_COLORS[status || ""] || "#6b7280";
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all mb-1 group"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
      }}
      title="Clique para abrir a solicitação"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}30` }}
      >
        <DollarSign size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate group-hover:underline" style={{ color: "var(--text-primary)" }}>
          {title || "Solicitação"}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-bold" style={{ color }}>
            {amount != null ? `R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${color}25`, color }}
          >
            {STATUS_LABELS[status || ""] || status}
          </span>
        </div>
      </div>
      <ExternalLink size={14} className="opacity-60 group-hover:opacity-100 transition-opacity shrink-0" style={{ color }} />
    </div>
  );
}

// ==================== PENDING CARD BANNER (reply style) ====================
function PendingCardBanner({ card, onRemove }: { card: PendingCardAttachment; onRemove: () => void }) {
  const color = STATUS_COLORS[card.status] || "#6b7280";
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold" style={{ color }}>
          Solicitação anexada
        </p>
        <p className="text-xs truncate font-medium" style={{ color: "var(--text-primary)" }}>
          {card.title}
        </p>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          R$ {card.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded-full hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        style={{ color: "var(--text-secondary)" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ==================== MESSAGE BUBBLE ====================
function MessageBubble({
  msg,
  isMine,
  onCardClick,
}: {
  msg: ChatMessage;
  isMine: boolean;
  onCardClick?: (cardRequestId: string) => void;
}) {
  const isImage = msg.file_type?.startsWith("image/");
  
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2 px-4`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
          isMine
            ? "rounded-br-xs"
            : "rounded-bl-xs"
        }`}
        style={{
          backgroundColor: isMine ? "#059669" : "var(--bg-card)",
          border: isMine ? "none" : "1px solid var(--surface-border)",
        }}
      >
        {/* Card attachment inside message */}
        {msg.card_request_id && msg.card_title && (
          <CardPreview
            title={msg.card_title}
            amount={msg.card_amount}
            status={msg.card_status}
            onClick={() => onCardClick?.(msg.card_request_id!)}
          />
        )}

        {/* File attachment */}
        {msg.file_url && (
          <div className="mb-1">
            {isImage ? (
              <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={msg.file_url}
                  alt={msg.file_name || ""}
                  className="max-w-full rounded-lg max-h-48 object-cover"
                />
              </a>
            ) : (
              <a
                href={msg.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2.5 rounded-lg border transition-colors"
                style={{
                  borderColor: isMine ? "rgba(255,255,255,0.2)" : "var(--surface-border)",
                  backgroundColor: isMine ? "rgba(0,0,0,0.15)" : "var(--bg-secondary)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "rgba(16,185,129,0.15)",
                  }}
                >
                  <FileText size={16} style={{ color: isMine ? "#ffffff" : "#10b981" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: isMine ? "#ffffff" : "var(--text-primary)" }}
                  >
                    {msg.file_name}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: isMine ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                  >
                    Documento
                  </p>
                </div>
                <Download
                  size={14}
                  style={{ color: isMine ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                />
              </a>
            )}
          </div>
        )}

        {/* Text */}
        {msg.text && (
          <p
            className="text-sm whitespace-pre-wrap break-words leading-relaxed"
            style={{ color: isMine ? "#ffffff" : "var(--text-primary)" }}
          >
            {msg.text}
          </p>
        )}

        {/* Timestamp + read status */}
        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          <span
            className="text-[10px]"
            style={{ color: isMine ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
          >
            {formatTime(msg.created_at)}
          </span>
          {isMine && (
            msg.read_at
              ? <CheckCheck size={12} style={{ color: "#a7f3d0" }} />
              : <Check size={12} style={{ color: "rgba(255,255,255,0.6)" }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== CHAT LIST VIEW ====================
function ChatListView({ onSelectChat, onNewChat }: {
  onSelectChat: (chat: Chat) => void;
  onNewChat: () => void;
}) {
  const { chats } = useChat();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    // Filtrar apenas conversas que possuem mensagens (não exibir as que não têm msg)
    const withMessages = chats.filter((c) => Boolean(c.last_message));

    // Ordenar da última mensagem enviada (mais recente) para a primeira enviada (mais antiga)
    const sorted = [...withMessages].sort((a, b) => {
      const timeA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
      const timeB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
      return timeB - timeA;
    });

    if (!search.trim()) return sorted;
    const s = search.toLowerCase();
    return sorted.filter((c) =>
      c.participants.some((p) => p.name.toLowerCase().includes(s))
    );
  }, [chats, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:border-emerald-500/50"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-4 pb-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer transition-all hover:brightness-110 shadow-sm"
          style={{
            background: "linear-gradient(135deg, #059669, #10b981)",
          }}
        >
          <MessageSquare size={16} />
          Nova Conversa
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40"
            style={{ color: "var(--text-muted)" }}
          >
            <MessageSquare size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          filtered.map((chat) => {
            const other = chat.participants[0];
            const lastText =
              chat.last_message?.text ||
              (chat.last_message?.file_name
                ? "Arquivo"
                : chat.last_message?.card_request_id
                ? "Solicitação"
                : "");
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors text-left border-b cursor-pointer"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <img
                  src={getAvatarUrl(other?.name || "", other?.avatar_url)}
                  alt=""
                  className="w-10 h-10 rounded-full shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {other?.name || "Usuário"}
                    </p>
                    {chat.last_message && (
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                        {formatDate(chat.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                      {lastText || "Sem mensagens"}
                    </p>
                    {chat.unread_count > 0 && (
                      <span className="ml-2 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ==================== CONTACT PICKER ====================
function ContactPicker({ onSelect, onBack }: {
  onSelect: (profileId: string) => void;
  onBack: () => void;
}) {
  const { allProfiles } = useChat();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return allProfiles;
    const s = search.toLowerCase();
    return allProfiles.filter((p) => p.name.toLowerCase().includes(s));
  }, [allProfiles, search]);

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Nova Conversa
        </h3>
      </div>
      <div className="px-4 py-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:border-emerald-500/50"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--surface-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-40"
            style={{ color: "var(--text-muted)" }}
          >
            <p className="text-sm font-medium">Nenhum contato encontrado</p>
          </div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors text-left border-b cursor-pointer"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <img
                src={getAvatarUrl(p.name, p.avatar_url)}
                alt=""
                className="w-10 h-10 rounded-full shrink-0 object-cover"
              />
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {p.name}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ==================== CONVERSATION VIEW ====================
function ConversationView({ chatId, onBack, onCardClick }: {
  chatId: string;
  onBack: () => void;
  onCardClick: (cardRequestId: string) => void;
}) {
  const { messages, loadMessages, sendMessage, pendingCard, setPendingCard, chats, allProfiles, activeTargetUserId } = useChat();
  const { userId } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chat = chats.find((c) => c.id === chatId);
  const otherParticipant = chat?.participants?.find((p) => p.profile_id !== userId) || chat?.participants?.[0];
  const otherFromMessages = messages.find((m) => m.sender_id !== userId);

  // Fallback to activeTargetUserId or allProfiles if chat participant was not enriched yet
  const fallbackProfileId =
    otherParticipant?.profile_id ||
    activeTargetUserId ||
    (otherFromMessages?.sender_id !== userId ? otherFromMessages?.sender_id : null);

  const otherProfile = fallbackProfileId
    ? allProfiles.find((p) => p.id === fallbackProfileId)
    : null;

  const resolvedName =
    otherParticipant?.name ||
    otherProfile?.name ||
    otherFromMessages?.sender_name ||
    "Conversa";
  const resolvedAvatar =
    otherParticipant?.avatar_url ||
    otherProfile?.avatar_url ||
    otherFromMessages?.sender_avatar ||
    null;

  useEffect(() => {
    loadMessages(chatId);
  }, [chatId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const textToSend = text.trim();
    const fileToSend = file;
    const cardToSend = pendingCard?.requestId || null;

    if ((!textToSend && !fileToSend && !cardToSend) || sending) return;

    // Limpa a barra de digitação imediatamente no mesmo milissegundo (estilo WhatsApp)
    setText("");
    setFile(null);
    setSending(true);

    try {
      await sendMessage(textToSend, fileToSend, cardToSend);
    } catch (err) {
      // Se ocorrer falha no envio, restaura o texto para não perder o que foi digitado
      setText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const grouped = useMemo(() => {
    const groups: { date: string; msgs: ChatMessage[] }[] = [];
    let currentDate = "";
    for (const msg of messages) {
      const d = formatDate(msg.created_at);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, msgs: [] });
      }
      groups[groups.length - 1].msgs.push(msg);
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
        style={{
          borderColor: "var(--surface-border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={18} />
        </button>
        <img
          src={getAvatarUrl(resolvedName, resolvedAvatar)}
          alt=""
          className="w-9 h-9 rounded-full shrink-0 object-cover"
        />
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {resolvedName}
          </p>
          <p className="text-[11px] text-emerald-500 font-medium">online</p>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto py-3 space-y-1"
        style={{
          backgroundColor: "var(--bg-primary)",
        }}
      >
        {grouped.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-48 opacity-60"
            style={{ color: "var(--text-muted)" }}
          >
            <MessageSquare size={36} className="mb-2" />
            <p className="text-xs">Nenhuma mensagem ainda</p>
            <p className="text-[11px]">Diga um olá para iniciar!</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span
                  className="text-[11px] px-3 py-0.5 rounded-full border shadow-xs"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-muted)",
                  }}
                >
                  {group.date}
                </span>
              </div>
              {group.msgs.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isMine={msg.sender_id === userId}
                  onCardClick={onCardClick}
                />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pending card banner */}
      {pendingCard && (
        <PendingCardBanner card={pendingCard} onRemove={() => setPendingCard(null)} />
      )}

      {/* File preview */}
      {file && (
        <div
          className="flex items-center gap-2 px-4 py-2 border-t"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--bg-card)",
          }}
        >
          <FileText size={14} className="text-emerald-500" />
          <span className="text-xs truncate flex-1 font-medium" style={{ color: "var(--text-primary)" }}>
            {file.name}
          </span>
          <button
            onClick={() => setFile(null)}
            className="hover:opacity-75 transition-opacity cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className="flex items-end gap-2 px-3 py-3 border-t shrink-0"
        style={{
          borderColor: "var(--surface-border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) setFile(e.target.files[0]);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors shrink-0 cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
          title="Anexar arquivo"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="flex-1 px-3 py-2 text-sm rounded-xl border focus:outline-none focus:border-emerald-500/50 resize-none max-h-24"
          style={{
            minHeight: "38px",
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--surface-border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && !file && !pendingCard)}
          className="p-2 rounded-lg transition-all shrink-0 disabled:opacity-30 cursor-pointer"
          style={{
            backgroundColor: text.trim() || file || pendingCard ? "#059669" : "transparent",
            color: text.trim() || file || pendingCard ? "#ffffff" : "var(--text-muted)",
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

// ==================== MAIN CHAT PANEL ====================
export default function ChatPanel() {
  const { userId, userName, userRole } = useAuth();
  const { isChatOpen, setIsChatOpen, activeChatId, setActiveChatId, startChat, setActiveTargetUserId, allProfiles, loadMessages } = useChat();
  const [view, setView] = useState<"list" | "contacts" | "conversation">("list");
  const [viewingCard, setViewingCard] = useState<PaymentRequest | null>(null);

  const profilesMap = useMemo(() => {
    const map: Record<string, string> = {};
    (allProfiles || []).forEach((p) => {
      map[p.id] = p.name;
    });
    if (userId && userName) {
      map[userId] = userName;
    }
    return map;
  }, [allProfiles, userId, userName]);

  // Sync view with activeChatId
  useEffect(() => {
    if (activeChatId) {
      setView("conversation");
    }
  }, [activeChatId]);

  const handleCardClick = async (cardRequestId: string) => {
    if (!cardRequestId) return;

    // Se estiver na tela de kanban, rola suavemente até o card e destaca com borda/glow
    const cardElem = document.getElementById(`kanban-card-${cardRequestId}`);
    if (cardElem) {
      cardElem.scrollIntoView({ behavior: "smooth", block: "center" });
      cardElem.style.transition = "all 0.4s ease";
      cardElem.style.transform = "scale(1.03)";
      cardElem.style.boxShadow = "0 0 0 3px #10b981, 0 10px 25px -5px rgba(0,0,0,0.5)";
      setTimeout(() => {
        cardElem.style.transform = "";
        cardElem.style.boxShadow = "";
      }, 2500);
    }

    try {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*")
        .eq("id", cardRequestId)
        .single();

      if (data) {
        setViewingCard(data);
      } else {
        alert("Solicitação não encontrada.");
      }
    } catch (err) {
      console.error("Erro ao abrir solicitação:", err);
    }
  };

  const handleSelectChat = (chat: Chat) => {
    const other = chat.participants.find((p) => p.profile_id !== userId) || chat.participants[0];
    if (other?.profile_id) {
      setActiveTargetUserId(other.profile_id);
    }
    setActiveChatId(chat.id);
    setView("conversation");
  };

  const handleNewChat = () => {
    setView("contacts");
  };

  const handleSelectContact = async (profileId: string) => {
    setActiveTargetUserId(profileId);
    const chatId = await startChat(profileId);
    setActiveChatId(chatId);
    setView("conversation");
  };

  const handleBack = () => {
    setActiveChatId(null);
    setActiveTargetUserId(null);
    setView("list");
  };

  if (!isChatOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
        onClick={() => setIsChatOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col border-l shadow-2xl"
        style={{
          width: "min(400px, 100vw)",
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Panel Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--bg-secondary)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare size={20} className="text-emerald-500" />
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Chat
            </h2>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            title="Fechar chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === "list" && (
            <ChatListView onSelectChat={handleSelectChat} onNewChat={handleNewChat} />
          )}
          {view === "contacts" && (
            <ContactPicker onSelect={handleSelectContact} onBack={handleBack} />
          )}
          {view === "conversation" && activeChatId && (
            <ConversationView
              chatId={activeChatId}
              onBack={handleBack}
              onCardClick={handleCardClick}
            />
          )}
        </div>
      </div>

      {/* Modal de Detalhes da Solicitação */}
      {viewingCard && (
        <CardDetailModal
          card={viewingCard}
          userRole={userRole || "GESTOR"}
          simulatedUserName={userName || "Usuário"}
          onClose={() => setViewingCard(null)}
          onUpdate={async () => {
            const { data } = await supabase
              .from("payment_requests")
              .select("*")
              .eq("id", viewingCard.id)
              .single();
            if (data) setViewingCard(data);
            if (activeChatId) loadMessages(activeChatId);
          }}
          profilesMap={profilesMap}
        />
      )}

      {/* Animation */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
