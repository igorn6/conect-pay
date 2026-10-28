"use client";

import React, { useState } from "react";
import {
  X,
  Pencil,
  AlertCircle,
  Loader2,
  DollarSign,
  FileText,
  Send,
  Bell,
  User,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/pushNotifications";
import type { PaymentRequest } from "@/types/database";

interface QuickEditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: PaymentRequest;
  userRole: string;
  userName: string;
  userId: string;
  profilesMap?: Record<string, string>;
  onSuccess: (updatedCard: PaymentRequest, msg?: string) => void;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default function QuickEditCardModal({
  isOpen,
  onClose,
  card,
  userRole,
  userName,
  userId,
  profilesMap = {},
  onSuccess,
}: QuickEditCardModalProps) {
  const [amountStr, setAmountStr] = useState(String(card.amount || ""));
  const [title, setTitle] = useState(card.title || "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const requesterId = card.real_requester_id || card.created_by;
  const requesterName =
    profilesMap[requesterId] || "Solicitante";

  const parseNumber = (val: string | number) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9,-.]/g, "").replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const currentAmount = Number(card.amount) || 0;
  const newAmount = parseNumber(amountStr);
  const diff = round2(newAmount - currentAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newAmount <= 0) {
      setErrorMsg("O novo valor deve ser maior que zero.");
      return;
    }

    if (!reason.trim()) {
      setErrorMsg("O motivo da alteração é obrigatório para compliance e notificação.");
      return;
    }

    if (!title.trim()) {
      setErrorMsg("O título da solicitação não pode ficar vazio.");
      return;
    }

    try {
      setLoading(true);

      // Ajusta splits se houver
      let updatedSplits = card.splits;
      if (Array.isArray(card.splits) && card.splits.length > 0) {
        if (card.splits.length === 1) {
          updatedSplits = [{ ...card.splits[0], amount: newAmount }];
        } else {
          // Proporcional
          const factor = currentAmount > 0 ? newAmount / currentAmount : 1;
          const sumOthers = card
            .splits.slice(0, -1)
            .reduce((acc, curr) => acc + round2(curr.amount * factor), 0);
          updatedSplits = card.splits.map((s, idx) => {
            if (idx === card.splits!.length - 1) {
              return { ...s, amount: round2(newAmount - sumOthers) };
            }
            return { ...s, amount: round2(s.amount * factor) };
          });
        }
      }

      const historyItem = {
        id:
          typeof window !== "undefined" && window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : Math.random().toString(36).substring(2),
        action: "DIRECT_EDIT",
        performed_by_id: userId,
        performed_by_name: userName || "Financeiro/Master",
        performed_by_role: userRole,
        performed_at: new Date().toISOString(),
        previous_amount: currentAmount,
        new_amount: newAmount,
        previous_title: card.title,
        new_title: title.trim(),
        reason: reason.trim(),
        changes_summary: `Valor alterado de R$ ${currentAmount.toFixed(2)} para R$ ${newAmount.toFixed(2)}`,
      };

      const existingHistory = Array.isArray(card.edit_history)
        ? card.edit_history
        : [];

      // 1. Atualizar no Supabase
      const { data: updatedCard, error: updateError } = await supabase
        .from("payment_requests")
        .update({
          amount: newAmount,
          title: title.trim(),
          splits: updatedSplits,
          pending_edit: null,
          edit_history: [historyItem, ...existingHistory],
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      // 2. Gravar no audit_logs
      await supabase.from("audit_logs").insert({
        request_id: card.id,
        performed_by: userId || card.created_by,
        action: `Alteração de dados por ${userName} (${userRole}): Valor alterado de R$ ${currentAmount.toFixed(2)} para R$ ${newAmount.toFixed(2)} (Título: "${title.trim()}"). Motivo: ${reason.trim()}`,
      });

      // 3. Notificar o solicitante diretamente via Web Push
      const formattedOld = currentAmount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const formattedNew = newAmount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

      try {
        await sendPushNotification({
          title: `✏️ Solicitação Alterada por ${userName}`,
          body: `O valor foi ajustado de ${formattedOld} para ${formattedNew}.\nMotivo: "${reason.trim()}"`,
          url: "/kanban",
          targetUserIds: requesterId ? [requesterId] : undefined,
          excludeUserId: userId || undefined,
        });
      } catch (pushErr) {
        console.warn("[QuickEditCardModal] Falha push:", pushErr);
      }

      onSuccess(
        updatedCard || { ...card, amount: newAmount, title: title.trim() },
        `Solicitação alterada com sucesso! ${requesterName} foi notificado(a).`
      );
      onClose();
    } catch (err: any) {
      console.error("[QuickEditCardModal] Erro ao salvar:", err);
      setErrorMsg(err.message || "Erro ao salvar alterações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(16,185,129,0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Pencil size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Editar Solicitação</span>
                <span className="text-[11px] font-mono font-normal text-slate-400">
                  #{card.id.substring(0, 8)}
                </span>
              </h2>
              <p className="text-xs text-slate-400 leading-tight">
                Permissão Master &amp; Financeiro • Alteração direta com notificação
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Solicitante Badge */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <User size={13} className="text-slate-400" />
              <span>Solicitante: <strong className="text-white font-semibold">{requesterName}</strong></span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400">
              <Bell size={11} />
              <span>Receberá notificação</span>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Valor da Solicitação (R$) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-slate-400">
                R$
              </span>
              <input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
                placeholder="0,00"
                className="w-full pl-11 pr-4 py-2.5 bg-slate-900/90 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-white font-mono text-base font-bold placeholder-slate-600 outline-hidden transition-all"
              />
            </div>
            {newAmount > 0 && newAmount !== currentAmount && (
              <p className="text-[11px] font-mono mt-1 text-slate-400 flex items-center gap-1.5">
                <span>Anterior: R$ {currentAmount.toFixed(2)}</span>
                <span>➔</span>
                <span className={diff > 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {diff > 0 ? `+ R$ ${diff.toFixed(2)}` : `- R$ ${Math.abs(diff).toFixed(2)}`}
                </span>
              </p>
            )}
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Título da Solicitação <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-white text-xs font-medium placeholder-slate-600 outline-hidden transition-all"
                placeholder="Ex: Abastecimento de veículo, Hotel..."
              />
            </div>
          </div>

          {/* Motivo da Alteração (Obrigatório) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Motivo da Alteração <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-amber-300 font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                Obrigatório
              </span>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo da alteração (ex: valor ajustado conforme notinha enviada, desconto de taxa, etc.)..."
              className="w-full p-3 bg-slate-900/90 border border-white/10 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-white text-xs placeholder-slate-500 outline-hidden transition-all resize-none"
            />
            <p className="text-[11px] text-slate-400 leading-tight mt-1">
              Este motivo será gravado no histórico de auditoria e enviado como justificativa para o solicitante.
            </p>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim() || newAmount <= 0}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Salvar e Notificar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
