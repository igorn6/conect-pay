"use client";

import type { KanbanColumnConfig, PaymentRequest, Category } from "@/types/database";
import { Inbox, User, Check, Clock, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { getCardSlaMetrics } from "@/utils/sla";

interface KanbanColumnProps {
  config: KanbanColumnConfig;
  cards: PaymentRequest[];
  onCardClick: (card: PaymentRequest) => void;
  profilesMap?: Record<string, string>;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[], isAdding: boolean) => void;
  categories?: Category[];
  onUpdateCategory?: (cardId: string, newCategory: string) => void;
  /** Quando true (coluna sem cards) renderiza uma tira vertical fina. */
  compact?: boolean;
}

/**
 * Coluna individual do Kanban.
 * Renderiza o cabeçalho com indicador de cor + badge de contagem
 * e a lista de cards (ou um estado vazio).
 */
export default function KanbanColumn({
  config,
  cards,
  onCardClick,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAll,
  profilesMap = {},
  compact = false,
}: KanbanColumnProps) {
  const hasColor = ["CORRECAO_PENDENTE", "FINALIZADO", "RECUSADO"].includes(config.key);

  if (compact && cards.length === 0) {
    return (
      <div
        title={`${config.label}: nenhuma solicitação`}
        className="flex flex-col items-center w-11 h-full rounded-xl shrink-0 py-3 gap-3 opacity-70 hover:opacity-100 transition-opacity"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--surface-border)",
          borderTop: `3px solid ${config.color}`,
        }}
      >
        <span
          className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold rounded-full"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
        >
          0
        </span>
        <span
          className="text-xs font-semibold whitespace-nowrap"
          style={{ color: "var(--text-secondary)", writingMode: "vertical-rl" }}
        >
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-w-[280px] w-[300px] flex-1 h-full rounded-xl overflow-hidden shrink-0"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--surface-border)",
        borderTop: hasColor ? `3px solid ${config.color}` : undefined,
      }}
    >
      {/* ─── Header da Coluna ─────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: "1px solid var(--surface-border)",
        }}
      >
        <div className="flex items-center gap-2.5">
          {selectable && cards.length > 0 && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectAll) {
                  const allSelected = cards.length > 0 && cards.every(c => selectedIds.has(c.id));
                  if (!allSelected) onSelectAll(cards.map(c => c.id), true);
                  else onSelectAll(cards.map(c => c.id), false);
                }
              }}
              title="Selecionar todos nesta coluna"
              className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center cursor-pointer transition-all border ${
                cards.every(c => selectedIds.has(c.id)) 
                  ? "bg-emerald-500 border-emerald-500" 
                  : "bg-slate-800/80 border-slate-600 hover:border-emerald-500/50"
              }`}
            >
              {cards.every(c => selectedIds.has(c.id)) && <Check size={14} className="text-white" strokeWidth={3} />}
            </div>
          )}
          {/* Indicador de cor */}
          {hasColor && (
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: config.color,
                boxShadow: `0 0 8px ${config.color}40`,
              }}
            />
          )}
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {config.label}
          </span>
        </div>

        {/* Badge de contagem */}
        <span
          className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-xs font-bold rounded-full"
          style={{
            backgroundColor: hasColor ? `${config.color}18` : "var(--surface-primary)",
            color: hasColor ? config.color : "var(--text-secondary)",
            border: hasColor ? "none" : "1px solid var(--surface-border)",
          }}
        >
          {cards.length}
        </span>
      </div>

      {/* ─── Área de Cards ────────────────── */}
      <div
        className="flex-1 min-h-0 p-3 overflow-y-auto"
      >
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 opacity-40">
            <Inbox size={32} style={{ color: "var(--text-muted)" }} />
            <p
              className="text-xs text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Nenhuma solicitação
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-2">
            {cards.map((card) => (
              <div
                key={card.id}
                id={`kanban-card-${card.id}`}
                onClick={() => onCardClick(card)}
                className="p-2.5 rounded-lg cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--surface-border)",
                  transition: "var(--transition-base)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  e.currentTarget.style.borderColor = config.color + "50";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-card)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-card)";
                  e.currentTarget.style.borderColor = "var(--surface-border)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {card.status === "VALIDACAO_GESTOR" && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-2 w-fit">
                    <ShieldCheck size={11} className="text-purple-400" />
                    <span>Aguardando Validação</span>
                  </div>
                )}

                {card.payment_conversion_log && (
                  <div
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-2 w-fit"
                    title={`Convertido de Caju para Pix em ${new Date(card.payment_conversion_log.convertedAt).toLocaleString("pt-BR")}${card.payment_conversion_log.cajuBalanceWithdrawn ? " • Saldo Caju retirado" : ""}`}
                  >
                    <RefreshCw size={10} className="text-purple-400" />
                    <span>Convertido p/ Pix</span>
                  </div>
                )}

                {/* Título */}
                <div className="flex items-start justify-between gap-2">
                <h3
                  className="text-sm font-semibold line-clamp-2 flex-1 leading-snug"
                  title={card.title}
                  style={{ color: "var(--text-primary)" }}
                >
                  {card.title}
                </h3>
                {selectable && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onToggleSelect) onToggleSelect(card.id);
                        }}
                        className={`w-5 h-5 flex-shrink-0 rounded-md flex items-center justify-center cursor-pointer transition-all border ${
                          selectedIds.has(card.id) 
                            ? "bg-emerald-500 border-emerald-500" 
                            : "bg-slate-800/80 border-slate-600 hover:border-emerald-500/50"
                        }`}
                      >
                        {selectedIds.has(card.id) && <Check size={14} className="text-white" strokeWidth={3} />}
                      </div>
                  </div>
                )}
              </div>

                {/* Categoria (badge) + Solicitante na mesma linha */}
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  {card.category ? (
                    <span
                      className="inline-flex items-center max-w-[55%] truncate text-[10px] font-medium rounded-full px-2 py-0.5"
                      title={`Categoria: ${card.category}`}
                      style={{
                        backgroundColor: "var(--surface-hover)",
                        border: "1px solid var(--surface-border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {card.category}
                    </span>
                  ) : <span />}
                  <span className="flex items-center gap-1 min-w-0" style={{ color: "var(--text-secondary)" }}>
                    <User size={11} className="shrink-0" />
                    <span className="text-[11px] truncate">
                      {profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido"}
                    </span>
                  </span>
                </div>

                {/* SLA: Apenas Pendente e Finalizado conforme solicitado */}
                {(() => {
                  const sla = getCardSlaMetrics(card);
                  if (sla.timeToPendenteSeconds === null && sla.pendenteToFinalizadoSeconds === null) return null;
                  return (
                    <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-slate-800/60 flex-wrap text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {sla.timeToPendenteSeconds !== null && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                            sla.isPendenteOngoing
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              : "bg-slate-800/90 text-slate-300 border border-slate-700/60"
                          }`}
                          title={sla.isPendenteOngoing ? "Tempo em Nova Solicitação (em andamento)" : "Tempo até entrar em Pendente"}
                        >
                          <Clock size={10} className="shrink-0 text-slate-400" />
                          <span>Pendente: <strong className="font-semibold text-slate-200">{sla.timeToPendenteFormatted}</strong></span>
                        </span>
                      )}

                      {sla.pendenteToFinalizadoSeconds !== null && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                            card.status === "FINALIZADO"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                              : "bg-slate-800/90 text-slate-300 border border-slate-700/60"
                          }`}
                          title={card.status === "FINALIZADO" ? "Tempo de Pendente até Finalizado" : "Tempo decorrido desde Pendente (em andamento)"}
                        >
                          <CheckCircle2 size={10} className="shrink-0 text-slate-400" />
                          <span>Finalizado: <strong className="font-semibold text-slate-200">{sla.pendenteToFinalizadoFormatted}</strong></span>
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Valor + Tipo de Pagamento */}
                <div className="flex items-center justify-between mt-2">
                  <span
                    className="text-sm font-bold"
                    style={{ color: config.color }}
                  >
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(card.amount))}
                  </span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      backgroundColor: `${config.color}15`,
                      color: config.color,
                    }}
                  >
                    {card.payment_type === "RETIRADA_DE_SALDO" ? "Retirada de Saldo" : card.payment_type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
