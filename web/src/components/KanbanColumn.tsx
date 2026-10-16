"use client";

import { useMemo } from "react";
import type { KanbanColumnConfig, PaymentRequest, Category } from "@/types/database";
import { Inbox, User, Check, Clock, CheckCircle2, ShieldCheck, RefreshCw, Zap } from "lucide-react";
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
 * Coluna individual do Kanban - Terminal Liquid Glass.
 * Renderiza o cabeçalho com indicador de cor, badge de contagem, soma financeira total
 * e a lista de cards com micro-interações táteis e profundidade óptica.
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

  const columnTotal = useMemo(() => {
    return cards.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  }, [cards]);

  const formattedTotal = useMemo(() => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(columnTotal);
  }, [columnTotal]);

  if (compact && cards.length === 0) {
    return (
      <div
        title={`${config.label}: nenhuma solicitação`}
        className="flex flex-col items-center w-11 h-full rounded-2xl shrink-0 py-4 gap-3 bg-slate-900/40 backdrop-blur-md border border-white/5 opacity-60 hover:opacity-100 transition-all cursor-pointer group"
        style={{
          borderTop: `3px solid ${config.color || 'rgba(255,255,255,0.2)'}`,
        }}
      >
        <span
          className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[10px] font-mono font-bold rounded-full bg-white/5 border border-white/10 text-slate-400 group-hover:text-white"
        >
          0
        </span>
        <span
          className="text-[11px] font-medium tracking-wide uppercase whitespace-nowrap text-slate-500 group-hover:text-slate-300"
          style={{ writingMode: "vertical-rl" }}
        >
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col min-w-[290px] w-[310px] flex-1 h-full rounded-2xl overflow-hidden shrink-0 bg-slate-950/60 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative"
      style={{
        borderTop: `3px solid ${config.color || 'rgba(255,255,255,0.2)'}`,
      }}
    >
      {/* Glow sutil na borda superior */}
      <div 
        className="absolute top-0 left-0 right-0 h-10 pointer-events-none opacity-20 blur-xl"
        style={{ backgroundColor: config.color || '#10b981' }}
      />

      {/* ─── Header da Coluna ─────────────── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/[0.06] bg-white/[0.02]">
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
              className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center cursor-pointer transition-all border ${
                cards.every(c => selectedIds.has(c.id)) 
                  ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                  : "bg-slate-900/90 border-white/20 hover:border-emerald-400"
              }`}
            >
              {cards.every(c => selectedIds.has(c.id)) && <Check size={11} className="text-white" strokeWidth={3} />}
            </div>
          )}
          {/* Indicador de cor com pulso luminoso */}
          <div
            className="w-2.5 h-2.5 rounded-full relative shrink-0"
            style={{
              backgroundColor: config.color,
              boxShadow: `0 0 10px ${config.color}`,
            }}
          />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            {config.label}
          </span>
        </div>

        {/* Quantidade e Total Financeiro */}
        <div className="flex items-center gap-2">
          {columnTotal > 0 && (
            <span 
              className="text-[10px] font-mono font-medium text-slate-400/90 tracking-tight"
              title={`Volume total na coluna: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(columnTotal)}`}
            >
              {formattedTotal}
            </span>
          )}
          <span
            className="flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-mono font-bold rounded-md bg-white/[0.06] border border-white/10 text-slate-300"
          >
            {cards.length}
          </span>
        </div>
      </div>

      {/* ─── Área de Cards ────────────────── */}
      {/* ─── Área de Cards ────────────────── */}
      <div className="flex-1 min-h-0 p-3 overflow-y-auto custom-scrollbar">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5 py-12 opacity-30 select-none">
            <Inbox size={28} className="text-slate-400" />
            <p className="text-[11px] text-center font-medium tracking-wide uppercase text-slate-500">
              Sem solicitações
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 pb-2">
            {cards.map((card) => (
              <div
                key={card.id}
                id={`kanban-card-${card.id}`}
                onClick={() => onCardClick(card)}
                className="group p-3 rounded-xl cursor-pointer bg-slate-900/80 hover:bg-slate-900 border border-white/[0.08] hover:border-white/20 transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 relative overflow-hidden"
                style={{
                  borderLeft: `3px solid ${config.color || '#3b82f6'}`,
                }}
              >
                {/* Luminous hover sheen */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" 
                />

                {/* Status Badges & Flags */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {card.status === "VALIDACAO_GESTOR" && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                      <ShieldCheck size={11} className="text-purple-400" />
                      <span>Validação</span>
                    </div>
                  )}

                  {card.payment_conversion_log && (
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider"
                      title={`Convertido de Caju para Pix em ${new Date(card.payment_conversion_log.convertedAt).toLocaleString("pt-BR")}`}
                    >
                      <RefreshCw size={10} className="text-purple-400 animate-spin" style={{ animationDuration: "6s" }} />
                      <span>Caju ➔ Pix</span>
                    </div>
                  )}

                  {card.request_kind === "RECARGA_NUBANK" && (
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#820AD1]/25 border border-[#820AD1]/40 text-[#d8b4fe] text-[10px] font-bold uppercase tracking-wider"
                      title="Recarga de Saldo Nubank"
                    >
                      <Zap size={10} className="text-[#c084fc]" />
                      <span>Recarga Nubank</span>
                    </div>
                  )}

                  {card.request_kind === "RECARGA_CAJU" && (
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#e11d48]/25 border border-[#e11d48]/40 text-[#fda4af] text-[10px] font-bold uppercase tracking-wider"
                      title="Recarga de Saldo Caju"
                    >
                      <Zap size={10} className="text-[#fb7185]" />
                      <span>Recarga Caju</span>
                    </div>
                  )}
                </div>

                {/* Título & Checkbox */}
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="text-xs font-semibold line-clamp-2 flex-1 leading-snug text-slate-100 group-hover:text-white transition-colors"
                    title={card.title}
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
                        className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center cursor-pointer transition-all border ${
                          selectedIds.has(card.id) 
                            ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                            : "bg-slate-800/80 border-white/20 hover:border-emerald-400"
                        }`}
                      >
                        {selectedIds.has(card.id) && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  )}
                </div>

                {/* Categoria + Solicitante */}
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                  {card.category ? (
                    <span
                      className="inline-flex items-center max-w-[50%] truncate text-[10px] font-medium rounded px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.08] text-slate-300"
                      title={`Categoria: ${card.category}`}
                    >
                      {card.category}
                    </span>
                  ) : <span />}
                  <span className="flex items-center gap-1 min-w-0 text-slate-400 group-hover:text-slate-300 transition-colors">
                    <User size={10} className="shrink-0 text-slate-500" />
                    <span className="text-[10px] truncate">
                      {profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido"}
                    </span>
                  </span>
                </div>

                {/* SLA: Pendente e Finalizado */}
                {(() => {
                  const sla = getCardSlaMetrics(card);
                  if (sla.timeToPendenteSeconds === null && sla.pendenteToFinalizadoSeconds === null) return null;
                  return (
                    <div className="flex items-center gap-1 mt-1.5 pt-1.5 flex-wrap text-[10px] border-t border-white/[0.04]">
                      {sla.timeToPendenteSeconds !== null && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                            sla.isPendenteOngoing
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-white/[0.03] text-slate-400 border-white/[0.06]"
                          }`}
                          title={sla.isPendenteOngoing ? "Tempo em Nova Solicitação (em andamento)" : "Tempo até entrar em Pendente"}
                        >
                          <Clock size={9} className="shrink-0 opacity-70" />
                          <span>Pendente: <strong className="font-semibold text-white">{sla.timeToPendenteFormatted}</strong></span>
                        </span>
                      )}

                      {sla.pendenteToFinalizadoSeconds !== null && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                            card.status === "FINALIZADO"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : "bg-white/[0.03] text-slate-400 border-white/[0.06]"
                          }`}
                          title={card.status === "FINALIZADO" ? "Tempo de Pendente até Finalizado" : "Tempo decorrido desde Pendente"}
                        >
                          <CheckCircle2 size={9} className="shrink-0 opacity-70" />
                          <span>Finalizado: <strong className="font-semibold text-white">{sla.pendenteToFinalizadoFormatted}</strong></span>
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Rodapé: Valor Tabular Monospace + Tipo de Pagamento */}
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.06]">
                  <span
                    className="text-sm font-mono font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors"
                  >
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(card.amount))}
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full font-mono font-semibold bg-white/[0.06] border border-white/10 text-slate-300"
                  >
                    {card.payment_type === "RETIRADA_DE_SALDO" ? "Retirada" : card.payment_type}
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
