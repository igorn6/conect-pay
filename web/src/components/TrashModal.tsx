"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PaymentRequest } from "@/types/database";

interface TrashModalProps {
  simulatedUserName: string;
  userId?: string;
  userRole?: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TrashModal({ simulatedUserName, userId, userRole, onClose, onUpdate }: TrashModalProps) {
  const [deletedCards, setDeletedCards] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const canEmptyTrash = true; // The trash icon in Kanban is already only visible to MASTER/FINANCEIRO

  const fetchDeletedCards = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_requests")
      .select("*")
      .eq("is_deleted", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Erro ao buscar lixeira.");
    } else {
      setDeletedCards(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeletedCards();
  }, [fetchDeletedCards]);

  async function handleRestore(card: PaymentRequest) {
    setActionLoading(card.id);
    const { error } = await supabase
      .from("payment_requests")
      .update({ is_deleted: false })
      .eq("id", card.id);

    if (error) {
      alert("Erro ao restaurar: " + error.message);
      setActionLoading(null);
      return;
    }

    // Log de auditoria silencioso
    await supabase.from("audit_logs").insert({
      action: `Card restaurado da lixeira (por ${simulatedUserName})`,
      request_id: card.id,
      performed_by: card.created_by,
    });

    await fetchDeletedCards();
    setActionLoading(null);
    onUpdate();
  }

  async function handleEmptyTrash() {
    if (!confirm("Tem certeza que deseja excluir PERMANENTEMENTE todos os itens da lixeira? Esta ao não pode ser desfeita.")) return;
    
    setActionLoading("empty");
    try {
      const res = await fetch("/api/trash/empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro desconhecido");
    } catch (err: any) {
      alert("Erro ao esvaziar lixeira: " + err.message);
      setActionLoading(null);
      return;
    }

    await fetchDeletedCards();
    setActionLoading(null);
    onUpdate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b" style={{ borderColor: "var(--surface-border)" }}>
          <div className="flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" />
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Lixeira</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center justify-center p-10 text-gray-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : deletedCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-gray-500">
              <Trash2 size={40} className="mb-2 opacity-50" />
              <p>A lixeira está vazia.</p>
            </div>
          ) : (
            deletedCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                <div>
                  <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{card.title}</h4>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(card.amount))} • {card.category}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(card)}
                  disabled={actionLoading === card.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700"
                >
                  {actionLoading === card.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Restaurar
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-t" style={{ borderColor: "var(--surface-border)" }}>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {deletedCards.length} item(s) na lixeira
          </div>
          {canEmptyTrash && deletedCards.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              disabled={actionLoading === "empty"}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20"
            >
              {actionLoading === "empty" ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
              Esvaziar Lixeira Definitivamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
