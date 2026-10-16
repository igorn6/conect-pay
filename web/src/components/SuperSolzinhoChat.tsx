"use client";

import { useMemo, useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Compass,
  ArrowRight,
  Square,
  Loader2,
  Sparkles,
  RotateCcw,
  BookOpen,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  Paperclip,
  CornerDownLeft,
  Search,
  Sliders,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Caderno {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: any[];
}

interface SuperSolzinhoChatProps {
  /** "floating" = janela compacta do botão global; "page" = layout full-width de BI. */
  variant?: "floating" | "page";
  onReset?: () => void;
}

const STORAGE_KEY = "conectpay_atelier_cadernos_v1";

/* Componente de Bloco de Código Tangível no estilo Atelier */
function AtelierCodeBlock({ inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "código";
  const content = String(children).replace(/\n$/, "");

  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-[12px] font-mono border border-[rgba(205,163,104,0.25)] bg-[#131418] text-[#e5be85]"
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
    <div className="my-5 rounded-xl border border-[rgba(205,163,104,0.2)] bg-[#0d0e12]/95 shadow-[0_8px_30px_rgb(0,0,0,0.6)] backdrop-blur-md overflow-hidden transition-all duration-300 hover:border-[rgba(205,163,104,0.35)] hover:shadow-[0_12px_40px_rgba(205,163,104,0.06)]">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[rgba(205,163,104,0.12)] bg-[#111317]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#cda368]/60 inline-block" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#cda368]/80 font-bold">
            {lang}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-[#a39f97] hover:text-[#f4f1ea] hover:bg-white/5 transition-colors cursor-pointer"
          title="Copiar código"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copied ? "COPIADO" : "COPIAR"}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed text-[#eae6df]">
        <pre>{children}</pre>
      </div>
    </div>
  );
}

/* Tipografia Editorial e Livro-Razão do Markdown */
const atelierMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-4 last:mb-0 leading-[1.85] font-editorial text-[15px] sm:text-[16px] text-[#f4f1ea] tracking-[0.01em]">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#ffffff] font-editorial tracking-[0.01em]">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-[#e5be85] font-editorial">
      {children}
    </em>
  ),
  ul: ({ children }) => (
    <ul className="my-4 pl-1 space-y-2 font-editorial text-[#f4f1ea]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 pl-5 list-decimal space-y-2 font-editorial text-[#f4f1ea]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-[1.8] flex items-start gap-2.5">
      <span className="text-[#cda368] text-xs mt-1.5 shrink-0 opacity-70">◆</span>
      <span className="flex-1">{children}</span>
    </li>
  ),
  h1: ({ children }) => (
    <h2 className="text-xl font-editorial font-bold text-[#fdfcf9] mt-8 mb-3.5 tracking-wide border-b border-[rgba(205,163,104,0.18)] pb-2 flex items-center gap-2">
      <span className="text-[#cda368] text-sm">✦</span>
      <span>{children}</span>
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="text-lg font-editorial font-bold text-[#fbf9f5] mt-6 mb-2.5 tracking-wide">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="text-base font-editorial font-semibold text-[#f5f3ef] mt-5 mb-2">
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-5 pl-4 py-2 border-l-2 border-[#cda368]/60 italic font-editorial text-[#ded9ce] bg-[#121418]/60 rounded-r-xl">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-[#cda368]/50 underline-offset-4 text-[#e5be85] hover:text-[#fff] transition-colors"
    >
      {children}
    </a>
  ),
  code: AtelierCodeBlock,
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-[rgba(205,163,104,0.18)] bg-[#0d0f13]/90 shadow-xl backdrop-blur-md">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[#14161c] border-b border-[rgba(205,163,104,0.18)]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-editorial text-[11px] font-bold uppercase tracking-wider text-[#cda368]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 border-b border-[rgba(205,163,104,0.08)] align-top font-mono tabular-nums text-[#e8e4dc] leading-relaxed">
      {children}
    </td>
  ),
};

const SUGGESTED_PAUTAS = [
  { label: "Balanço Consolidado", prompt: "Qual é o balanço consolidado de gastos deste mês e as maiores despesas?" },
  { label: "Gargalos de Pagamento", prompt: "Quais categorias ou solicitantes mais concentram solicitações pendentes?" },
  { label: "Auditoria por Titular", prompt: "Apresente um resumo agrupado dos maiores titulares e fornecedores pagos." },
  { label: "Liquidações e CNPJs", prompt: "Como estão distribuídos os pagamentos entre CNPJ 1, CNPJ 2 e demais contas?" },
];

export default function SuperSolzinhoChat({ variant = "floating", onReset }: SuperSolzinhoChatProps) {
  const { userRole, userName } = useAuth();
  const isPage = variant === "page";
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cadernos (Histórico persistido em LocalStorage)
  const [cadernos, setCadernos] = useState<Caderno[]>([]);
  const [activeCadernoId, setActiveCadernoId] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(isPage);

  // Carregar Cadernos salvos
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCadernos(parsed);
          setActiveCadernoId(parsed[0].id);
          return;
        }
      }
    } catch (e) {
      console.warn("Falha ao recuperar cadernos do Atelier:", e);
    }

    // Caderno inicial padrão
    const initialCaderno: Caderno = {
      id: "estudo-primeiro",
      title: "Estudo I • Diálogo Inicial",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setCadernos([initialCaderno]);
    setActiveCadernoId(initialCaderno.id);
  }, []);

  // Salvar cadernos no localStorage ao sofrer alteração
  const saveCadernos = (updated: Caderno[]) => {
    setCadernos(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Erro ao persistir cadernos:", e);
    }
  };

  // Configuração de transporte da IA
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

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";

  // Quando o caderno ativo muda, carrega suas mensagens
  useEffect(() => {
    if (!activeCadernoId) return;
    const current = cadernos.find((c) => c.id === activeCadernoId);
    if (current && current.messages) {
      setMessages(current.messages);
    }
  }, [activeCadernoId]);

  // Sincroniza mensagens do chat no caderno ativo
  useEffect(() => {
    if (!activeCadernoId || messages.length === 0) return;
    setCadernos((prev) => {
      const updated = prev.map((c) => {
        if (c.id === activeCadernoId) {
          let title = c.title;
          // Se for título genérico e tiver mensagem de usuário, gera um título inteligente
          if (title.startsWith("Estudo") && messages.length > 0) {
            const firstUserMsg = messages.find((m) => m.role === "user");
            if (firstUserMsg) {
              const text = firstUserMsg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("")
                .trim();
              if (text) {
                title = text.length > 38 ? `${text.slice(0, 38)}…` : text;
              }
            }
          }
          return {
            ...c,
            title,
            updatedAt: new Date().toISOString(),
            messages,
          };
        }
        return c;
      });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  }, [messages, activeCadernoId]);

  // Rolagem suave
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  // Ajuste automático de altura do textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || isBusy) return;
    sendMessage({ text: value });
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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

  const handleCreateNewCaderno = () => {
    const romanNumeral = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][cadernos.length % 10] || `${cadernos.length + 1}`;
    const newCaderno: Caderno = {
      id: `estudo-${Date.now()}`,
      title: `Estudo ${romanNumeral} • Em aberto`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    const updated = [newCaderno, ...cadernos];
    saveCadernos(updated);
    setActiveCadernoId(newCaderno.id);
    setMessages([]);
    setInput("");
    if (onReset) onReset();
  };

  const handleDeleteCaderno = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (cadernos.length <= 1) {
      // Se for o último, apenas limpa
      handleCreateNewCaderno();
      return;
    }
    const filtered = cadernos.filter((c) => c.id !== id);
    saveCadernos(filtered);
    if (activeCadernoId === id) {
      setActiveCadernoId(filtered[0].id);
      setMessages(filtered[0].messages || []);
    }
  };

  const activeCaderno = cadernos.find((c) => c.id === activeCadernoId);

  return (
    <div className="flex h-full w-full min-h-0 bg-[#090a0d] text-[#e8e4dc] atelier-noise relative overflow-hidden select-text">
      
      {/* ========================================================
          SIDEBAR: CADERNOS DE ESTUDO (RETRACTABLE ATELIER PANEL)
          ======================================================== */}
      {isPage && (
        <aside
          className={`shrink-0 border-r border-[rgba(205,163,104,0.12)] bg-[#0d0e12]/95 backdrop-blur-xl transition-all duration-300 ease-out z-20 flex flex-col ${
            isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
          }`}
        >
          {/* Masthead do Atelier */}
          <div className="p-5 border-b border-[rgba(205,163,104,0.12)] flex items-center justify-between">
            <div>
              <span className="font-editorial text-xs tracking-[0.25em] text-[#cda368] font-bold block uppercase">
                A T E L I E R
              </span>
              <span className="text-[10px] tracking-widest text-[#8a867f] uppercase font-mono block mt-0.5">
                Cadernos & Diálogos
              </span>
            </div>
            <button
              type="button"
              onClick={handleCreateNewCaderno}
              title="Novo Estudo"
              className="p-1.5 rounded-lg border border-[rgba(205,163,104,0.25)] text-[#cda368] hover:bg-[#cda368]/10 hover:border-[#cda368]/40 transition-colors cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Lista de Cadernos */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 atelier-scrollbar">
            <div className="px-2 py-1 text-[9px] uppercase tracking-widest font-mono text-[#78756e]">
              Histórico de Estudos
            </div>
            {cadernos.map((cad) => {
              const isActive = cad.id === activeCadernoId;
              const dateStr = new Date(cad.createdAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              });
              const count = cad.messages?.length || 0;

              return (
                <div
                  key={cad.id}
                  onClick={() => setActiveCadernoId(cad.id)}
                  className={`group relative flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? "border-[rgba(205,163,104,0.35)] bg-[#17181f] text-[#ffffff] shadow-md shadow-black/40"
                      : "border-transparent text-[#a8a49c] hover:bg-[#121318] hover:text-[#e4dfd7]"
                  }`}
                >
                  {/* Linha de destaque lateral ativa */}
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#cda368] rounded-r" />
                  )}

                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-editorial font-medium truncate leading-tight">
                      {cad.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-[#7a7770]">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{count} {count === 1 ? "registro" : "registros"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteCaderno(e, cad.id)}
                    title="Excluir caderno"
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#78756e] hover:text-rose-400 transition-opacity cursor-pointer shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Rodapé da Sidebar */}
          <div className="p-4 border-t border-[rgba(205,163,104,0.12)] bg-[#0b0c10] text-[11px] font-mono text-[#706c64] flex items-center justify-between">
            <span>Conect Pay Atelier</span>
            <span className="text-[#cda368]/70">v1.8.1</span>
          </div>
        </aside>
      )}

      {/* ========================================================
          FEED EDITORIAL PRINCIPAL (ORGANIC SCRIPT & JOURNAL)
          ======================================================== */}
      <main className="flex-1 min-w-0 flex flex-col h-full relative overflow-hidden">
        
        {/* Top Control Bar */}
        <header className="h-14 border-b border-[rgba(205,163,104,0.12)] bg-[#0d0e12]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            {isPage && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen((v) => !v)}
                title={isSidebarOpen ? "Recolher Cadernos" : "Expandir Cadernos"}
                className="p-2 rounded-lg border border-[rgba(205,163,104,0.18)] text-[#cda368] hover:bg-[#cda368]/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
              >
                <BookOpen size={13} />
                <span className="hidden sm:inline">{isSidebarOpen ? "Recolher" : "Cadernos"}</span>
              </button>
            )}

            <div className="flex items-baseline gap-2.5">
              <span className="text-xs font-editorial font-bold tracking-[0.2em] text-[#cda368] uppercase">
                {isPage ? (activeCaderno?.title || "Estudo Ativo") : "Atelier Intelligence"}
              </span>
              <span className="hidden md:inline-block text-[10px] font-mono text-[#78756e]">
                — Análise Financeira Literária
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNewCaderno}
              title="Iniciar novo estudo em branco"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(205,163,104,0.18)] text-[11px] font-mono text-[#cda368] hover:bg-[#cda368]/10 hover:border-[#cda368]/40 transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Novo Diálogo</span>
            </button>
          </div>
        </header>

        {/* Área de Leitura Editorial */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-8 atelier-scrollbar">
          <div className="max-w-3xl mx-auto space-y-10">
            
            {/* Estado Inicial (Masthead Literário de Abertura) */}
            {messages.length === 0 && (
              <div className="py-12 px-4 sm:px-8 border border-[rgba(205,163,104,0.15)] rounded-2xl bg-[#0e1014]/70 backdrop-blur-sm text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-[#cda368]/50 to-transparent" />
                
                <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#cda368] font-bold block mb-2">
                  Atelier de Inteligência Financeira
                </span>
                
                <h1 className="text-2xl sm:text-3xl font-editorial font-bold text-[#fbf9f5] tracking-wide mb-3">
                  Diálogos Contábeis & Análise Operacional
                </h1>
                
                <p className="text-xs sm:text-sm font-editorial italic text-[#a39f97] max-w-xl mx-auto leading-relaxed mb-8">
                  Consulte os registros financeiros da Conectsol, audite despesas por titularidade, examine o fluxo do Nubank e explore métricas com rigor analítico e clareza literária.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl mx-auto text-left">
                  {SUGGESTED_PAUTAS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => submit(p.prompt)}
                      className="p-3.5 rounded-xl border border-[rgba(205,163,104,0.12)] bg-[#121318]/90 hover:border-[rgba(205,163,104,0.3)] hover:bg-[#161820] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#cda368]">
                        <span>§</span>
                        <span>{p.label}</span>
                      </div>
                      <p className="text-xs font-editorial text-[#d4cfc7] mt-1 line-clamp-2 group-hover:text-[#fff] transition-colors leading-relaxed">
                        {p.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fita Contínua da Conversa (Sem Bolhas) */}
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              const isToolRunning = m.parts.some(
                (p) =>
                  p.type.startsWith("tool-") &&
                  "state" in p &&
                  p.state !== "output-available" &&
                  p.state !== "output-error"
              );
              const text = m.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");

              if (isUser) {
                return (
                  <article
                    key={m.id}
                    className="pt-6 pb-4 border-b border-[rgba(205,163,104,0.1)] relative"
                  >
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-widest text-[#cda368]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#cda368]" />
                      <span>Inquirição • {userName || "Usuário"}</span>
                    </div>
                    <div className="font-sans text-[15px] text-[#e0ded8] leading-relaxed font-normal whitespace-pre-wrap pl-3.5 border-l border-[rgba(205,163,104,0.3)]">
                      {text}
                    </div>
                  </article>
                );
              }

              return (
                <article
                  key={m.id}
                  className="pt-2 pb-6 relative transition-all duration-300"
                >
                  <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-widest text-[#cda368]/90">
                    <span className="text-[#cda368]">✦</span>
                    <span>Parecer Atelier</span>
                    <span className="text-[#6d6a63] font-normal">— Conect Pay Intelligence</span>
                  </div>

                  {isToolRunning && (
                    <div className="my-3 py-2 px-3 rounded-lg border border-[rgba(205,163,104,0.2)] bg-[#121419] flex items-center gap-2.5 text-xs font-editorial italic text-[#cda368] animate-pulse">
                      <Sparkles size={13} className="text-[#cda368]" />
                      <span>Auditor em execução: consultando base de pagamentos e registros contábeis...</span>
                    </div>
                  )}

                  <div className="pl-0 sm:pl-1">
                    {text ? (
                      <div className="relative">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={atelierMarkdownComponents}
                        >
                          {text}
                        </ReactMarkdown>
                        {isBusy && idx === messages.length - 1 && (
                          <span className="atelier-caret" />
                        )}
                      </div>
                    ) : !isToolRunning ? (
                      isBusy && idx === messages.length - 1 ? (
                        <div className="flex items-center gap-2 text-xs font-editorial italic py-2 text-[#a8a49c]">
                          <span className="atelier-caret" />
                          <span>Formulando análise documental...</span>
                        </div>
                      ) : (
                        <div className="text-xs italic py-1 text-[#8c8880] font-editorial">
                          Não foi possível extrair os dados desta consulta. Formule nova pergunta.
                        </div>
                      )
                    ) : null}
                  </div>
                </article>
              );
            })}

            {status === "submitted" && (
              <div className="py-4 flex items-center gap-3 text-xs font-editorial italic text-[#cda368]">
                <span className="atelier-caret" />
                <span>Examinando registros financeiros e gerando parecer...</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-200 text-xs font-mono">
                ✦ Erro no processamento da consulta. Por favor, tente reformular a pergunta.
              </div>
            )}

            {/* Espaço extra para a barra flutuante */}
            <div className="h-28" />
            <div ref={endRef} />
          </div>
        </div>

        {/* ========================================================
            BARRA DE COMANDO FLUTUANTE (SLEEK HARDWARE CONSOLE)
            ======================================================== */}
        <div className="absolute bottom-6 inset-x-0 px-4 sm:px-8 z-30 pointer-events-none">
          <form
            onSubmit={onSubmit}
            className="max-w-3xl mx-auto pointer-events-auto rounded-2xl border border-[rgba(205,163,104,0.22)] bg-[#0d0e12]/92 backdrop-blur-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] p-2 transition-all duration-300 focus-within:border-[rgba(205,163,104,0.5)] focus-within:shadow-[0_20px_60px_rgba(205,163,104,0.08)]"
          >
            <div className="flex items-end gap-2 px-2 pt-1 pb-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Formule sua consulta sobre pagamentos, titulares ou despesas..."
                className="flex-1 resize-none bg-transparent text-sm font-sans text-[#f4f1ea] placeholder-[#6e6b63] outline-none max-h-44 leading-relaxed py-1.5 px-1"
              />

              {isBusy ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  title="Interromper geração"
                  className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#2d1215] border border-rose-500/40 text-rose-300 hover:bg-rose-900/60 transition-colors cursor-pointer shrink-0"
                >
                  <Square size={13} className="fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  title="Enviar consulta (Ctrl + Enter)"
                  className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 bg-[#cda368] hover:bg-[#dfb57a] text-[#090a0d] font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 shadow-md shadow-black/40"
                >
                  <span>Enviar</span>
                  <ArrowRight size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Barra de utilidades / hardware marks */}
            <div className="flex items-center justify-between pt-2 px-2 border-t border-[rgba(205,163,104,0.08)] text-[10px] font-mono text-[#78756e]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[#cda368]/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#cda368]" />
                  <span>Atelier v1.8.1</span>
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">IA Generativa Conectsol</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden sm:inline bg-[#15171d] px-2 py-0.5 rounded border border-[rgba(205,163,104,0.12)] text-[#a39f97]">
                  [ ⌘ / Ctrl + ↵ ]
                </span>
                {input.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInput("")}
                    className="hover:text-[#f4f1ea] transition-colors cursor-pointer"
                  >
                    limpar
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

      </main>
    </div>
  );
}
