"use client";

import type { KanbanColumnConfig, PaymentRequest } from "@/types/database";
import { Inbox, User, Check } from "lucide-react";

interface KanbanColumnProps {
  config: KanbanColumnConfig;
  cards: PaymentRequest[];
  onCardClick: (card: PaymentRequest) => void;
  profilesMap?: Record<string, string>;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[], isAdding: boolean) => void;
}

/**
 * Coluna individual do Kanban.
 * Renderiza o cabeçalho com indicador de cor + badge de contagem
 * e a lista de cards (ou um estado vazio).
 */
export default function KanbanColumn({ config, cards, onCardClick, selectable = false, selectedIds = new Set(), onToggleSelect, onSelectAll, profilesMap = {} }: KanbanColumnProps) {
  const hasColor = ["CORRECAO_PENDENTE", "FINALIZADO", "RECUSADO"].includes(config.key);

  return (
    <div
      className="flex flex-col min-w-[280px] flex-1 rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--surface-border)",
        borderTop: hasColor ? `3px solid ${config.color}` : undefined,
      }}
    >
      {/* ─── Header da Coluna ─────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3"
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
        className="flex-1 p-3 overflow-y-auto"
        style={{ minHeight: "calc(100vh - 200px)" }}
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
          <div className="flex flex-col gap-2.5">
            {cards.map((card) => (
              <div
                key={card.id}
                onClick={() => onCardClick(card)}
                className="p-3.5 rounded-lg cursor-pointer"
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
                {/* Título */}
                <div className="flex items-start justify-between gap-2">
                <h3
                  className="text-sm font-semibold truncate flex-1"
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

                {/* Categoria */}
                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {card.category}
                </p>

                {/* Solicitante Real */}
                <div className="flex items-center gap-1.5 mt-2">
                  <User size={12} style={{ color: "var(--text-muted)" }} />
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido"}
                  </span>
                </div>

                {/* Valor + Tipo de Pagamento */}
                <div className="flex items-center justify-between mt-3">
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
                    {card.payment_type}
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
