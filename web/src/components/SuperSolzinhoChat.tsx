"use client";

import { useMemo, useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sun, Send, Square, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface SuperSolzinhoChatProps {
  /** "floating" = janela compacta do botão global; "page" = layout full-width de BI. */
  variant?: "floating" | "page";
  onReset?: () => void;
}

/* Estilo do Markdown — apenas variáveis CSS do tema (Light, Dark, n8n, Authkit, Jeton). */
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: "var(--text-primary)" }}>
      {children}
    </strong>
  ),
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  h1: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5">{children}</h3>,
  h2: ({ children }) => <h3 className="text-base font-bold mt-3 mb-1.5">{children}</h3>,
  h3: ({ children }) => <h4 className="text-sm font-bold mt-2 mb-1">{children}</h4>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--brand-primary)" }}>
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code
      className="px-1.5 py-0.5 rounded text-[0.85em] font-mono"
      style={{ backgroundColor: "var(--surface-hover)" }}
    >
      {children}
    </code>
  ),
  table: ({ children }) => (
    <div
      className="my-2 overflow-x-auto rounded-lg border"
      style={{ borderColor: "var(--surface-border)" }}
    >
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead style={{ backgroundColor: "var(--surface-hover)" }}>{children}</thead>,
  th: ({ children }) => (
    <th
      className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b"
      style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 border-b align-top" style={{ borderColor: "var(--surface-border)" }}>
      {children}
    </td>
  ),
};

const SUGGESTIONS_HIGH = [
  "Quanto gastamos este mês?",
  "Quais categorias mais consomem orçamento?",
  "Quem são os maiores solicitantes?",
];
const SUGGESTIONS_MANAGER = [
  "Como funciona o fluxo de uma solicitação?",
  "Quanto já solicitei este mês?",
  "O que significa 'Validação do gestor'?",
];

export default function SuperSolzinhoChat({ variant = "floating", onReset }: SuperSolzinhoChatProps) {
  const { userRole, userName } = useAuth();
  const isPage = variant === "page";
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // O token vai por header Authorization; o servidor também aceita os cookies de sessão.
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

  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const isBusy = status === "submitted" || status === "streaming";
  const suggestions = userRole === "GESTOR" ? SUGGESTIONS_MANAGER : SUGGESTIONS_HIGH;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

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

  const firstName = (userName || "").split(" ")[0];

  return (
    <div
      className={`flex flex-col h-full w-full min-h-0 ${isPage ? "" : "rounded-2xl"}`}
      style={{ backgroundColor: "transparent", color: "var(--text-secondary)" }}
    >
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-yellow-400/15 border border-yellow-400/40 shrink-0">
            <Sun size={20} className="text-yellow-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate" style={{ color: "var(--text-primary)" }}>
              Super Solzinho
            </p>
            <p className="text-[11px] leading-tight truncate" style={{ color: "var(--text-muted)" }}>
              Assistente de Inteligência da Conectsol
            </p>
          </div>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Nova conversa"
            className="p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {/* Mensagens */}
      <div className={`flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 ${isPage ? "md:px-8" : ""}`}>
        <div className={isPage ? "max-w-4xl mx-auto space-y-4" : "space-y-4"}>
          {messages.length === 0 && (
            <div className="text-center py-6">
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center bg-yellow-400/15 border border-yellow-400/40 mb-3">
                <Sun size={30} className="text-yellow-500" />
              </div>
              <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Olá{firstName ? `, ${firstName}` : ""}! ☀️
              </p>
              <p className="text-sm mt-1 mb-4">Sou o Super Solzinho. Como posso iluminar suas dúvidas hoje?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="px-3 py-1.5 rounded-full text-xs border transition-colors hover:bg-white/5 cursor-pointer"
                    style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
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
                <div key={m.id} className="flex justify-end">
                  <div
                    className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md text-sm whitespace-pre-wrap text-white"
                    style={{ backgroundColor: "var(--brand-primary)" }}
                  >
                    {text}
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-400/15 border border-yellow-400/40 shrink-0 mt-0.5">
                  <Sun size={17} className="text-yellow-500" />
                </div>
                <div
                  className="min-w-0 max-w-[92%] px-3.5 py-2.5 rounded-2xl rounded-tl-md text-sm border"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                >
                  {isToolRunning && (
                    <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                      <Sparkles size={13} className="text-yellow-500 animate-pulse" />
                      Consultando os dados financeiros...
                    </div>
                  )}
                  {text && (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-400/15 border border-yellow-400/40 shrink-0">
                <Sun size={17} className="text-yellow-500 animate-spin" style={{ animationDuration: "3s" }} />
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Solzinho está pensando...
              </span>
            </div>
          )}

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400">
              Não consegui responder agora. Tente novamente em instantes.
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Entrada */}
      <form
        onSubmit={onSubmit}
        className={`px-3 py-3 border-t shrink-0 ${isPage ? "md:px-8" : ""}`}
        style={{ borderColor: "var(--surface-border)" }}
      >
        <div className={`flex items-end gap-2 ${isPage ? "max-w-4xl mx-auto" : ""}`}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Pergunte ao Solzinho..."
            className="flex-1 resize-none max-h-32 px-3.5 py-2.5 rounded-xl text-sm outline-none border bg-transparent focus:border-yellow-500/60 transition-colors"
            style={{ borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => stop()}
              title="Parar"
              className="h-10 w-10 rounded-xl flex items-center justify-center bg-red-500/80 hover:bg-red-500 text-white transition-colors cursor-pointer shrink-0"
            >
              {status === "submitted" ? <Loader2 size={16} className="animate-spin" /> : <Square size={14} />}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              title="Enviar"
              className="h-10 w-10 rounded-xl flex items-center justify-center bg-yellow-400 hover:bg-yellow-300 text-slate-900 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
