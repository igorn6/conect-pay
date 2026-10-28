"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileEdit,
  CreditCard,
  Calendar,
  Tag,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PAYMENT_TYPES } from "@/constants/requesters";
import { useCategories } from "@/hooks/useCategories";
import { sendPushNotification } from "@/lib/pushNotifications";
import type { PaymentRequest, SplitPayment, PendingEdit, PendingEditData } from "@/types/database";
import { v4 as uuidv4 } from "uuid";

interface ManualEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: PaymentRequest;
  userRole: "GESTOR" | "FINANCEIRO" | "MASTER" | string;
  userName: string;
  userId: string;
  onSuccess: (updatedCard?: any, msg?: string) => void;
}

export default function ManualEditModal({
  isOpen,
  onClose,
  card,
  userRole,
  userName,
  userId,
  onSuccess,
}: ManualEditModalProps) {
  const { categories } = useCategories();
  const isMaster = userRole === "MASTER";

  // Form states
  const [title, setTitle] = useState(card.title || "");
  const [amountStr, setAmountStr] = useState(String(card.amount || ""));
  const [categoryId, setCategoryId] = useState(card.category_id || "");
  const [categoryName, setCategoryName] = useState(card.category || "");
  const [notes, setNotes] = useState(card.notes || card.description || "");
  const [reason, setReason] = useState("");

  // Splits state
  const initialSplits = useMemo(() => {
    if (card.splits && card.splits.length > 0) {
      return card.splits.map((s) => ({
        id: s.id || uuidv4(),
        payment_type: s.payment_type || "Pix",
        amount: String(s.amount || ""),
        pix_owner: s.pix_owner || "",
        pix_key: s.pix_key || "",
        caju_phone: s.caju_phone || "",
        boleto_barcode: s.boleto_barcode || "",
        boleto_due_date: s.boleto_due_date || "",
        boleto_notes: s.boleto_notes || "",
      }));
    }
    return [
      {
        id: uuidv4(),
        payment_type: card.payment_type || card.payment_method || "Pix",
        amount: String(card.amount || ""),
        pix_owner: card.pix_owner || card.pix_name || "",
        pix_key: card.pix_key || "",
        caju_phone: card.caju_phone || "",
        boleto_barcode: "",
        boleto_due_date: "",
        boleto_notes: "",
      },
    ];
  }, [card]);

  const [splits, setSplits] = useState(initialSplits);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Confirmation modal for Master
  const [showMasterConfirm, setShowMasterConfirm] = useState(false);

  // Sync category name when categoryId changes
  useEffect(() => {
    if (categoryId && categories.length > 0) {
      const match = categories.find((c) => c.id === categoryId);
      if (match) setCategoryName(match.name);
    }
  }, [categoryId, categories]);

  if (!isOpen) return null;

  const handleAddSplit = () => {
    setSplits([
      ...splits,
      {
        id: uuidv4(),
        payment_type: "Pix",
        amount: "",
        pix_owner: "",
        pix_key: "",
        caju_phone: "",
        boleto_barcode: "",
        boleto_due_date: "",
        boleto_notes: "",
      },
    ]);
  };

  const handleRemoveSplit = (idx: number) => {
    if (splits.length <= 1) return;
    setSplits(splits.filter((_, i) => i !== idx));
  };

  const handleSplitChange = (idx: number, field: string, val: string) => {
    setSplits((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const parseNumber = (val: string | number) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9,-.]/g, "").replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const parsedTotal = parseNumber(amountStr);
  const splitsSum = splits.reduce((acc, s) => acc + parseNumber(s.amount), 0);
  const isSplitsSumMatching = Math.abs(parsedTotal - splitsSum) < 0.05 || splits.length === 1;

  const validateForm = () => {
    setErrorMsg("");
    if (!title.trim()) {
      setErrorMsg("O título da solicitação é obrigatório.");
      return false;
    }
    if (parsedTotal <= 0) {
      setErrorMsg("O valor total deve ser maior que zero.");
      return false;
    }
    if (!reason.trim()) {
      setErrorMsg("A justificativa/motivo do ajuste é obrigatória para compliance.");
      return false;
    }
    if (splits.length > 1 && Math.abs(parsedTotal - splitsSum) >= 0.05) {
      setErrorMsg(
        `A soma das formas de pagamento (R$ ${splitsSum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) deve ser igual ao valor total (R$ ${parsedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).`
      );
      return false;
    }
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (!s.payment_type) {
        setErrorMsg(`Selecione a forma de pagamento do item #${i + 1}.`);
        return false;
      }
      if (parseNumber(s.amount) <= 0) {
        setErrorMsg(`O valor da forma de pagamento #${i + 1} deve ser maior que zero.`);
        return false;
      }
    }
    return true;
  };

  const handleInitiateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isMaster) {
      // Master must explicitly confirm
      setShowMasterConfirm(true);
    } else {
      // Financeiro saves pending edit request
      submitFinanceiroPendingEdit();
    }
  };

  const buildFormattedSplits = (): SplitPayment[] => {
    return splits.map((s) => ({
      id: s.id,
      payment_type: s.payment_type,
      amount: parseNumber(s.amount),
      pix_owner: s.pix_owner?.trim() || null,
      pix_key: s.pix_key?.trim() || null,
      caju_phone: s.caju_phone?.trim() || null,
      boleto_barcode: s.boleto_barcode?.trim() || null,
      boleto_due_date: s.boleto_due_date || null,
      boleto_notes: s.boleto_notes?.trim() || null,
    }));
  };

  // Submit flow for Financeiro: creates pending_edit
  const submitFinanceiroPendingEdit = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const formattedSplits = buildFormattedSplits();
      const firstSplit = formattedSplits[0];

      const originalData: PendingEditData = {
        title: card.title,
        amount: Number(card.amount),
        category: card.category || null,
        category_id: card.category_id || null,
        notes: card.notes || card.description || null,
        payment_type: card.payment_type || card.payment_method || null,
        splits: card.splits || null,
        pix_key: card.pix_key || null,
        pix_owner: card.pix_owner || card.pix_name || null,
        caju_phone: card.caju_phone || null,
      };

      const newData: PendingEditData = {
        title: title.trim(),
        amount: parsedTotal,
        category: categoryName || card.category || null,
        category_id: categoryId || card.category_id || null,
        notes: notes.trim() || null,
        payment_type: firstSplit?.payment_type || "Pix",
        splits: formattedSplits,
        pix_key: formattedSplits.find((s) => s.payment_type === "Pix")?.pix_key || null,
        pix_owner: formattedSplits.find((s) => s.payment_type === "Pix")?.pix_owner || null,
        caju_phone: formattedSplits.find((s) => s.payment_type === "Caju")?.caju_phone || null,
      };

      const pendingEdit: PendingEdit = {
        requested_by_id: userId,
        requested_by_name: userName || "Financeiro",
        requested_at: new Date().toISOString(),
        reason: reason.trim(),
        original_data: originalData,
        new_data: newData,
      };

      // 1. Atualizar payment_requests
      const { data: updatedCard, error: updateError } = await supabase
        .from("payment_requests")
        .update({
          pending_edit: pendingEdit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      // 2. Gravar no audit_logs
      await supabase.from("audit_logs").insert({
        request_id: card.id,
        performed_by: userId,
        action: `Ajuste manual solicitado pelo Financeiro (${userName}): Título "${originalData.title}" ➔ "${newData.title}", Valor R$ ${originalData.amount.toFixed(2)} ➔ R$ ${newData.amount.toFixed(2)}. Motivo: ${reason.trim()}`,
      });

      // 3. Notificar Master via Web Push
      sendPushNotification({
        title: "⚠️ Ajuste Solicitado pelo Financeiro",
        body: `${userName} solicitou ajuste manual na solicitação #${card.id.substring(0, 6)} (${newData.title}). Autorização do Master obrigatória.`,
        url: "/kanban",
        targetRoles: ["MASTER"],
        excludeUserId: userId || undefined,
      });

      onSuccess(
        updatedCard,
        "Ajuste manual enviado com sucesso! Aguardando autorização do Master."
      );
      onClose();
    } catch (err: any) {
      console.error("Erro ao solicitar ajuste manual:", err);
      setErrorMsg(err.message || "Erro ao salvar solicitação de ajuste.");
    } finally {
      setLoading(false);
    }
  };

  // Submit flow for Master: confirms and applies immediately
  const submitMasterDirectEdit = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      const formattedSplits = buildFormattedSplits();
      const firstSplit = formattedSplits[0];

      const previousData: PendingEditData = {
        title: card.title,
        amount: Number(card.amount),
        category: card.category || null,
        category_id: card.category_id || null,
        notes: card.notes || card.description || null,
        payment_type: card.payment_type || card.payment_method || null,
        splits: card.splits || null,
        pix_key: card.pix_key || null,
        pix_owner: card.pix_owner || card.pix_name || null,
        caju_phone: card.caju_phone || null,
      };

      const appliedData: PendingEditData = {
        title: title.trim(),
        amount: parsedTotal,
        category: categoryName || card.category || null,
        category_id: categoryId || card.category_id || null,
        notes: notes.trim() || null,
        payment_type: firstSplit?.payment_type || "Pix",
        splits: formattedSplits,
        pix_key: formattedSplits.find((s) => s.payment_type === "Pix")?.pix_key || null,
        pix_owner: formattedSplits.find((s) => s.payment_type === "Pix")?.pix_owner || null,
        caju_phone: formattedSplits.find((s) => s.payment_type === "Caju")?.caju_phone || null,
      };

      const newHistoryItem = {
        id: uuidv4(),
        action: "DIRECT_EDIT",
        performed_by_id: userId,
        performed_by_name: userName || "Master",
        performed_at: new Date().toISOString(),
        reason: reason.trim(),
        changes_summary: `Ajuste direto realizado pelo Master: Título "${card.title}" ➔ "${appliedData.title}", Valor R$ ${Number(card.amount).toFixed(2)} ➔ R$ ${appliedData.amount.toFixed(2)}`,
        previous_data: previousData,
        applied_data: appliedData,
      };

      const existingHistory = Array.isArray(card.edit_history) ? card.edit_history : [];

      // 1. Atualizar payment_requests com os novos valores diretamente e limpar pending_edit
      const { data: updatedCard, error: updateError } = await supabase
        .from("payment_requests")
        .update({
          title: appliedData.title,
          amount: appliedData.amount,
          category: appliedData.category,
          category_id: appliedData.category_id,
          notes: appliedData.notes,
          payment_type: appliedData.payment_type,
          splits: appliedData.splits,
          pix_key: appliedData.pix_key,
          pix_owner: appliedData.pix_owner,
          caju_phone: appliedData.caju_phone,
          pending_edit: null,
          edit_history: [newHistoryItem, ...existingHistory],
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      // 2. Gravar no audit_logs
      await supabase.from("audit_logs").insert({
        request_id: card.id,
        performed_by: userId,
        action: `Ajuste manual confirmado e aplicado pelo Master (${userName}): Título "${previousData.title}" ➔ "${appliedData.title}", Valor R$ ${previousData.amount.toFixed(2)} ➔ R$ ${appliedData.amount.toFixed(2)}. Motivo: ${reason.trim()}`,
      });

      // 3. Notificar equipe
      sendPushNotification({
        title: "Solicitação Ajustada pelo Master",
        body: `O Master ${userName} confirmou e aplicou alterações na solicitação #${card.id.substring(0, 6)} (${appliedData.title}).`,
        url: "/kanban",
        targetRoles: ["FINANCEIRO", "GESTOR"],
        excludeUserId: userId || undefined,
      });

      onSuccess(updatedCard, "Solicitação alterada com sucesso pelo Master!");
      setShowMasterConfirm(false);
      onClose();
    } catch (err: any) {
      console.error("Erro ao aplicar alteração pelo Master:", err);
      setErrorMsg(err.message || "Erro ao salvar alteração.");
      setShowMasterConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full max-w-3xl rounded-2xl flex flex-col max-h-[92vh] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-700 bg-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <FileEdit size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Ajustar Dados da Solicitação</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    #{card.id.substring(0, 6)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {isMaster
                    ? "Como Master, você confirmará e aplicará as alterações diretamente."
                    : "Como Financeiro, este ajuste será enviado com as especificações para aprovação do Master."}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* NOTICE BANNER */}
          <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80">
            {isMaster ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <ShieldCheck size={15} className="shrink-0 text-emerald-400" />
                <span>
                  Perfil <strong>MASTER</strong> ativo: você precisará confirmar a alteração em uma etapa de segurança antes de aplicar.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                <span>
                  Perfil <strong>FINANCEIRO</strong>: as alterações serão salvas como proposta e necessitam de autorização do <strong>Master</strong> para entrar em vigor.
                </span>
              </div>
            )}
          </div>

          {/* FORM BODY */}
          <form onSubmit={handleInitiateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* DADOS BÁSICOS: TÍTULO, VALOR E CATEGORIA */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Título da Solicitação *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Pagamento Fornecedor de TI"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-all font-medium"
                />
              </div>

              <div className="md:col-span-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Valor Total (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">R$</span>
                  <input
                    type="text"
                    required
                    value={amountStr}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAmountStr(v);
                      if (splits.length === 1) {
                        handleSplitChange(0, "amount", v);
                      }
                    }}
                    placeholder="0,00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-emerald-400 font-bold placeholder-slate-500 outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* CATEGORIA E OBSERVAÇÕES */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Categoria
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-500 transition-all"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-6">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5">
                  Observações / Descrição Livre
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações complementares sobre esta solicitação..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-amber-500 transition-all resize-none"
                />
              </div>
            </div>

            {/* FORMAS DE PAGAMENTO & SPLITS */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Forma de Pagamento / Divisões (Splits)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSplit}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Adicionar Divisão</span>
                </button>
              </div>

              <div className="space-y-3">
                {splits.map((split, idx) => {
                  const isPix = split.payment_type?.toUpperCase() === "PIX";
                  const isCaju = split.payment_type?.toUpperCase() === "CAJU";
                  const isBoleto = split.payment_type?.toUpperCase() === "BOLETO";

                  return (
                    <div
                      key={split.id || idx}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 relative space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase text-slate-400">
                          Item #{idx + 1}
                        </span>
                        {splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplit(idx)}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            title="Remover forma de pagamento"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-5">
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Tipo de Pagamento
                          </label>
                          <select
                            value={split.payment_type}
                            onChange={(e) => handleSplitChange(idx, "payment_type", e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                          >
                            {PAYMENT_TYPES.map((pt) => (
                              <option key={pt} value={pt}>
                                {pt}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-7">
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Valor deste Pagamento (R$)
                          </label>
                          <input
                            type="text"
                            value={split.amount}
                            onChange={(e) => handleSplitChange(idx, "amount", e.target.value)}
                            placeholder="0,00"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Campos específicos Pix */}
                      {isPix && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Chave Pix
                            </label>
                            <input
                              type="text"
                              value={split.pix_key || ""}
                              onChange={(e) => handleSplitChange(idx, "pix_key", e.target.value)}
                              placeholder="CPF, CNPJ, e-mail, celular ou aleatória"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Titular da Chave Pix
                            </label>
                            <input
                              type="text"
                              value={split.pix_owner || ""}
                              onChange={(e) => handleSplitChange(idx, "pix_owner", e.target.value)}
                              placeholder="Nome do favorecido"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}

                      {/* Campos específicos Caju */}
                      {isCaju && (
                        <div className="pt-1 border-t border-slate-800/80">
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Titular / Celular Caju
                          </label>
                          <input
                            type="text"
                            value={split.caju_phone || ""}
                            onChange={(e) => handleSplitChange(idx, "caju_phone", e.target.value)}
                            placeholder="Nome do colaborador ou telefone cadastrado no Caju"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                          />
                        </div>
                      )}

                      {/* Campos específicos Boleto */}
                      {isBoleto && (
                        <div className="space-y-2 pt-1 border-t border-slate-800/80">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                              Linha Digitável / Código de Barras
                            </label>
                            <input
                              type="text"
                              value={split.boleto_barcode || ""}
                              onChange={(e) => handleSplitChange(idx, "boleto_barcode", e.target.value)}
                              placeholder="Linha digitável do boleto..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                                Data de Vencimento
                              </label>
                              <input
                                type="date"
                                value={split.boleto_due_date || ""}
                                onChange={(e) => handleSplitChange(idx, "boleto_due_date", e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                                Titular / Beneficiário
                              </label>
                              <input
                                type="text"
                                value={split.pix_owner || ""}
                                onChange={(e) => handleSplitChange(idx, "pix_owner", e.target.value)}
                                placeholder="Ex: CREA, CEMIG, Empresa..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                                Observações do Boleto
                              </label>
                              <input
                                type="text"
                                value={split.boleto_notes || ""}
                                onChange={(e) => handleSplitChange(idx, "boleto_notes", e.target.value)}
                                placeholder="Descontos, juros ou instruções"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {splits.length > 1 && (
                <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <span className="text-slate-400">Soma das divisões:</span>
                  <span
                    className={`font-bold ${
                      isSplitsSumMatching ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    R$ {splitsSum.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R 
                    {parsedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {/* JUSTIFICATIVA / MOTIVO DO AJUSTE (OBRIGATÓRIO) */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1.5">
                <AlertCircle size={14} className="text-amber-400" />
                <span>Motivo / Justificativa do Ajuste *</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Especifique detalhadamente por que essas informações estão sendo alteradas (ex: renegociação do valor com fornecedor, chave Pix incorreta digitada inicialmente, correção de titularidade, etc.)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-all leading-relaxed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Esta especificação ficará registrada no log de auditoria e será exibida ao Master na tela de aprovação.
              </p>
            </div>
          </form>

          {/* FOOTER */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleInitiateSubmit}
              disabled={loading}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer ${
                isMaster
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30"
                  : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : isMaster ? (
                <>
                  <ShieldCheck size={15} />
                  <span>Revisar e Confirmar (Master)</span>
                </>
              ) : (
                <>
                  <FileEdit size={15} />
                  <span>Solicitar Autorização do Master</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DO MASTER */}
      {showMasterConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border-2 border-emerald-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Confirmar Alteração da Solicitação</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Você é o usuário Master. Confirme que realmente deseja aplicar estas alterações agora.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Título:</span>
                <span className="text-white font-semibold truncate max-w-[200px]" title={title}>
                  {title}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Novo Valor Total:</span>
                <span className="text-emerald-400 font-bold">
                  R$ {parsedTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Formas de Pagamento:</span>
                <span className="text-slate-200 font-medium">
                  {splits.map((s) => s.payment_type).join(", ")}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-slate-400 block mb-1">Motivo informado:</span>
                <p className="text-slate-300 italic bg-slate-900 p-2 rounded border border-slate-800 text-[11px]">
                  "{reason.trim()}"
                </p>
              </div>
            </div>

            <p className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              ⚠️ Esta ação atualizará os dados da solicitação imediatamente e será registrada de forma irrevogável no log de auditoria.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMasterConfirm(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Voltar e Ajustar
              </button>

              <button
                type="button"
                onClick={submitMasterDirectEdit}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition-all cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Sim, Confirmar e Alterar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
