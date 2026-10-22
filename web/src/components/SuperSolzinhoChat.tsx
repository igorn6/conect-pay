"use client";

import { useMemo, useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Square,
  Loader2,
  Sparkles,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Check,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Users,
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Clock,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: any[];
}

interface SuperSolzinhoChatProps {
  /** "floating" = janela compacta do botão global; "page" = layout full-width de BI. */
  variant?: "floating" | "page";
  onReset?: () => void;
}

const STORAGE_KEY = "conectpay_solzinho_chats_v2";

/* Componente de Bloco de Código com Sintaxe e Cópia */
function CodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "código";
  const content = String(children).replace(/\n$/, "");

  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-[12px] font-mono border border-white/10 bg-slate-900/80 text-emerald-300"
        {...props}
      >
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl border border-white/10 bg-slate-950/90 shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.08] bg-slate-900/90">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
            {lang}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          title="Copiar código"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? "COPIADO" : "COPIAR"}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-slate-200">
        <pre>{children}</pre>
      </div>
    </div>
  );
}

/* Tipografia e Formatação Moderna do Markdown */
const modernMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-3 last:mb-0 leading-relaxed text-[13.5px] sm:text-[14px] text-slate-200">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-white">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-emerald-300">
      {children}
    </em>
  ),
  ul: ({ children }) => (
    <ul className="my-2.5 pl-2 space-y-1.5 text-[13.5px] text-slate-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 pl-5 list-decimal space-y-1.5 text-[13.5px] text-slate-200">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2">
      <span className="text-emerald-400 text-xs mt-1 shrink-0">•</span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  h1: ({ children }) => (
    <h3 className="text-base sm:text-lg font-bold text-white mt-5 mb-2.5 border-b border-white/10 pb-1.5 flex items-center gap-2">
      <Sparkles size={16} className="text-emerald-400" />
      <span>{children}</span>
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="text-sm sm:text-base font-bold text-white mt-4 mb-2 flex items-center gap-1.5">
      <span className="text-emerald-400 text-xs">◆</span>
      <span>{children}</span>
    </h4>
  ),
  h3: ({ children }) => (
    <h5 className="text-xs sm:text-sm font-semibold text-slate-200 mt-3 mb-1.5">
      {children}
    </h5>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 pl-3.5 py-1.5 border-l-2 border-emerald-500 bg-emerald-950/20 text-slate-300 rounded-r-lg text-xs italic">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-slate-900/60 shadow-md">
      <table className="w-full text-xs text-left border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-900/90 border-b border-white/10 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
      {children}
    </thead>
  ),
  th: ({ children }) => (
    <th className="px-3.5 py-2.5 font-bold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3.5 py-2.5 border-b border-white/[0.04] text-slate-200">{children}</td>
  ),
  code: CodeBlock,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1"
    >
      <span>{children}</span>
    </a>
  ),
};

const SUGGESTION_CARDS = [
  {
    icon: BarChart3,
    title: "Balanço Mensal",
    subtitle: "Despesas e liquidações",
    prompt: "Qual é o balanço consolidado de gastos deste mês e quais foram as maiores despesas liquidadas?",
    color: "emerald",
  },
  {
    icon: TrendingUp,
    title: "Gargalos no Kanban",
    subtitle: "Triagem e aprovações",
    prompt: "Quais categorias ou solicitantes possuem o maior volume de solicitações pendentes no Kanban?",
    color: "amber",
  },
  {
    icon: Users,
    title: "Maiores Fornecedores",
    subtitle: "Auditoria por titularidade",
    prompt: "Apresente um resumo agrupado dos maiores fornecedores e titulares pagos recentemente.",
    color: "sky",
  },
  {
    icon: Wallet,
    title: "Fluxo do Nubank",
    subtitle: "Saldo e movimentações",
    prompt: "Qual o saldo disponível no Nubank 02 e como estão as últimas movimentações de entrada e saída?",
    color: "purple",
  },
];

export default function SuperSolzinhoChat({ variant = "floating", onReset }: SuperSolzinhoChatProps) {
  const { userRole, userName } = useAuth();
  const isPage = variant === "page";
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("default");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Carrega histórico de sessões do localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ChatSession[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
        }
      }
    } catch (err) {
      console.warn("Erro ao ler sessões do chat:", err);
    }
  }, []);

  // Transport configurado para /api/chat com token Supabase
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    []
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  // Auto-scroll para a última mensagem
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  // Salva no localStorage quando mensagens forem atualizadas
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      setSessions((prev) => {
        const existingIdx = prev.findIndex((s) => s.id === activeSessionId);
        const firstUserMsg = messages.find((m) => m.role === "user");
        const title = firstUserMsg
          ? (firstUserMsg.parts?.find((p) => p.type === "text") as any)?.text?.slice(0, 36) || "Consulta Financeira"
          : "Consulta Financeira";

        let updated: ChatSession[];
        if (existingIdx >= 0) {
          updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            title: prev[existingIdx].title || title,
            messages,
          };
        } else {
          updated = [
            {
              id: activeSessionId,
              title,
              createdAt: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
              messages,
            },
            ...prev,
          ];
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 15)));
        return updated;
      });
    } catch (err) {
      console.warn("Erro ao salvar chat:", err);
    }
  }, [messages, activeSessionId]);

  const handleStartNewChat = () => {
    const newId = "chat_" + Date.now();
    setActiveSessionId(newId);
    setMessages([]);
    onReset?.();
  };

  const handleSelectSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return filtered;
    });
    if (activeSessionId === id) {
      handleStartNewChat();
    }
  };

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || isBusy) return;
    sendMessage({ text: value });
    setInput("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  const copyMessageText = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const firstName = (userName || "Usuário").split(" ")[0];

  return (
    <div className="flex h-full w-full min-h-0 bg-transparent text-slate-100 overflow-hidden font-sans">
      
      {/* ─── SIDEBAR DE HISTÓRICO (APENAS NA PÁGINA CHEIA) ─── */}
      {isPage && (
        <aside
          className={`shrink-0 border-r border-white/[0.08] bg-slate-950/60 backdrop-blur-2xl flex flex-col transition-all duration-300 ease-in-out ${
            isSidebarOpen ? "w-64 sm:w-72" : "w-0 overflow-hidden border-none"
          }`}
        >
          {/* Header da Sidebar */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Consultas Salvas
              </span>
            </div>
            <button
              onClick={handleStartNewChat}
              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
              title="Nova Consulta"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Botão de Nova Consulta */}
          <div className="p-3">
            <button
              onClick={handleStartNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent hover:from-emerald-500/25 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm"
            >
              <Plus size={14} />
              <span>Nova Conversa</span>
            </button>
          </div>

          {/* Lista de Sessões */}
          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 custom-scrollbar">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                <Clock size={20} className="mx-auto mb-2 opacity-40" />
                <p>Nenhuma conversa gravada.</p>
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`group relative flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                      isActive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-white font-medium shadow-sm"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Sparkles size={12} className={isActive ? "text-emerald-400 shrink-0" : "text-slate-600 shrink-0"} />
                      <span className="truncate">{s.title || "Consulta Financeira"}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition-opacity cursor-pointer shrink-0"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé da Sidebar */}
          <div className="p-3 border-t border-white/[0.06] text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>Conectsol AI</span>
            </span>
            <span className="text-[10px] text-slate-600">v2.0</span>
          </div>
        </aside>
      )}

      {/* ─── ÁREA PRINCIPAL DO CHAT ─── */}
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative">
        
        {/* Cabeçalho do Chat */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-slate-950/40 backdrop-blur-xl shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {isPage && (
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title={isSidebarOpen ? "Recolher histórico" : "Ver histórico"}
              >
                {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
              </button>
            )}

            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400/80 shadow-md shadow-amber-950/40 shrink-0 bg-white flex items-center justify-center">
                <img
                  src="/images/solzinho/solzinho-smart.png"
                  alt="Super Solzinho"
                  className="w-full h-full object-cover object-center scale-110"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-500/30 animate-pulse" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">Super Solzinho</h1>
                <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  IA Financeira
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate font-mono">
                Consultas contábeis, auditoria e conciliação em tempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all cursor-pointer"
              title="Iniciar nova conversa"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Nova Consulta</span>
            </button>
          </div>
        </header>

        {/* Feed de Mensagens */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-5">
            
            {/* Estado Inicial / Vazio: Hero com Solzinho e Cards Interativos */}
            {messages.length === 0 && (
              <div className="py-6 sm:py-10 text-center space-y-6">
                
                {/* Avatar Destaque */}
                <div className="inline-block relative">
                  <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-amber-400 to-orange-500 border border-amber-400/60 shadow-[0_0_35px_rgba(251,191,36,0.3)] mx-auto flex items-center justify-center">
                    <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                      <img
                        src="/images/solzinho/solzinho-wave.png"
                        alt="Super Solzinho"
                        className="w-full h-full object-cover object-center scale-110 hover:scale-120 transition-transform duration-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Saudação */}
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold tracking-tight text-white">
                    Olá, {firstName}! ☀️
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                    Sou o <strong className="text-emerald-400 font-semibold">Super Solzinho</strong>, seu copiloto financeiro na Conectsol. Pergunte sobre despesas, gargalos de aprovação, auditoria de titulares ou saldo Nubank.
                  </p>
                </div>

                {/* Grid de Sugestões Modernas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto pt-2 text-left">
                  {SUGGESTION_CARDS.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => submit(card.prompt)}
                        className="group p-4 rounded-2xl bg-slate-950/50 hover:bg-slate-900/80 border border-white/[0.08] hover:border-emerald-500/40 shadow-sm hover:shadow-[0_4px_20px_rgba(16,185,129,0.15)] transition-all duration-300 flex flex-col justify-between cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                            <Icon size={16} />
                          </div>
                          <ChevronRight size={14} className="text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {card.title}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {card.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </div>
            )}

            {/* Mensagens do Chat */}
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const text = m.parts
                ? m.parts
                    .filter((p) => p.type === "text")
                    .map((p) => (p as { text: string }).text)
                    .join("")
                : (m as any).content || "";

              if (isUser) {
                return (
                  <div key={m.id || idx} className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm bg-gradient-to-r from-emerald-600 to-teal-700 text-slate-950 font-medium text-sm shadow-[0_4px_20px_rgba(16,185,129,0.25)] border border-emerald-400/30 whitespace-pre-wrap leading-relaxed select-text">
                      {text}
                    </div>
                  </div>
                );
              }

              // Resposta do Super Solzinho
              return (
                <div key={m.id || idx} className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/50 shadow-sm shrink-0 bg-white flex items-center justify-center mt-0.5">
                    <img
                      src="/images/solzinho/solzinho-thumbs.png"
                      alt="Super Solzinho"
                      className="w-full h-full object-cover object-center scale-110"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-white tracking-tight">Super Solzinho</span>
                      <span className="text-[10px] font-mono text-emerald-400">✦ Copilot</span>
                    </div>

                    <div className="p-4 rounded-2xl rounded-tl-sm bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.37)] text-slate-200">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={modernMarkdownComponents}
                      >
                        {text}
                      </ReactMarkdown>

                      {/* Botão de Cópia da Mensagem */}
                      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-mono text-[10px]">Conectsol AI Core</span>
                        <button
                          type="button"
                          onClick={() => copyMessageText(text, idx)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Copiar resposta"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check size={12} className="text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Indicador de Resposta / Pensando */}
            {isBusy && (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/50 bg-white shrink-0 flex items-center justify-center">
                  <img
                    src="/images/solzinho/solzinho-smart.png"
                    alt="Pensando..."
                    className="w-full h-full object-cover object-center scale-110 animate-spin"
                    style={{ animationDuration: "3s" }}
                  />
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center gap-2.5 text-xs font-mono text-emerald-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Consultando dados e formulando análise...</span>
                  <button
                    type="button"
                    onClick={() => stop()}
                    className="ml-3 px-2 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10px] cursor-pointer"
                  >
                    Parar
                  </button>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>
        </div>

        {/* ─── BARRA DE ENTRADA FLUTUANTE ─── */}
        <div className="p-4 sm:p-5 shrink-0 bg-transparent">
          <form
            onSubmit={onSubmit}
            className="max-w-3xl mx-auto relative rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-white/10 focus-within:border-emerald-500/50 shadow-[0_12px_40px_rgba(0,0,0,0.65)] transition-all"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Pergunte sobre pagamentos, titulares, despesas ou saldo Nubank..."
              rows={1}
              className="w-full resize-none bg-transparent px-4 py-3.5 pr-24 text-sm text-white placeholder-slate-500 focus:outline-none custom-scrollbar"
              style={{ maxHeight: "120px" }}
            />

            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
              {input && (
                <button
                  type="button"
                  onClick={() => setInput("")}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                  title="Limpar texto"
                >
                  <X size={14} />
                </button>
              )}

              {isBusy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-all cursor-pointer"
                  title="Interromper geração"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold transition-all disabled:opacity-30 disabled:pointer-events-none shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
                  title="Enviar pergunta (Enter)"
                >
                  <Send size={15} />
                </button>
              )}
            </div>

            <div className="px-4 pb-2 pt-0 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/[0.04]">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <span>Super Solzinho v2.0 • IA Conectsol</span>
              </span>
              <span className="hidden sm:inline">Enter ↵ para enviar • Shift + Enter para nova linha</span>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
