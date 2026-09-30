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
  Image as ImageIcon,
  File,
  DollarSign,
  Check,
  CheckCheck,
  Download,
} from "lucide-react";
import { useChat, type Chat, type ChatMessage, type PendingCardAttachment } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";

// ---------- Status labels ----------
const STATUS_LABELS: Record<string, string> = {
  NOVA_SOLICITACAO: "Nova",
  EM_APROVACAO: "Em Aprovacao",
  AGUARDANDO_PAGAMENTO: "Aguardando Pgto",
  VALIDADO_GESTOR: "Validado",
  VALIDACAO_GESTOR: "Em Validacao",
  CORRECAO_PENDENTE: "Correcao",
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
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:brightness-110 transition-all mb-1"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}30` }}
      >
        <DollarSign size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{title || "Solicitacao"}</p>
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
        backgroundColor: "#1e293b",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      <div className="w-1 h-10 rounded-full" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold" style={{ color }}>
          Solicitacao anexada
        </p>
        <p className="text-xs text-slate-300 truncate">{card.title}</p>
        <span className="text-[10px] text-slate-400">
          R$ {card.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ==================== MESSAGE BUBBLE ====================
function MessageBubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  const isImage = msg.file_type?.startsWith("image/");
  
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2 px-4`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          isMine
            ? "rounded-br-md"
            : "rounded-bl-md"
        }`}
        style={{
          backgroundColor: isMine ? "#065f46" : "#1e293b",
        }}
      >
        {/* Card attachment inside message */}
        {msg.card_request_id && msg.card_title && (
          <CardPreview
            title={msg.card_title}
            amount={msg.card_amount}
            status={msg.card_status}
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
                className="flex items-center gap-2 p-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{msg.file_name}</p>
                  <p className="text-[10px] text-slate-400">Documento</p>
                </div>
                <Download size={14} className="text-slate-400" />
              </a>
            )}
          </div>
        )}

        {/* Text */}
        {msg.text && (
          <p className="text-sm text-white whitespace-pre-wrap break-words">{msg.text}</p>
        )}

        {/* Timestamp + read status */}
        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
          {isMine && (
            msg.read_at
              ? <CheckCheck size={12} className="text-blue-400" />
              : <Check size={12} className="text-slate-400" />
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
    if (!search.trim()) return chats;
    const s = search.toLowerCase();
    return chats.filter((c) =>
      c.participants.some((p) => p.name.toLowerCase().includes(s))
    );
  }, [chats, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="px-4 pb-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer transition-all hover:brightness-110"
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
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            <MessageSquare size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          filtered.map((chat) => {
            const other = chat.participants[0];
            const lastText = chat.last_message?.text || (chat.last_message?.file_name ? "Arquivo" : (chat.last_message?.card_request_id ? "Solicitacao" : ""));
            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors text-left border-b border-slate-800/50"
              >
                <img
                  src={getAvatarUrl(other?.name || "", other?.avatar_url)}
                  alt=""
                  className="w-10 h-10 rounded-full shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white truncate">{other?.name || "Usuario"}</p>
                    {chat.last_message && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatDate(chat.last_message.created_at)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-slate-400 truncate">{lastText || "Sem mensagens"}</p>
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-white">Nova Conversa</h3>
      </div>
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar contato..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors text-left border-b border-slate-800/50"
          >
            <img
              src={getAvatarUrl(p.name, p.avatar_url)}
              alt=""
              className="w-10 h-10 rounded-full shrink-0"
            />
            <p className="text-sm font-medium text-white">{p.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== CONVERSATION VIEW ====================
function ConversationView({ chatId, onBack }: {
  chatId: string;
  onBack: () => void;
}) {
  const { messages, loadMessages, sendMessage, pendingCard, setPendingCard, chats } = useChat();
  const { userId } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chat = chats.find((c) => c.id === chatId);
  const otherUser = chat?.participants[0];

  useEffect(() => {
    loadMessages(chatId);
  }, [chatId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if ((!text.trim() && !file && !pendingCard) || sending) return;
    setSending(true);
    await sendMessage(text.trim(), file, pendingCard?.requestId || null);
    setText("");
    setFile(null);
    setSending(false);
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
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0f172a" }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <img
          src={getAvatarUrl(otherUser?.name || "", otherUser?.avatar_url)}
          alt=""
          className="w-9 h-9 rounded-full shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{otherUser?.name || "Usuario"}</p>
          <p className="text-[11px] text-emerald-400">online</p>
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto py-3"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 80%, rgba(16,185,129,0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59,130,246,0.03) 0%, transparent 50%)",
        }}
      >
        {grouped.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center my-3">
              <span className="text-[11px] text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full">
                {group.date}
              </span>
            </div>
            {group.msgs.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} isMine={msg.sender_id === userId} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Pending card banner */}
      {pendingCard && (
        <PendingCardBanner card={pendingCard} onRemove={() => setPendingCard(null)} />
      )}

      {/* File preview */}
      {file && (
        <div className="flex items-center gap-2 px-4 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#1e293b" }}>
          <File size={14} className="text-emerald-400" />
          <span className="text-xs text-slate-300 truncate flex-1">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className="flex items-end gap-2 px-3 py-3 border-t shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0f172a" }}
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
          className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
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
          className="flex-1 px-3 py-2 text-sm rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none max-h-24"
          style={{ minHeight: "38px" }}
        />
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && !file && !pendingCard)}
          className="p-2 rounded-lg transition-all shrink-0 disabled:opacity-30 cursor-pointer"
          style={{
            backgroundColor: text.trim() || file || pendingCard ? "#059669" : "transparent",
            color: text.trim() || file || pendingCard ? "#fff" : "#64748b",
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
  const { isChatOpen, setIsChatOpen, activeChatId, setActiveChatId, startChat, loadChats } = useChat();
  const [view, setView] = useState<"list" | "contacts" | "conversation">("list");

  // Sync view with activeChatId
  useEffect(() => {
    if (activeChatId) {
      setView("conversation");
    }
  }, [activeChatId]);

  // Reset when panel closes
  useEffect(() => {
    if (!isChatOpen) {
      // Keep activeChatId so reopening returns to conversation
    }
  }, [isChatOpen]);

  const handleSelectChat = (chat: Chat) => {
    setActiveChatId(chat.id);
    setView("conversation");
  };

  const handleNewChat = () => {
    setView("contacts");
  };

  const handleSelectContact = async (profileId: string) => {
    const chatId = await startChat(profileId);
    setActiveChatId(chatId);
    setView("conversation");
  };

  const handleBack = () => {
    setActiveChatId(null);
    setView("list");
  };

  if (!isChatOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:pointer-events-none"
        onClick={() => setIsChatOpen(false)}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col border-l shadow-2xl"
        style={{
          width: "min(400px, 100vw)",
          backgroundColor: "#0f172a",
          borderColor: "rgba(255,255,255,0.06)",
          animation: "slideInRight 0.25s ease-out",
        }}
      >
        {/* Panel Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0f172a" }}
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare size={20} className="text-emerald-400" />
            <h2 className="text-base font-bold text-white">Chat</h2>
          </div>
          <button
            onClick={() => setIsChatOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
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
            <ConversationView chatId={activeChatId} onBack={handleBack} />
          )}
        </div>
      </div>

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
