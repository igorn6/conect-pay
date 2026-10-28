"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  X, ArrowRight, Loader2, CreditCard, Calendar, User, AlignLeft, Tag,
  Ban, Trash2, Mail, UploadCloud, CheckCircle2, Copy, FileText, Building2,
  ShieldCheck, ShieldAlert, Zap, ChevronDown, ChevronUp, History, AlertTriangle, MessageSquare, ExternalLink, Maximize2, Clock, Timer, Sparkles,
  AlertCircle, Info, RefreshCw, RotateCcw, Undo2, FileEdit, Pencil
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useCategories } from "@/hooks/useCategories";
import type { PaymentRequest, ReceiptHistoryItem, StageHistoryItem, PaymentConversionLog } from "@/types/database";
import { getStatusLabel } from "@/constants/kanban";
import { computeNextStageHistory, getCardSlaMetrics, formatSlaDuration } from "@/utils/sla";
import { syncNubankBalance } from "@/lib/nubankClient";
import { sendPushNotification } from "@/lib/pushNotifications";
import ManualEditModal from "./ManualEditModal";
import QuickEditCardModal from "./QuickEditCardModal";

const NEXT_STATUS: Record<string, string> = {
  NOVA_SOLICITACAO: "EM_APROVACAO",
  EM_APROVACAO: "AGUARDANDO_PAGAMENTO",
  VALIDADO_GESTOR: "AGUARDANDO_PAGAMENTO",
  AGUARDANDO_PAGAMENTO: "FINALIZADO",
};

const CNPJ_OPTIONS = ["Nubank 02", "CNPJ 1", "CNPJ 2", "CNPJ 3", "CNPJ 4"];

interface CardDetailModalProps {
  card: PaymentRequest;
  userRole: "GESTOR" | "FINANCEIRO" | "MASTER" | string;
  simulatedUserName: string;
  onClose: () => void;
  profilesMap?: Record<string, string>;
  onUpdate: (msg?: string) => void;
}

export default function CardDetailModal({
  card,
  userRole,
  simulatedUserName,
  onClose,
  onUpdate,
  profilesMap = {},
}: CardDetailModalProps) {
  const { userId, sectorId, userName } = useAuth();
  const { setIsChatOpen, setPendingCard, allProfiles, setActiveChatId, startChat, openChatWithCard } = useChat();
  const [loading, setLoading] = useState(false);
  const [showRefuseForm, setShowRefuseForm] = useState(false);
  const [refusalReason, setRefusalReason] = useState(card.refusal_reason || "");
  const [errorMsg, setErrorMsg] = useState("");

  // Maker-Checker
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editHistoryOpen, setEditHistoryOpen] = useState(true);

  // Payment Proof (Type A - Financeiro)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(card.payment_proof_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const correctionInputRef = useRef<HTMLInputElement>(null);

  // Invoice / Notinha (Type B - Gestor)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(card.invoice_url || null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  // Identificação de FOPAG (Folha de Pagamento)
  const isFopag = useMemo(() => {
    const mainType = (card.payment_type || card.payment_method || "").toUpperCase();
    if (mainType === "FOPAG") return true;
    if (Array.isArray(card.splits) && card.splits.some((s: any) => (s.payment_type || "").toUpperCase() === "FOPAG")) return true;
    const cat = (card.category || "").toUpperCase();
    if (cat.includes("FOPAG") || cat.includes("FOLHA")) return true;
    return false;
  }, [card.payment_type, card.payment_method, card.splits, card.category]);

  // Identificação das formas de pagamento e obrigatoriedade de CNPJ
  const { isCajuOnly, requiresCnpj, isPix, isBoleto } = useMemo(() => {
    const splits = Array.isArray(card.splits) && card.splits.length > 0
      ? card.splits
      : [{ payment_type: card.payment_type || card.payment_method }];

    const hasPix = splits.some((s: any) => (s.payment_type || "").toUpperCase() === "PIX") ||
      (card.payment_type || "").toUpperCase() === "PIX" ||
      (card.payment_method || "").toUpperCase() === "PIX";

    const hasBoleto = splits.some((s: any) => (s.payment_type || "").toUpperCase() === "BOLETO") ||
      (card.payment_type || "").toUpperCase() === "BOLETO" ||
      (card.payment_method || "").toUpperCase() === "BOLETO";

    const hasCaju = splits.some((s: any) => (s.payment_type || "").toUpperCase() === "CAJU") ||
      (card.payment_type || "").toUpperCase() === "CAJU" ||
      (card.payment_method || "").toUpperCase() === "CAJU";

    // Se for exclusivamente Caju (sem Pix e sem Boleto), NÃO exige CNPJ
    const isCajuOnly = hasCaju && !hasPix && !hasBoleto;
    const requiresCnpj = !isCajuOnly;

    return { isCajuOnly, requiresCnpj, isPix: hasPix, isBoleto: hasBoleto };
  }, [card.splits, card.payment_type, card.payment_method]);

  const [copiedKey, setCopiedKey] = useState(false);
  const [localCnpj, setLocalCnpj] = useState<string>(
    card.cnpj === "Nubank" ? "Nubank 02" : (card.cnpj || (isFopag ? "CNPJ 2" : ""))
  );

  useEffect(() => {
    if (card.cnpj) {
      setLocalCnpj(card.cnpj === "Nubank" ? "Nubank 02" : card.cnpj);
    } else if (isFopag) {
      setLocalCnpj("CNPJ 2");
      supabase.from("payment_requests").update({ cnpj: "CNPJ 2" }).eq("id", card.id);
    } else {
      setLocalCnpj("");
    }
  }, [card.id, card.cnpj, isFopag]);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [resolvedRequesterName, setResolvedRequesterName] = useState<string>("");
  const [emailCopied, setEmailCopied] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [descriptionCopied, setDescriptionCopied] = useState(false);
  const [stageHistoryOpen, setStageHistoryOpen] = useState(false);

  // Conversão de Caju para Pix Pós-Fechamento / Reabertura
  const [showCajuToPixModal, setShowCajuToPixModal] = useState(false);
  const [cajuPixKey, setCajuPixKey] = useState(
    card.payment_conversion_log?.collaboratorPixKey || card.pix_key || card.caju_phone || ""
  );
  const [cajuPixOwner, setCajuPixOwner] = useState(
    card.pix_owner || card.pix_name || ""
  );
  const [cajuAmount, setCajuAmount] = useState(
    Number(card.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [cajuTargetStatus, setCajuTargetStatus] = useState<"CORRECAO_PENDENTE" | "FINALIZADO" | "AGUARDANDO_PAGAMENTO">("CORRECAO_PENDENTE");
  const [cajuReason, setCajuReason] = useState(
    card.payment_conversion_log?.reason || "Local não aceita Caju / Falha no cartão"
  );
  const [cajuBalanceWithdrawn, setCajuBalanceWithdrawn] = useState(
    card.payment_conversion_log ? card.payment_conversion_log.cajuBalanceWithdrawn : true
  );
  const [cajuPixFile, setCajuPixFile] = useState<File | null>(null);
  const [isConvertingCajuPix, setIsConvertingCajuPix] = useState(false);
  const [cajuPixError, setCajuPixError] = useState("");
  const cajuPixFileInputRef = useRef<HTMLInputElement>(null);

  // Modal de Reabertura e Mudança de Status para Cards Finalizados
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenTargetStatus, setReopenTargetStatus] = useState<"AGUARDANDO_PAGAMENTO" | "CORRECAO_PENDENTE" | "EM_APROVACAO">("AGUARDANDO_PAGAMENTO");
  const [reopenReason, setReopenReason] = useState("");
  const [isReopening, setIsReopening] = useState(false);

  function parseBRLInput(val: string): number {
    if (!val) return NaN;
    const clean = val.replace(/[R$\s]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    }
    if (clean.includes(",")) {
      return parseFloat(clean.replace(/\s/g, "").replace(",", "."));
    }
    return parseFloat(clean.replace(/\s/g, ""));
  }

  function handleCurrencyFieldChange(val: string, setter: (v: string) => void) {
    let clean = val.replace(/\D/g, "");
    if (!clean) {
      setter("");
      return;
    }
    const num = parseInt(clean, 10) / 100;
    setter(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  const isCajuMealRequest = useMemo(() => {
    if (card.payment_conversion_log) return true;
    const method = (card.payment_method || "").toUpperCase();
    const type = (card.payment_type || "").toUpperCase();
    if (method.includes("CAJU") || type.includes("CAJU")) return true;
    if (
      Array.isArray(card.splits) &&
      card.splits.some((s: any) => String(s.payment_type || "").toUpperCase() === "CAJU")
    ) {
      return true;
    }
    if (card.caju_phone) return true;
    const cat = (card.category || "").toUpperCase();
    if (
      cat.includes("REFEIÇÃO") ||
      cat.includes("REFEICAO") ||
      cat.includes("ALIMENTAÇÃO") ||
      cat.includes("ALIMENTACAO") ||
      cat.includes("CAJU")
    ) {
      return true;
    }
    const title = (card.title || "").toUpperCase();
    if (title.includes("CAJU")) return true;
    return false;
  }, [
    card.payment_conversion_log,
    card.payment_method,
    card.payment_type,
    card.splits,
    card.caju_phone,
    card.category,
    card.title,
  ]);

  const { categories } = useCategories();
  const [localCategory, setLocalCategory] = useState<string>(card.category || "Outros");
  const [isReclassifyingCategory, setIsReclassifyingCategory] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isCustomCategoryModal, setIsCustomCategoryModal] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  useEffect(() => {
    setLocalCategory(card.category || "Outros");
  }, [card.category]);

  const handleCategoryChange = async (newCategoryName: string) => {
    if (!newCategoryName) return;
    if (newCategoryName === "__CUSTOM__") {
      setIsCustomCategoryModal(true);
      setCustomCategoryInput("");
      return;
    }
    try {
      setIsSavingCategory(true);
      const matchedCat = categories.find(
        (c) => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()
      );

      const { error } = await supabase
        .from("payment_requests")
        .update({
          category: newCategoryName,
          category_id: matchedCat?.id || null,
        })
        .eq("id", card.id);

      if (error) throw error;
      setLocalCategory(newCategoryName);
      onUpdate(`Categoria alterada para "${newCategoryName}"!`);
    } catch (e: any) {
      alert("Erro ao alterar categoria: " + e.message);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveCustomCategory = async () => {
    const trimmed = customCategoryInput.trim();
    if (!trimmed) {
      setIsCustomCategoryModal(false);
      return;
    }
    await handleCategoryChange(trimmed);
    setIsCustomCategoryModal(false);
  };

  const handleAiRecategorize = async () => {
    try {
      setIsReclassifyingCategory(true);
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: card.title,
          notes: card.notes || card.description,
          amount: card.amount,
          saveSuggestion: true,
          requestId: card.id,
        }),
      });

      if (!res.ok) throw new Error("Falha ao consultar IA");
      const data = await res.json();
      const chosen = data.is_new_category_suggested
        ? (data.suggested_category_name || "Outros")
        : (data.category || "Outros");

      const matchedCat = categories.find(
        (c) => c.name.toLowerCase() === chosen.trim().toLowerCase()
      );

      const { error } = await supabase
        .from("payment_requests")
        .update({
          category: chosen,
          category_id: matchedCat?.id || null,
          ai_category_suggestion: data,
        })
        .eq("id", card.id);

      if (error) throw error;
      setLocalCategory(chosen);
      onUpdate(`Categoria atualizada pela IA para "${chosen}"!`);
    } catch (e: any) {
      alert("Erro ao reclassificar com IA: " + e.message);
    } finally {
      setIsReclassifyingCategory(false);
    }
  };

  // Status helpers
  const isNovaSolicitacao = card.status === "NOVA_SOLICITACAO";
  const isEmAprovacao = card.status === "EM_APROVACAO";
  
  const isValidacaoGestor = card.status === "VALIDACAO_GESTOR";
  const isValidadoGestor = card.status === "VALIDADO_GESTOR";
  const isCorrecaoPendente = card.status === "CORRECAO_PENDENTE";
  const isFinalizado = card.status === "FINALIZADO";

  const isMaster = userRole === "MASTER";

  // Estados para Edição Manual e Autorização Master
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showMasterAuthModal, setShowMasterAuthModal] = useState(false);
  const [isAuthorizingEdit, setIsAuthorizingEdit] = useState(false);
  const [showRejectEditModal, setShowRejectEditModal] = useState(false);
  const [rejectEditReason, setRejectEditReason] = useState("");
  const [isRejectingEdit, setIsRejectingEdit] = useState(false);

  const handleMasterApproveEdit = async () => {
    if (!card.pending_edit) return;
    try {
      setIsAuthorizingEdit(true);
      const pending = card.pending_edit;
      const newData = pending.new_data;

      const historyItem = {
        id: (typeof window !== "undefined" && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2)),
        action: "AUTHORIZED",
        performed_by_id: userId,
        performed_by_name: userName || "Master",
        performed_at: new Date().toISOString(),
        reason: pending.reason,
        changes_summary: `Alteração autorizada pelo Master: Título "${card.title}" ➔ "${newData.title}", Valor R$ ${Number(card.amount).toFixed(2)} ➔ R$ ${Number(newData.amount).toFixed(2)}`,
        previous_data: pending.original_data,
        applied_data: newData,
      };

      const existingHistory = Array.isArray(card.edit_history) ? card.edit_history : [];

      const { data: updatedCard, error: updateError } = await supabase
        .from("payment_requests")
        .update({
          title: newData.title,
          amount: newData.amount,
          category: newData.category,
          category_id: newData.category_id,
          notes: newData.notes,
          payment_type: newData.payment_type,
          splits: newData.splits,
          pix_key: newData.pix_key,
          pix_owner: newData.pix_owner,
          caju_phone: newData.caju_phone,
          pending_edit: null,
          edit_history: [historyItem, ...existingHistory],
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      // Atualiza o objeto card em memória
      if (updatedCard) {
        Object.assign(card, updatedCard);
      } else {
        card.title = newData.title;
        card.amount = newData.amount;
        card.category = newData.category || null;
        card.category_id = newData.category_id || "";
        card.notes = newData.notes || null;
        card.payment_type = newData.payment_type || null;
        card.splits = newData.splits || null;
        card.pending_edit = null;
      }

      // Log de auditoria
      await supabase.from("audit_logs").insert({
        request_id: card.id,
        performed_by: userId || card.created_by,
        action: `Alteração de dados autorizada e confirmada pelo Master (${userName}): Título "${card.title}" ➔ "${newData.title}", Valor R$ ${Number(pending.original_data.amount).toFixed(2)} ➔ R$ ${Number(newData.amount).toFixed(2)}. Solicitado por ${pending.requested_by_name}. Motivo: ${pending.reason}`,
      });

      // Notificação
      sendPushNotification({
        title: "Ajuste Autorizado pelo Master",
        body: `O Master ${userName} autorizou e aplicou as alterações na solicitação #${card.id.substring(0, 6)} (${newData.title}).`,
        url: "/kanban",
        targetRoles: ["FINANCEIRO", "GESTOR"],
        excludeUserId: userId || undefined,
      });

      setShowMasterAuthModal(false);
      onUpdate("Alterações autorizadas e confirmadas com sucesso pelo Master!");
    } catch (err: any) {
      console.error("Erro ao autorizar alteração:", err);
      alert("Erro ao autorizar alteração: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsAuthorizingEdit(false);
    }
  };

  const handleMasterRejectEdit = async () => {
    if (!card.pending_edit) return;
    try {
      setIsRejectingEdit(true);
      const pending = card.pending_edit;

      const historyItem = {
        id: (typeof window !== "undefined" && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).substring(2)),
        action: "REJECTED",
        performed_by_id: userId,
        performed_by_name: userName || "Master",
        performed_at: new Date().toISOString(),
        reason: rejectEditReason.trim() || "Sem justificativa de recusa",
        changes_summary: `Ajuste solicitado por ${pending.requested_by_name} foi recusado pelo Master`,
        previous_data: pending.original_data,
        applied_data: pending.new_data,
      };

      const existingHistory = Array.isArray(card.edit_history) ? card.edit_history : [];

      const { data: updatedCard, error: updateError } = await supabase
        .from("payment_requests")
        .update({
          pending_edit: null,
          edit_history: [historyItem, ...existingHistory],
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      card.pending_edit = null;

      // Log de auditoria
      await supabase.from("audit_logs").insert({
        request_id: card.id,
        performed_by: userId || card.created_by,
        action: `Ajuste solicitado por ${pending.requested_by_name} foi recusado pelo Master (${userName}). Motivo da recusa: ${rejectEditReason.trim() || "Não especificado"}`,
      });

      // Notificação
      sendPushNotification({
        title: "Ajuste Recusado pelo Master",
        body: `O Master ${userName} recusou o pedido de ajuste na solicitação #${card.id.substring(0, 6)}.`,
        url: "/kanban",
        targetRoles: ["FINANCEIRO"],
        excludeUserId: userId || undefined,
      });

      setShowRejectEditModal(false);
      onUpdate("Pedido de alteração recusado pelo Master.");
    } catch (err: any) {
      console.error("Erro ao recusar alteração:", err);
      alert("Erro ao recusar alteração: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsRejectingEdit(false);
    }
  };

  const handleCancelPendingEdit = async () => {
    if (!window.confirm("Deseja cancelar o seu pedido de alteração para esta solicitação?")) return;
    try {
      setLoading(true);
      await supabase
        .from("payment_requests")
        .update({
          pending_edit: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", card.id);

      card.pending_edit = null;

      await supabase.from("audit_logs").insert({
        request_id: card.id,
        performed_by: userId || card.created_by,
        action: `Pedido de alteração manual cancelado pelo solicitante (${userName}).`,
      });

      onUpdate("Pedido de alteração cancelado.");
    } catch (e: any) {
      alert("Erro ao cancelar pedido: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const isMasterOrFinanceiro = userRole === "FINANCEIRO" || userRole === "MASTER";
  const canTrash = isMasterOrFinanceiro;
  const hasAttachment = !!paymentProofUrl;
  const isTransitionBlocked = isEmAprovacao && !paymentProofUrl;

  const isRecharge = card.request_kind === "RECARGA_NUBANK" || card.request_kind === "RECARGA_CAJU";

  // Bloqueio de avanço para Pendente caso falte CNPJ (não bloqueia se for Caju ou Recargas)
  const isAdvanceToPendenteBlocked = !isRecharge && isNovaSolicitacao && requiresCnpj && !localCnpj;

  // Solicitar pagamento é exclusivo e prioritário para Pendente (EM_APROVACAO) e Correção Pendente
  const canRequestPayment = (isPix || isBoleto || isRecharge) && isMasterOrFinanceiro && (isEmAprovacao || isCorrecaoPendente);

  const [emailModalType, setEmailModalType] = useState<"PAID_NUBANK" | "REQUEST">(
    canRequestPayment ? "REQUEST" : "PAID_NUBANK"
  );

  useEffect(() => {
    setEmailModalType(canRequestPayment ? "REQUEST" : "PAID_NUBANK");
  }, [card.id, card.status, isPix, isBoleto, isRecharge]);

  const canAdvance = isMasterOrFinanceiro && (isRecharge ? card.status !== "FINALIZADO" : Boolean(NEXT_STATUS[card.status]));
  const canRefuseFinanceiro = isMasterOrFinanceiro && card.status !== "RECUSADO" && card.status !== "FINALIZADO";
  const canCancelGestor = userRole === "GESTOR" && card.status !== "RECUSADO" && card.status !== "FINALIZADO";
  const canRefuse = canRefuseFinanceiro || canCancelGestor;

  // Setor e dados do solicitante
  const [requesterSectorId, setRequesterSectorId] = useState<string | null>(null);
  const [requesterSectorName, setRequesterSectorName] = useState<string | null>(null);

  // Permissões colaborativas: criador original OU membro do mesmo setor OU Master
  const isCreator = userId === card.created_by || userId === card.real_requester_id;
  const isSameSector = Boolean(sectorId && requesterSectorId && String(sectorId) === String(requesterSectorId));
  const canActAsRequester = isCreator || isSameSector || userRole === "MASTER";

  // Receipts history
  const [receiptsHistory, setReceiptsHistory] = useState<ReceiptHistoryItem[]>(
    (card.receipts_history as ReceiptHistoryItem[] | null) || []
  );

  useEffect(() => {
    setReceiptsHistory((card.receipts_history as ReceiptHistoryItem[] | null) || []);
  }, [card.receipts_history]);

  useEffect(() => {
    setPaymentProofUrl(card.payment_proof_url || null);
  }, [card.payment_proof_url, card.id]);

  useEffect(() => {
    setInvoiceUrl(card.invoice_url || null);
  }, [card.invoice_url, card.id]);

  // Re-hidratação atômica: garante que o modal sempre tenha os anexos mais recentes do banco
  useEffect(() => {
    let isMounted = true;
    async function loadFreshCardData() {
      if (!card.id) return;
      try {
        const { data, error } = await supabase
          .from("payment_requests")
          .select("payment_proof_url, invoice_url, receipts_history, receipt_url, cnpj")
          .eq("id", card.id)
          .maybeSingle();

        if (!error && data && isMounted) {
          if (data.payment_proof_url !== undefined && data.payment_proof_url !== null) {
            setPaymentProofUrl(data.payment_proof_url);
          }
          if (data.invoice_url !== undefined && data.invoice_url !== null) {
            setInvoiceUrl(data.invoice_url);
          }
          if (Array.isArray(data.receipts_history) && data.receipts_history.length > 0) {
            setReceiptsHistory(data.receipts_history as ReceiptHistoryItem[]);
          }
          if (data.cnpj !== undefined && data.cnpj !== null) {
            setLocalCnpj(data.cnpj);
          }
        }
      } catch (err) {
        console.warn("[CardDetailModal] Falha ao recarregar dados do card:", err);
      }
    }
    loadFreshCardData();
    return () => { isMounted = false; };
  }, [card.id]);

  // Agrega todas as URLs de comprovante para garantir que o solicitante sempre veja tudo o que foi anexado
  const effectiveProofUrls = useMemo(() => {
    const urls = new Set<string>();
    const addUrlString = (str?: string | null) => {
      if (!str) return;
      str.split(",").map((s) => s.trim()).filter(Boolean).forEach((u) => urls.add(u));
    };
    addUrlString(paymentProofUrl);
    addUrlString(card.payment_proof_url);
    addUrlString((card as any).receipt_url);
    if (Array.isArray(receiptsHistory)) {
      receiptsHistory.forEach((r) => { if (r?.url) urls.add(r.url.trim()); });
    }
    if (Array.isArray(card.receipts_history)) {
      (card.receipts_history as any[]).forEach((r) => { if (r?.url) urls.add(r.url.trim()); });
    }
    return Array.from(urls);
  }, [paymentProofUrl, card.payment_proof_url, (card as any).receipt_url, receiptsHistory, card.receipts_history]);

  const latestReceipt = receiptsHistory.length > 0 ? receiptsHistory[receiptsHistory.length - 1] : null;

  // Stage history & SLA
  const stageHistory: StageHistoryItem[] = (card.stage_history as StageHistoryItem[] | null) || [];
  const cardSla = getCardSlaMetrics(card);

  // Resolver nome e setor do gestor solicitante real
  useEffect(() => {
    async function loadRequesterInfo() {
      const targetUserId = card.real_requester_id || card.created_by;
      if (!targetUserId) return;
      try {
        let profileData: { name?: string; sector?: string } | null = null;
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, sector")
          .eq("id", targetUserId)
          .maybeSingle();

        if (profile) {
          profileData = profile;
        } else {
          // Fallback via API se Supabase client retornar vazio
          const res = await fetch("/api/admin/users", { cache: "no-store" });
          if (res.ok) {
            const allUsers = await res.json();
            const found = allUsers.find((u: any) => u.id === targetUserId);
            if (found) profileData = found;
          }
        }

        if (profileData?.name) {
          setResolvedRequesterName(profileData.name);
        }
        if (profileData?.sector) {
          setRequesterSectorId(profileData.sector);
          const { data: sec } = await supabase
            .from("sectors")
            .select("name")
            .eq("id", profileData.sector)
            .maybeSingle();
          if (sec?.name) {
            setRequesterSectorName(sec.name);
          }
        }
      } catch (e) {
        console.error("Erro ao buscar solicitante:", e);
      }
    }
    loadRequesterInfo();
  }, [card.real_requester_id, card.created_by]);

  const requesterName =
    resolvedRequesterName ||
    profilesMap[card.real_requester_id || ""] ||
    profilesMap[card.created_by] ||
    (card.request_kind === "RECARGA_NUBANK" && (card.created_by === userId || card.real_requester_id === userId) ? (userName || "Solicitante") : "") ||
    "Desconhecido";

  // ========== HANDLERS ==========

  async function handleAdvance(targetStatus?: string) {
    if (!isMasterOrFinanceiro) return;
    let newStatus = targetStatus;
    const isNubankRecharge = card.request_kind === "RECARGA_NUBANK";
    const isCajuRecharge = card.request_kind === "RECARGA_CAJU";
    const isRechargeCard = isNubankRecharge || isCajuRecharge;

    if (isRechargeCard) {
      if (card.status === "NOVA_SOLICITACAO") {
        newStatus = "EM_APROVACAO";
      } else if (card.status === "EM_APROVACAO" || targetStatus === "FINALIZADO") {
        newStatus = "FINALIZADO";
      } else if (targetStatus) {
        newStatus = targetStatus;
      } else {
        newStatus = NEXT_STATUS[card.status] || "FINALIZADO";
      }
    } else if (!newStatus) {
      if (card.status === "AGUARDANDO_PAGAMENTO" || (card.status as string) === "AGUARDANDO_NOTINHA") {
        newStatus = "FINALIZADO";
      } else {
        newStatus = NEXT_STATUS[card.status];
      }
    }
    if (!newStatus) return;
    if (isTransitionBlocked && !isRechargeCard) return;

    // Regra de negócio: Só é permitido avançar para Pendente (EM_APROVACAO) se selecionar o CNPJ ou se é Nubank.
    // (Se for Caju ou Recarga, não é necessário travar por CNPJ).
    if (!isRechargeCard && newStatus === "EM_APROVACAO" && requiresCnpj && !localCnpj) {
      alert("Para avançar esta solicitação para Pendente, é obrigatório selecionar a Conta Pagadora / CNPJ (ou Nubank 02).");
      return;
    }

    setLoading(true);

    const nextStageHistory = computeNextStageHistory(
      card.stage_history,
      card.status,
      newStatus,
      userId,
      card.created_at
    );

    const effectiveCnpj = localCnpj || (card.request_kind === "RECARGA_NUBANK" ? "Nubank 02" : (card.cnpj || (isCajuRecharge ? "CNPJ 2" : null)));

    const { error } = await supabase
      .from("payment_requests")
      .update({
        status: newStatus,
        cnpj: effectiveCnpj,
        payment_proof_url: paymentProofUrl,
        invoice_url: invoiceUrl,
        stage_history: nextStageHistory,
      })
      .eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao avançar solicitação."); return; }

    // Dispara a sincronização de saldo Nubank e Caju
    await syncNubankBalance(card.id, userId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("caju-balance-updated"));
      window.dispatchEvent(new Event("nubank-balance-updated"));
    }

    onUpdate(`Solicitação avançou para ${getStatusLabel(newStatus)}`);
  }

  async function handleRefuse() {
    if (!refusalReason.trim()) { setErrorMsg("O motivo é obrigatório."); return; }
    setLoading(true);
    const prefix = userRole === "GESTOR" ? "Cancelado pelo Gestor" : "Recusado pelo Financeiro";

    const nextStageHistory = computeNextStageHistory(
      card.stage_history,
      card.status,
      "RECUSADO",
      userId,
      card.created_at
    );

    const { error } = await supabase
      .from("payment_requests")
      .update({
        status: "RECUSADO",
        refusal_reason: `${prefix}: ${refusalReason.trim()}`,
        payment_proof_url: paymentProofUrl,
        invoice_url: invoiceUrl,
        stage_history: nextStageHistory,
      })
      .eq("id", card.id);
    if (error) { setLoading(false); alert("Erro ao recusar solicitação."); return; }
    await syncNubankBalance(card.id, userId);
    setLoading(false);
    onUpdate("Solicitação enviada para Recusados.");
  }

  async function handleTrash() {
    if (!window.confirm("Deseja realmente mover este card para a Lixeira?")) return;
    setLoading(true);
    const { error } = await supabase.from("payment_requests").update({ is_deleted: true }).eq("id", card.id);
    if (error) { setLoading(false); alert("Erro ao excluir solicitação."); return; }
    await syncNubankBalance(card.id, userId);
    setLoading(false);
    onUpdate("Solicitação movida para a Lixeira.");
  }

  async function handleDeleteProof(urlToDelete: string) {
    if (!window.confirm("Deseja realmente remover este comprovante de pagamento?")) return;
    try {
      setLoading(true);
      const remainingUrls = (paymentProofUrl || "")
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u && u !== urlToDelete);

      const newProofUrl = remainingUrls.length > 0 ? remainingUrls.join(",") : null;
      const updatedHistory = receiptsHistory.filter((r) => r.url !== urlToDelete);

      const { error } = await supabase
        .from("payment_requests")
        .update({
          payment_proof_url: newProofUrl,
          receipts_history: updatedHistory,
        })
        .eq("id", card.id);

      if (error) throw error;

      setPaymentProofUrl(newProofUrl);
      setReceiptsHistory(updatedHistory);
      onUpdate("Comprovante removido com sucesso.");
    } catch (e: any) {
      alert("Erro ao remover comprovante: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteInvoice(urlToDelete: string) {
    if (!window.confirm("Deseja realmente remover esta nota fiscal/notinha?")) return;
    try {
      setLoading(true);
      const remainingUrls = (invoiceUrl || "")
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u && u !== urlToDelete);

      const newInvoiceUrl = remainingUrls.length > 0 ? remainingUrls.join(",") : null;

      const { error } = await supabase
        .from("payment_requests")
        .update({
          invoice_url: newInvoiceUrl,
        })
        .eq("id", card.id);

      if (error) throw error;

      setInvoiceUrl(newInvoiceUrl);
      onUpdate("Nota fiscal removida com sucesso.");
    } catch (e: any) {
      alert("Erro ao remover nota fiscal: " + (e.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCajuToPix() {
    if (!cajuPixKey.trim()) {
      setCajuPixError("A Chave Pix do colaborador recebedor é obrigatória.");
      return;
    }
    if (!cajuPixOwner.trim()) {
      setCajuPixError("O Nome do Titular / Favorecido é obrigatório.");
      return;
    }
    if (cajuTargetStatus === "FINALIZADO" && !cajuPixFile && !paymentProofUrl) {
      setCajuPixError("O comprovante do Pix anexado é obrigatório para manter a solicitação como Finalizada.");
      return;
    }

    try {
      setIsConvertingCajuPix(true);
      setCajuPixError("");

      let receiptUrl = paymentProofUrl || "";
      if (cajuPixFile) {
        const fileExt = cajuPixFile.name.split(".").pop() || "png";
        const fileName = `cajupix_${card.id}_${Date.now()}.${fileExt}`;
        const filePath = `receipts/${fileName}`;
        const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, cajuPixFile);
        if (uploadError) {
          throw new Error("Falha ao fazer upload do comprovante do Pix: " + uploadError.message);
        }
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
        receiptUrl = urlData.publicUrl;
      }

      const parsedAmount = parseBRLInput(cajuAmount);

      const res = await fetch("/api/payments/convert-caju-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: card.id,
          collaboratorPixKey: cajuPixKey.trim(),
          pixOwner: cajuPixOwner.trim(),
          amount: !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : Number(card.amount),
          targetStatus: cajuTargetStatus,
          reason: cajuReason.trim() || "Local não aceita Caju / Falha no cartão",
          cajuBalanceWithdrawn: Boolean(cajuBalanceWithdrawn),
          newReceiptUrl: receiptUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar conversão de Caju para Pix.");
      }

      // Atualizar estado local do card
      if (data.card) {
        card.payment_conversion_log = data.card.payment_conversion_log;
        card.payment_method = data.card.payment_method;
        card.payment_type = data.card.payment_type;
        card.pix_key = data.card.pix_key;
        card.pix_owner = data.card.pix_owner;
        card.pix_name = data.card.pix_name;
        card.amount = data.card.amount;
        card.status = data.card.status;
        card.receipts_history = data.card.receipts_history;
        if (data.card.rejection_reason) {
          card.rejection_reason = data.card.rejection_reason;
        }
        setReceiptsHistory(data.card.receipts_history || []);
      }
      if (receiptUrl) setPaymentProofUrl(receiptUrl);

      setShowCajuToPixModal(false);
      setCajuPixFile(null);
      onUpdate(`Conversão para Pix realizada com sucesso! (Status: ${getStatusLabel(data.card?.status || cajuTargetStatus)})`);
    } catch (err: any) {
      console.error("Erro na conversão Caju->Pix:", err);
      setCajuPixError(err.message || "Erro desconhecido ao converter.");
    } finally {
      setIsConvertingCajuPix(false);
    }
  }

  async function handleReopenStatus(target: "AGUARDANDO_PAGAMENTO" | "CORRECAO_PENDENTE" | "EM_APROVACAO", reasonText?: string) {
    if (!isMasterOrFinanceiro) return;
    try {
      setIsReopening(true);

      const nextStageHistory = computeNextStageHistory(
        card.stage_history,
        card.status,
        target,
        userId,
        card.created_at
      );

      const updateData: Record<string, any> = {
        status: target,
        stage_history: nextStageHistory,
        updated_at: new Date().toISOString(),
      };

      if (target === "CORRECAO_PENDENTE") {
        updateData.rejection_reason = reasonText && reasonText.trim()
          ? reasonText.trim()
          : "Exigida correção pelo Financeiro";
      }

      const { error } = await supabase
        .from("payment_requests")
        .update(updateData)
        .eq("id", card.id);

      if (error) throw error;

      await syncNubankBalance(card.id, userId);

      card.status = target;
      if (target === "CORRECAO_PENDENTE") {
        card.rejection_reason = updateData.rejection_reason;
      }
      card.stage_history = nextStageHistory;

      setIsReopenModalOpen(false);
      setReopenReason("");
      onUpdate(`Solicitação reaberta com sucesso para "${getStatusLabel(target)}"!`);
    } catch (err: any) {
      alert("Erro ao reabrir solicitação: " + (err.message || "Erro desconhecido"));
    } finally {
      setIsReopening(false);
    }
  }

  function getEmailContent(type: "PAID_NUBANK" | "REQUEST" = emailModalType) {
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? "Bom dia" : "Boa tarde";
    const formattedAmount = Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    // Obter dados do Pix (dos splits ou direto do card)
    const pixSplit = card.splits?.find((s: any) => s.payment_type?.toUpperCase() === "PIX");
    const pixKey = pixSplit?.pix_key || card.pix_key || "Não informado";
    const pixOwner = pixSplit?.pix_owner || card.pix_owner || card.pix_name || "Não informado";

    const solicitante = requesterName !== "Desconhecido" ? requesterName : "Solicitante";
    const gestorName = requesterName !== "Desconhecido" ? requesterName : "Solicitante";

    // O motivo no e-mail deve ser o que está em observações/descrição da solicitação
    const motivo = (card.notes || card.description)?.trim() || card.title;

    // Obter links de notas/notinhas anexadas pelo solicitante
    const activeInvoices = (invoiceUrl || card.invoice_url || (card as any).receipt_url || "")
      .split(",")
      .map((u: string) => u.trim())
      .filter(Boolean);

    const invoicesText = activeInvoices.length === 1
      ? `Nota Fiscal / Notinha: ${activeInvoices[0]}`
      : activeInvoices.length > 1
      ? activeInvoices.map((u: string, i: number) => `Nota ${i + 1}: ${u}`).join("\n")
      : "";

    if (type === "PAID_NUBANK") {
      const rawSubject = `Pagamento Realizado | ${card.title} | ${localCnpj || "Nubank 02"}`;

      let rawBody = `--\n${greeting} Tássio!\n\nMotivo: ${motivo}\nValor: R$ ${formattedAmount}\nTitular: ${pixOwner}\nSolicitante: ${solicitante}`;

      const proofs = paymentProofUrl
        ? paymentProofUrl
            .split(",")
            .filter(Boolean)
            .map((u, i) => `Comprovante ${i + 1}: ${u.trim()}`)
            .join("\n")
        : "";

      if (proofs) {
        rawBody += `\n\n${proofs}`;
      }

      if (invoicesText) {
        rawBody += `\n\n${invoicesText}`;
      }

      return {
        to: "tassiolimacs@gmail.com",
        subject: rawSubject,
        body: rawBody,
        encodedSubject: encodeURIComponent(rawSubject),
        encodedBody: encodeURIComponent(rawBody),
      };
    }

    // Tipo REQUEST (Solicitar pagamento a Tassio)
    const isRecargaCaju = card.request_kind === "RECARGA_CAJU" || card.title?.includes("Recarga Caju");
    const isRecargaNubank = card.request_kind === "RECARGA_NUBANK" || card.title === "Recarga Nubank";
    const cnpjDisplay = localCnpj || card.cnpj || (isRecargaCaju ? "CNPJ 2" : (isCajuOnly ? "Caju" : "(Selecione o CNPJ)"));
    const rawSubject = isRecargaCaju
      ? `Pagamento Ref. Recarga Caju | ${cnpjDisplay}`
      : `Pagamento Ref. ${card.title} | ${cnpjDisplay}`;

    const boletoSplit = card.splits?.find((s: any) => s.payment_type?.toUpperCase() === "BOLETO");
    const barcodeVal = boletoSplit?.boleto_barcode || (card as any).boleto_barcode || (card as any).barcode || "";
    const pixVal = (pixKey && pixKey !== "Não informado" ? pixKey : "") || (card as any).pix_key || "";
    const paymentKey = isRecargaNubank
      ? ""
      : (barcodeVal || pixVal);
    const paymentOwner = isRecargaCaju
      ? (card.pix_owner || "Caju")
      : (pixOwner !== "Não informado" ? pixOwner : (boletoSplit?.pix_owner || "Não informado"));
    const paymentKeyDisplay = paymentKey ? ` ${paymentKey}` : "";
    const displayMotivo = isRecargaCaju ? (card.notes || "Recarga Caju") : motivo;

    let rawBody = `--\n${greeting}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: ${displayMotivo}\nValor: R$ ${formattedAmount}\nChave pix / Linha digitável:${paymentKeyDisplay}\nTitular: ${paymentOwner}\nSolicitante: ${gestorName}`;

    if (invoicesText) {
      rawBody += `\n\n${invoicesText}`;
    }

    return {
      to: "tassiolimacs@gmail.com",
      subject: rawSubject,
      body: rawBody,
      encodedSubject: encodeURIComponent(rawSubject),
      encodedBody: encodeURIComponent(rawBody),
    };
  }

  function handleOpenGmail() {
    if (emailModalType === "REQUEST" && requiresCnpj && !localCnpj && !isRecharge) {
      alert("Por favor, selecione o CNPJ / Conta Pagadora antes de solicitar o pagamento.");
      return;
    }
    const { to, encodedSubject, encodedBody } = getEmailContent(emailModalType);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodedSubject}&body=${encodedBody}`;
    window.open(gmailUrl, "_blank");
  }

  function handleOpenDefaultMail() {
    if (emailModalType === "REQUEST" && requiresCnpj && !localCnpj && !isRecharge) {
      alert("Por favor, selecione o CNPJ / Conta Pagadora antes de solicitar o pagamento.");
      return;
    }
    const { to, encodedSubject, encodedBody } = getEmailContent(emailModalType);
    const mailtoUrl = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
    const a = document.createElement("a");
    a.href = mailtoUrl;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleCopyEmailText() {
    if (emailModalType === "REQUEST" && requiresCnpj && !localCnpj) {
      alert("Por favor, selecione o CNPJ / Conta Pagadora antes de solicitar o pagamento.");
      return;
    }
    const { body } = getEmailContent(emailModalType);
    navigator.clipboard.writeText(body);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2500);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maximo 5MB."); return; }
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${card.id}_${Date.now()}.${fileExt}`;
    const filePath = `receipts/${fileName}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
    if (uploadError) { alert("Falha ao enviar arquivo."); setIsUploading(false); return; }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
    const newUrl = urlData.publicUrl;

    const newReceipt: ReceiptHistoryItem = { url: newUrl, uploadedAt: new Date().toISOString(), uploadedBy: userId || "unknown" };
    const updatedHistory = [...receiptsHistory, newReceipt];
    const combinedProof = paymentProofUrl ? `${paymentProofUrl},${newUrl}` : newUrl;
    setPaymentProofUrl(combinedProof);

    await supabase.from("payment_requests").update({ payment_proof_url: combinedProof, receipts_history: updatedHistory }).eq("id", card.id);
    setIsUploading(false);
  };

  const handleCorrectionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maximo 5MB."); return; }
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `correction_${card.id}_${Date.now()}.${fileExt}`;
    const filePath = `receipts/${fileName}`;
    const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
    if (uploadError) { alert("Falha ao enviar arquivo."); setIsUploading(false); return; }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
    const newUrl = urlData.publicUrl;

    const newReceipt: ReceiptHistoryItem = { url: newUrl, uploadedAt: new Date().toISOString(), uploadedBy: userId || "unknown" };
    const updatedHistory = [...receiptsHistory, newReceipt];
    const combinedProof = paymentProofUrl ? `${paymentProofUrl},${newUrl}` : newUrl;

    const nextStageHistory = computeNextStageHistory(
      card.stage_history,
      card.status,
      "VALIDACAO_GESTOR",
      userId,
      card.created_at
    );

    const { error } = await supabase.from("payment_requests").update({
      payment_proof_url: combinedProof,
      receipts_history: updatedHistory,
      stage_history: nextStageHistory,
      rejection_reason: null,
      status: "VALIDACAO_GESTOR",
    }).eq("id", card.id);
    setIsUploading(false);
    if (error) { alert("Erro ao enviar correcao."); return; }
    await syncNubankBalance(card.id, userId);
    onUpdate("Comprovante corrigido. Aguardando nova validacao do Gestor.");
  };

  const processInvoiceFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingInvoice(true);
    const uploadedUrls: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`O arquivo "${file.name}" excede o tamanho máximo de 5MB.`);
        continue;
      }
      const fileExt = file.name.split('.').pop() || "png";
      const fileName = `invoice_${card.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      } else {
        console.error("Erro no upload de notinha:", uploadError);
      }
    }
    if (uploadedUrls.length > 0) {
      const newCombinedUrl = invoiceUrl ? `${invoiceUrl},${uploadedUrls.join(',')}` : uploadedUrls.join(',');
      setInvoiceUrl(newCombinedUrl);
      await supabase.from("payment_requests").update({ invoice_url: newCombinedUrl }).eq("id", card.id);
      onUpdate("Notinha(s) anexada(s) com sucesso!");

      try {
        const count = uploadedUrls.length;
        const totalCount = newCombinedUrl.split(",").map((u) => u.trim()).filter(Boolean).length;
        await sendPushNotification({
          title: "📄 Nova Notinha Anexada!",
          body: `${count === 1 ? "Uma notinha foi anexada" : `${count} notinhas foram anexadas`} na solicitação "${card.title}" em Aguardando Nota (Total: ${totalCount} ${totalCount === 1 ? "nota" : "notas"}).`,
          url: "/kanban",
          targetRoles: ["MASTER", "FINANCEIRO"],
          excludeUserId: userId || undefined,
        });
      } catch (pushErr) {
        console.warn("[CardDetailModal] Erro ao disparar push de notinha:", pushErr);
      }
    }
    setIsUploadingInvoice(false);
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processInvoiceFiles(Array.from(e.target.files));
  };

  const handleCajuPixPaste = (e: React.ClipboardEvent | ClipboardEvent) => {
    const items = (e as any).clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items) as any[]) {
      if (item.type && item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            setCajuPixError("Tamanho máximo de 5MB.");
            return;
          }
          const renamed = new File([file], `comprovante_pix_${Date.now()}.png`, { type: file.type || "image/png" });
          setCajuPixFile(renamed);
          setCajuPixError("");
        }
        break;
      }
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    // 1. Se o modal de Caju para Pix estiver aberto, prioriza o comprovante Pix
    if (showCajuToPixModal) {
      handleCajuPixPaste(e);
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type && item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
          
          // Se o status for AGUARDANDO_PAGAMENTO (Aguardando Nota), o paste DEVE anexar a NOTINHA!
          if (
            card.status === "AGUARDANDO_PAGAMENTO" || 
            (card.status as string) === "AGUARDANDO_NOTINHA"
          ) {
            await processInvoiceFiles([file]);
            return;
          }

          if (isCorrecaoPendente && isMasterOrFinanceiro) {
            handleCorrectionUpload(fakeEvent);
            return;
          }

          if (isMasterOrFinanceiro) {
            // Se já possui comprovante mas falta notinha, anexa como notinha
            if (paymentProofUrl && !invoiceUrl) {
              await processInvoiceFiles([file]);
            } else {
              handleFileUpload(fakeEvent);
            }
          } else {
            await processInvoiceFiles([file]);
          }
        }
        break;
      }
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert("Pressione as teclas Ctrl + V para colar a imagem diretamente nesta janela.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `notinha_colada_${Date.now()}.${imageType.split("/")[1] || "png"}`, { type: imageType });
          await processInvoiceFiles([file]);
          return;
        }
      }
      alert("Nenhuma imagem encontrada na área de transferência. Tire um print ou copie uma imagem antes.");
    } catch {
      alert("Para colar a notinha, basta clicar nesta tela e pressionar Ctrl + V.");
    }
  };

  const handlePasteCajuPixFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        alert("Pressione Ctrl + V para colar a imagem do comprovante diretamente.");
        return;
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `comprovante_pix_colado_${Date.now()}.${imageType.split("/")[1] || "png"}`, { type: imageType });
          if (file.size > 5 * 1024 * 1024) {
            setCajuPixError("Tamanho máximo de 5MB.");
            return;
          }
          setCajuPixFile(file);
          setCajuPixError("");
          return;
        }
      }
      alert("Nenhuma imagem encontrada na área de transferência. Tire um print ou copie a imagem antes.");
    } catch {
      alert("Pressione Ctrl + V com este modal aberto para colar o print do comprovante.");
    }
  };

  const handleCnpjChange = async (newCnpj: string) => {
    setLocalCnpj(newCnpj);
    await supabase.from("payment_requests").update({ cnpj: newCnpj }).eq("id", card.id);
    await syncNubankBalance(card.id, userId);
    onUpdate();
  };

  const handleValidateAction = async (action: "APPROVE" | "REJECT" | "FORCE_APPROVE") => {
    if (action === "REJECT" && !rejectReason.trim()) {
      setErrorMsg("O motivo da rejeicao e obrigatorio.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: card.id, action, reason: action === "REJECT" ? rejectReason.trim() : undefined }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Erro na validacao."); setLoading(false); return; }
      await syncNubankBalance(card.id, userId);
      setLoading(false);
      onUpdate(data.message || "Solicitacao atualizada.");
    } catch {
      setLoading(false);
      alert("Erro de rede ao validar.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:transition-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl flex flex-col max-h-[92vh] shadow-2xl relative overflow-hidden animate-in zoom-in-95 fade-in duration-200 ease-out motion-reduce:transition-none"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--surface-border)" }}
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b"
             style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-hover)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Detalhes da Solicitação</h2>
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-md bg-brand-primary text-white">
              #{card.id.substring(0, 6)}
            </span>
            {card.payment_conversion_log && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-xs">
                <RefreshCw size={11} className="text-purple-400" />
                Convertido p/ Pix
              </span>
            )}
            {card.request_kind === "RECARGA_NUBANK" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#820AD1]/25 text-[#d8b4fe] border border-[#820AD1]/40 shadow-xs">
                <Zap size={11} className="text-[#c084fc]" />
                Recarga Nubank
              </span>
            )}
            {card.request_kind === "RECARGA_CAJU" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#e11d48]/25 text-[#fda4af] border border-[#e11d48]/40 shadow-xs">
                <Zap size={11} className="text-[#fb7185]" />
                Recarga Caju
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY: grid de 1 coluna permite subir o painel de validação (order) sem mover lógica */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 content-start">

          {/* BANNER DE ALTERAÇÃO PENDENTE DE AUTORIZAÇÃO DO MASTER */}
          {card.pending_edit && (
            <div className="mb-5 p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-2" style={{ order: -3 }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-amber-500/25">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                    <FileEdit size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider">
                        Alteração Solicitada pelo Financeiro
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/25 text-amber-200 border border-amber-500/40 animate-pulse">
                        Aguardando Autorização do Master
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Solicitado por <strong className="text-white">{card.pending_edit.requested_by_name}</strong> em{" "}
                      {new Date(card.pending_edit.requested_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                {/* Botões de Ação para o Master */}
                {isMaster ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowRejectEditModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 hover:border-red-500/50 transition-all cursor-pointer"
                    >
                      <X size={13} />
                      <span>Recusar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMasterAuthModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                    >
                      <ShieldCheck size={14} />
                      <span>Autorizar Alteração</span>
                    </button>
                  </div>
                ) : (
                  userId === card.pending_edit.requested_by_id && (
                    <button
                      type="button"
                      onClick={handleCancelPendingEdit}
                      className="text-xs font-medium text-slate-400 hover:text-red-400 underline transition-colors cursor-pointer"
                    >
                      Cancelar meu pedido
                    </button>
                  )
                )}
              </div>

              {/* Justificativa informada */}
              <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-amber-500/20 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block mb-1">
                  Justificativa / Motivo Especificado:
                </span>
                <p className="text-slate-200 font-medium italic">
                  "{card.pending_edit.reason}"
                </p>
              </div>

              {/* Comparativo Detalhado de Alterações */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Especificação das Alterações Propostas:
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Título */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Título</span>
                    <div className="text-slate-400 line-through text-[11px] truncate" title={card.pending_edit.original_data.title}>
                      {card.pending_edit.original_data.title}
                    </div>
                    <div className="text-white font-bold text-xs truncate" title={card.pending_edit.new_data.title}>
                      ➔ {card.pending_edit.new_data.title}
                    </div>
                  </div>

                  {/* Valor */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor</span>
                    <div className="text-slate-400 line-through text-[11px]">
                      R$ {Number(card.pending_edit.original_data.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-emerald-400 font-black text-sm">
                      ➔ R$ {Number(card.pending_edit.new_data.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Formas de Pagamento */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Formas de Pagamento</span>
                    <div className="text-slate-400 line-through text-[11px] truncate">
                      {card.pending_edit.original_data.payment_type || "Não especificado"}
                    </div>
                    <div className="text-blue-400 font-bold text-xs">
                      ➔ {card.pending_edit.new_data.splits?.map((s: any) => s.payment_type).join(", ") || card.pending_edit.new_data.payment_type}
                    </div>
                  </div>
                </div>

                {/* Detalhes dos splits se houver */}
                {card.pending_edit.new_data.splits && card.pending_edit.new_data.splits.length > 0 && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs space-y-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Detalhes dos novos pagamentos ({card.pending_edit.new_data.splits.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {card.pending_edit.new_data.splits.map((s: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">
                          <div className="flex justify-between font-bold">
                            <span className="text-blue-400">{s.payment_type}</span>
                            <span className="text-emerald-400">R$ {Number(s.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                          </div>
                          {s.pix_key && (
                            <div className="text-slate-300 truncate">
                              <span className="text-slate-500">Chave:</span> {s.pix_key}
                            </div>
                          )}
                          {s.pix_owner && (
                            <div className="text-slate-300 truncate">
                              <span className="text-slate-500">Titular:</span> {s.pix_owner}
                            </div>
                          )}
                          {s.caju_phone && (
                            <div className="text-slate-300 truncate">
                              <span className="text-slate-500">Caju:</span> {s.caju_phone}
                            </div>
                          )}
                          {s.boleto_barcode && (
                            <div className="text-slate-300 truncate font-mono text-[10px]">
                              <span className="text-slate-500 font-sans">Boleto:</span> {s.boleto_barcode}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ALERT: CORRECAO PENDENTE */}
          {isCorrecaoPendente && card.rejection_reason && (
            <div className="mb-5 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/40" style={{ order: -2 }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Correção Exigida pelo Gestor</p>
                  <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed font-medium">{card.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* AVISO DE CONVERSÃO CAJU -> PIX */}
          {card.payment_conversion_log && (
            <div className="mb-4 p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                <RefreshCw size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Conversão Pós-Fechamento Realizada
                  </span>
                  <span className="text-[10px] text-purple-400/80">
                    {new Date(card.payment_conversion_log.convertedAt).toLocaleString("pt-BR")}
                    {card.payment_conversion_log.convertedBy ? ` por ${card.payment_conversion_log.convertedBy}` : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-200">
                  Modalidade alterada para <strong>Pix</strong> (Chave: {card.payment_conversion_log.collaboratorPixKey}).
                </p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  <strong>Motivo:</strong> {card.payment_conversion_log.reason}
                </p>
                {card.payment_conversion_log.cajuBalanceWithdrawn && (
                  <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 mt-2 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 w-fit">
                    <CheckCircle2 size={13} className="shrink-0" />
                    Saldo antigo foi retirado do cartão Caju
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl font-black leading-tight mb-1" style={{ color: "var(--text-primary)" }}>{card.title}</h3>
                  {isMasterOrFinanceiro && (
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-xs"
                      title="Editar título, valor, pagamento..."
                    >
                      <FileEdit size={13} />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
                {isMasterOrFinanceiro ? (
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(true)}
                    className="group/val text-left inline-flex items-center gap-2 cursor-pointer transition-all -ml-1 px-2 py-0.5 rounded-xl hover:bg-amber-500/10 border border-transparent hover:border-amber-500/30"
                    title="Clique para editar o valor e a solicitação (Master/Financeiro)"
                  >
                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 group-hover/val:text-amber-400 tracking-tight transition-colors">
                      R$ {Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                    <Pencil size={18} className="text-amber-400 opacity-50 group-hover/val:opacity-100 transition-opacity" />
                  </button>
                ) : (
                  <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    R$ {Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
                        style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                        title="Solicitante Real">
                    <User size={12} style={{ color: "var(--text-secondary)" }} />
                    {requesterName}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
                        style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                        title="Data do Pedido">
                    <Calendar size={12} style={{ color: "var(--text-secondary)" }} />
                    {new Date(card.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                {/* CATEGORIA */}
                <div
                  className="flex flex-col gap-2 p-3.5 rounded-xl border shadow-xs"
                  style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Tag size={15} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Categoria
                      </span>
                      {isSavingCategory && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                          <Loader2 size={10} className="animate-spin" /> Salvando...
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAiRecategorize}
                      disabled={isReclassifyingCategory || isSavingCategory}
                      className="text-[11px] font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all cursor-pointer disabled:opacity-40 shadow-xs"
                      title="Analisar título e observações com IA Gemini para sugerir categoria"
                    >
                      {isReclassifyingCategory ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      <span>{isReclassifyingCategory ? "Analisando..." : "Sugerir com IA"}</span>
                    </button>
                  </div>

                  {isCustomCategoryModal ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <input
                        type="text"
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        placeholder="Digite o nome da categoria..."
                        className="flex-1 border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand-primary font-medium"
                        style={{
                          backgroundColor: "var(--surface-hover)",
                          borderColor: "var(--surface-border)",
                          color: "var(--text-primary)",
                        }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCustomCategory();
                          if (e.key === "Escape") setIsCustomCategoryModal(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomCategory}
                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-brand-primary text-white hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCustomCategoryModal(false)}
                        className="p-1.5 text-xs rounded-lg hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
                        title="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <select
                      value={localCategory}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      disabled={isSavingCategory || isReclassifyingCategory}
                      className="w-full border rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-primary font-medium cursor-pointer transition-colors"
                      style={{
                        backgroundColor: "var(--surface-hover)",
                        borderColor: "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {localCategory && !categories.some((c) => c.name.toLowerCase() === localCategory.toLowerCase()) && (
                        <option
                          value={localCategory}
                          style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
                        >
                          {localCategory} (Atual)
                        </option>
                      )}
                      {categories.map((cat) => (
                        <option
                          key={cat.id}
                          value={cat.name}
                          style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
                        >
                          {cat.name}
                        </option>
                      ))}
                      <option
                        value="__CUSTOM__"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "#a855f7", fontWeight: "bold" }}
                      >
                        + Digitar outra categoria...
                      </option>
                    </select>
                  )}
                </div>

                {/* CONTA PAGADORA / CNPJ */}
                {isMasterOrFinanceiro && (
                  <div
                    className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-all ${
                      requiresCnpj && !localCnpj && isNovaSolicitacao
                        ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
                        : "shadow-xs"
                    }`}
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderColor: requiresCnpj && !localCnpj && isNovaSolicitacao ? undefined : "var(--surface-border)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2
                          size={15}
                          className={`shrink-0 ${requiresCnpj && !localCnpj && isNovaSolicitacao ? "text-amber-400" : ""}`}
                          style={{ color: requiresCnpj && !localCnpj && isNovaSolicitacao ? undefined : "var(--text-muted)" }}
                        />
                        <span
                          className="text-[10px] uppercase font-bold tracking-wider"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Conta Pagadora / CNPJ
                        </span>
                      </div>
                      {isCajuOnly ? (
                        <span className="text-[10px] text-blue-400 font-semibold bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                          Opcional no Caju
                        </span>
                      ) : requiresCnpj ? (
                        localCnpj ? (
                          <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 whitespace-nowrap flex items-center gap-1">
                            <CheckCircle2 size={11} /> Selecionado
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/35 whitespace-nowrap flex items-center gap-1 shadow-xs">
                            <AlertTriangle size={11} className="shrink-0" /> Obrigatório para Pendente
                          </span>
                        )
                      ) : null}
                    </div>

                    <select 
                      value={localCnpj} 
                      onChange={(e) => handleCnpjChange(e.target.value)} 
                      className={`w-full border rounded-lg px-3 py-2 text-xs outline-none focus:border-brand-primary font-medium cursor-pointer transition-colors ${
                        requiresCnpj && !localCnpj && isNovaSolicitacao ? "border-amber-500/60 focus:ring-1 focus:ring-amber-500/30" : ""
                      }`}
                      style={{
                        backgroundColor: "var(--surface-hover)",
                        borderColor: requiresCnpj && !localCnpj && isNovaSolicitacao ? undefined : "var(--surface-border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
                        {isCajuOnly
                          ? "Não necessário para Caju (ou selecione se desejar)"
                          : "Selecione o Pagador (Nubank 02 / CNPJ)..."}
                      </option>
                      {CNPJ_OPTIONS.map((opt) => (
                        <option key={opt} value={opt} style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>{opt}</option>
                      ))}
                      {localCnpj && !CNPJ_OPTIONS.includes(localCnpj) && (
                        <option value={localCnpj} style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>{localCnpj}</option>
                      )}
                    </select>

                    {requiresCnpj && !localCnpj && isNovaSolicitacao && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-amber-400 font-medium">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>Selecione o CNPJ (ou Nubank 02) para liberar o avanço para Pendente.</span>
                      </div>
                    )}
                    {isFopag && (
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-purple-400 font-medium">
                        <Info size={12} className="shrink-0" />
                        <span>FOPAG: CNPJ 2 definido por padrão (você pode alterar se necessário).</span>
                      </div>
                    )}
                  </div>
                )}

                {/* OBSERVAÇÕES / DESCRIÇÃO */}
                {(card.notes || card.description) && (
                  <div
                    className="flex flex-col gap-2 p-3.5 rounded-xl border shadow-xs transition-all"
                    style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlignLeft size={14} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>
                          Observações / Descrição
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(card.notes || card.description || "");
                            setDescriptionCopied(true);
                            setTimeout(() => setDescriptionCopied(false), 2000);
                          }}
                          className="p-1 rounded hover:bg-[var(--surface-hover)] transition-colors cursor-pointer text-slate-400 hover:text-white"
                          title="Copiar texto da descrição"
                        >
                          {descriptionCopied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDescriptionModalOpen(true)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 transition-all cursor-pointer"
                          title="Abrir descrição completa em janela expandida"
                        >
                          <Maximize2 size={11} className="text-slate-400" />
                          <span>Ver Completa</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border max-h-48 overflow-y-auto custom-scrollbar" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                      <p className="font-medium text-xs whitespace-pre-wrap leading-relaxed select-text" style={{ color: "var(--text-primary)" }}>
                        {card.notes || card.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-4">
              {/* Payment Data */}
              <div className="p-4 rounded-xl border shadow-xs"
                   style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={17} className="text-blue-500" />
                  <h4 className="font-bold text-sm uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Dados de Pagamento</h4>
                </div>
                <div className="space-y-4">
                  {(card.splits && card.splits.length > 0 ? card.splits : [{
                    id: "legacy", payment_type: card.payment_type || card.payment_method,
                    amount: card.amount, pix_owner: card.pix_owner || card.pix_name,
                    pix_key: card.pix_key, caju_phone: card.caju_phone
                  }]).map((split: any, idx: number) => {
                    const isSplitPix = split.payment_type?.toUpperCase() === "PIX";
                    const isSplitCaju = split.payment_type?.toUpperCase() === "CAJU";
                    const isSplitBoleto = split.payment_type?.toUpperCase() === "BOLETO";
                    const isSplitFopag = split.payment_type?.toUpperCase() === "FOPAG";
                    const isSplitRetirada = split.payment_type?.toUpperCase() === "RETIRADA_DE_SALDO";
                    const labelBadge = isSplitPix ? "Pix" : isSplitCaju ? "Caju" : isSplitBoleto ? "Boleto" : isSplitFopag ? "FOPAG" : isSplitRetirada ? "Retirada de Saldo" : (split.payment_type || "Outro");

                    return (
                    <div key={split.id || idx} className="p-3.5 rounded-xl border relative" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">{labelBadge}</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">R$ {Number(split.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      {isSplitPix && (
                        <div className="space-y-2 mt-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Chave Pix</span>
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border group" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{split.pix_key}</span>
                              <button onClick={async () => { if (split.pix_key) { await navigator.clipboard.writeText(split.pix_key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); } }} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 cursor-pointer bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 border border-blue-500/30 transition-colors" title="Copiar Chave Pix">
                                {copiedKey ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                {copiedKey ? "Copiado!" : "Copiar"}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Titular</span>
                            <span className="text-xs font-bold block truncate" style={{ color: "var(--text-primary)" }}>{split.pix_owner}</span>
                          </div>
                        </div>
                      )}
                      {isSplitCaju && (
                        <div className="mt-2">
                          <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Titular</span>
                          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                            <span className="text-xs font-bold block truncate" style={{ color: "var(--text-primary)" }}>{split.caju_phone}</span>
                            {split.caju_phone && (
                              <button onClick={async () => { await navigator.clipboard.writeText(String(split.caju_phone)); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 cursor-pointer bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 border border-blue-500/30 transition-colors" title="Copiar dados Caju">
                                {copiedKey ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                {copiedKey ? "Copiado!" : "Copiar"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {isSplitFopag && split.pix_owner && (
                        <div className="mt-2">
                          <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Colaborador / Funcionário</span>
                          <span className="text-xs font-bold block truncate" style={{ color: "var(--text-primary)" }}>{split.pix_owner}</span>
                        </div>
                      )}
                      {isSplitBoleto && (
                        <div className="space-y-2 mt-2">
                          {(split.pix_owner || card.pix_name || card.pix_owner) && (
                            <div>
                              <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Beneficiário / Titular</span>
                              <span className="text-xs font-bold block truncate" style={{ color: "var(--text-primary)" }}>{split.pix_owner || card.pix_name || card.pix_owner}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Linha Digitável</span>
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border group" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{split.boleto_barcode || "-"}</span>
                              <button onClick={async () => { if (split.boleto_barcode) { await navigator.clipboard.writeText(split.boleto_barcode); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); } }} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 cursor-pointer bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 border border-blue-500/30 transition-colors" title="Copiar Linha Digitável">
                                {copiedKey ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                {copiedKey ? "Copiado!" : "Copiar"}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Data de Vencimento</span>
                            <span className="text-xs font-bold block truncate" style={{ color: "var(--text-primary)" }}>{split.boleto_due_date ? new Date(split.boleto_due_date + "T12:00:00Z").toLocaleDateString("pt-BR") : "-"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );})}
                </div>
              </div>

              {/* Comprovante de Pagamento (Visível para Gestor, Solicitante e Financeiro) */}
              {effectiveProofUrls.length > 0 ? (
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col gap-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Comprovante de Pagamento</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {card.payment_conversion_log ? "Comprovante Pix Ativo" : "Enviado pelo Financeiro"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Pago
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1">
                    {effectiveProofUrls.map((url, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-xs font-bold shadow-xs hover:bg-emerald-500/20 transition-all"
                      >
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:underline text-emerald-200"
                        >
                          <FileText size={14} className="text-emerald-400" />
                          <span>
                            Visualizar Comprovante {effectiveProofUrls.length > 1 ? i + 1 : ""}
                          </span>
                          <ExternalLink size={12} className="opacity-70" />
                        </a>
                        {isMasterOrFinanceiro && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProof(url);
                            }}
                            title={`Excluir Comprovante ${i + 1}`}
                            className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-all cursor-pointer ml-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {isMasterOrFinanceiro && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-emerald-400/80 hover:text-emerald-300 hover:underline mt-1 self-start cursor-pointer"
                    >
                      + Adicionar Mais Comprovantes
                    </button>
                  )}
                </div>
              ) : (
                !isNovaSolicitacao && isMasterOrFinanceiro && !isCorrecaoPendente && !isValidacaoGestor ? (
                  <div className="p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 hover:opacity-90 transition-all"
                       style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-blue-500">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs font-semibold">Enviando comprovante...</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud size={24} style={{ color: "var(--text-muted)" }} />
                        <div className="text-center">
                          <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Comprovante(s) de Pagamento</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Anexe o comprovante de pagamento</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Selecionar Comprovante
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  (!isNovaSolicitacao && (card.status === "VALIDACAO_GESTOR" || card.status === "VALIDADO_GESTOR" || card.status === "AGUARDANDO_PAGAMENTO" || card.status === "FINALIZADO")) ? (
                    <div className="p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/40 flex items-center gap-3">
                      <Clock size={16} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-300">Comprovante de Pagamento</p>
                        <p className="text-[11px] text-slate-400">Aguardando envio pelo setor Financeiro.</p>
                      </div>
                    </div>
                  ) : null
                )
              )}

              {/* Notinha ou Nota Fiscal com Suporte a Ctrl+V e Drag-and-Drop */}
              <div 
                className={`p-4 rounded-xl border ${isValidacaoGestor && !invoiceUrl ? "border-amber-500/50 bg-amber-500/10" : ""} flex flex-col gap-2 transition-all`}
                style={!(isValidacaoGestor && !invoiceUrl) ? { backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" } : undefined}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    await processInvoiceFiles(Array.from(e.dataTransfer.files));
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className={invoiceUrl ? "text-blue-500" : "text-amber-500"} />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Notinha ou Nota Fiscal</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Comprovante de compra/gasto real</p>
                    </div>
                  </div>

                  {/* Botão Rápido de Colar da Área de Transferência */}
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    disabled={isUploadingInvoice}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Colar imagem copiada da área de transferência (ou aperte Ctrl+V)"
                  >
                    <Copy size={12} />
                    <span>Colar Notinha (Ctrl+V)</span>
                  </button>
                </div>

                {isUploadingInvoice ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-blue-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-semibold">Enviando notinha...</span>
                  </div>
                ) : invoiceUrl ? (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t" style={{ borderColor: "var(--surface-border)" }}>
                    <div className="flex flex-wrap gap-2">
                      {invoiceUrl.split(',').map((u) => u.trim()).filter(Boolean).map((url, i) => (
                        <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-500/30">
                          <a href={url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                            Nota {i + 1}
                          </a>
                          {(isMasterOrFinanceiro || canActAsRequester) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteInvoice(url);
                              }}
                              title={`Remover Nota ${i + 1}`}
                              className="p-0.5 rounded text-blue-400 hover:text-red-400 hover:bg-red-500/20 transition-all cursor-pointer ml-1"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <button onClick={() => invoiceInputRef.current?.click()} className="text-[10px] text-blue-400 hover:underline cursor-pointer">+ Adicionar Mais Arquivo</button>
                      <span className="text-[10px] text-slate-500">ou pressione <strong>Ctrl+V</strong> para colar</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col sm:flex-row items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => invoiceInputRef.current?.click()} 
                      disabled={isUploadingInvoice} 
                      className="px-3 py-2 text-xs font-medium border border-dashed rounded-lg transition-colors flex-1 w-full flex items-center justify-center gap-2 hover:opacity-80 cursor-pointer"
                      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}
                    >
                      <UploadCloud size={14} />
                      <span>Selecionar Arquivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      disabled={isUploadingInvoice}
                      className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 transition-colors w-full sm:w-auto flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Pressione Ctrl+V ou clique para colar imagem da notinha"
                    >
                      <Copy size={13} />
                      <span>Colar Imagem (Ctrl+V)</span>
                    </button>
                  </div>
                )}
                <input 
                  type="file" 
                  multiple 
                  ref={invoiceInputRef} 
                  className="hidden" 
                  accept="image/*,.pdf" 
                  onClick={(e) => {
                    (e.target as HTMLInputElement).value = "";
                  }}
                  onChange={handleInvoiceUpload} 
                />
              </div>

              {/* Legacy refusal reason */}
              {card.refusal_reason && !isCorrecaoPendente && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-2 text-red-400">
                    <AlignLeft size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-bold block mb-1">Motivo da Recusa</span>
                      <p className="text-sm font-medium leading-relaxed">{card.refusal_reason}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />

          {/* CORRECAO PENDENTE: Reupload */}
          {isCorrecaoPendente && isMasterOrFinanceiro && (
            <div className="mt-6 p-6 rounded-2xl border-2 border-dashed border-red-500/40 bg-red-500/5 flex flex-col items-center justify-center">
              {isUploading ? (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="animate-spin" size={32} />
                  <span className="text-sm font-medium">Enviando comprovante corrigido...</span>
                </div>
              ) : (
                <>
                  <UploadCloud size={36} className="text-red-400" />
                  <div className="text-center mt-2">
                    <p className="text-sm font-bold text-red-300">Envie o Comprovante Corrigido</p>
                    <p className="text-[11px] text-gray-400 mt-1">O Gestor exigiu uma correção. Anexe o novo comprovante para reenviar à validação.</p>
                  </div>
                  <button onClick={() => correctionInputRef.current?.click()} className="mt-3 px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-bold rounded-xl transition-colors border border-red-500/30">
                    Selecionar Novo Comprovante
                  </button>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleCorrectionUpload} ref={correctionInputRef} />
                </>
              )}
            </div>
          )}

          {/* VALIDACAO GESTOR: Maker-Checker Panel */}
          {isValidacaoGestor && (
            <div className="mb-5 p-4 rounded-2xl border border-purple-500/30 bg-purple-500/5" style={{ order: -1 }}>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={20} className="text-purple-400" />
                <h4 className="font-bold text-white text-sm uppercase tracking-wider">Validação do Pagamento</h4>
              </div>

              {latestReceipt && (
                <div className="mb-4 p-3 rounded-lg bg-gray-800/60 border border-gray-700/50">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Último Comprovante</span>
                  <a href={latestReceipt.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-400 hover:text-blue-300 underline">Visualizar Comprovante</a>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Enviado em {new Date(latestReceipt.uploadedAt).toLocaleString("pt-BR")}
                    {profilesMap[latestReceipt.uploadedBy] && ` por ${profilesMap[latestReceipt.uploadedBy]}`}
                  </p>
                </div>
              )}

              {canActAsRequester && !showRejectForm && (
                <div className="space-y-3">
                  {!isCreator && (
                    <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 flex items-center gap-2">
                      <span>👥</span>
                      <span>
                        Você pode validar como membro do setor <strong>{requesterSectorName || "mesmo setor"}</strong> (solicitado por {requesterName}).
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => handleValidateAction("APPROVE")} 
                      disabled={loading} 
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={18} />}
                      Validar Pagamento
                    </button>
                    <button 
                      onClick={() => setShowRejectForm(true)} 
                      disabled={loading} 
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <ShieldAlert size={18} />
                      Exigir Correção
                    </button>
                  </div>
                </div>
              )}

              {canActAsRequester && showRejectForm && (
                <div className="flex flex-col gap-3 mt-2 p-4 rounded-xl bg-gray-900 border border-red-500/40">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-red-400">Motivo da Correção *</label>
                    {!isCreator && (
                      <span className="text-[10px] text-gray-400">Registrado em seu nome ({userName || "Membro do Setor"})</span>
                    )}
                  </div>
                  <textarea 
                    value={rejectReason} 
                    onChange={(e) => { setRejectReason(e.target.value); setErrorMsg(""); }} 
                    rows={3} 
                    placeholder="Descreva o que está errado no comprovante..." 
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none resize-none bg-gray-800 text-white border ${errorMsg ? "border-red-500" : "border-gray-700"}`} 
                  />
                  {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowRejectForm(false); setRejectReason(""); setErrorMsg(""); }} className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer">Cancelar</button>
                    <button onClick={() => handleValidateAction("REJECT")} disabled={loading} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer">
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      Enviar para Correção
                    </button>
                  </div>
                </div>
              )}

              {userRole === "MASTER" && (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <button onClick={() => handleValidateAction("FORCE_APPROVE")} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all disabled:opacity-50">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={16} />}
                    Forçar Aprovação (Admin)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FORCE APPROVE in CORRECAO PENDENTE (MASTER only) */}
          {isCorrecaoPendente && userRole === "MASTER" && (
            <div className="mt-4">
              <button onClick={() => handleValidateAction("FORCE_APPROVE")} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all disabled:opacity-50">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={16} />}
                Forçar Aprovação (Admin Override)
              </button>
            </div>
          )}

          {/* Painel informativo quando VALIDADO PELO GESTOR */}
          {isValidadoGestor && (
            <div className="mt-4 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3">
              <ShieldCheck size={22} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider block">Pagamento Validado pelo Gestor</span>
                {(() => {
                  const validItem = (card.stage_history as any[])?.find((h: any) => h.stage === "VALIDADO_GESTOR");
                  const valName = validItem?.validator_name || (validItem?.moved_by ? profilesMap[validItem.moved_by] : null);
                  const isCreatorVal = validItem?.is_creator !== false;
                  return (
                    <p className="text-xs text-slate-200 mt-1">
                      {valName ? (
                        <>Validado por <strong className="text-white">{valName}</strong> {isCreatorVal ? "(Solicitante)" : `(Membro do setor de ${requesterName})`}.</>
                      ) : (
                        <>Validado pelo gestor do setor.</>
                      )}
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Painel informativo quando em CORREÇÃO PENDENTE */}
          {isCorrecaoPendente && (
            <div className="mt-4 p-4 rounded-2xl border border-red-500/40 bg-red-500/10 flex items-start gap-3">
              <ShieldAlert size={22} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-xs uppercase font-bold text-red-400 tracking-wider block">Correção Exigida pelo Gestor</span>
                <p className="text-xs text-slate-200 mt-1 font-medium whitespace-pre-wrap">
                  {card.rejection_reason || "O gestor solicitou a correção do comprovante de pagamento."}
                </p>
              </div>
            </div>
          )}

          {/* ACCORDION: Histórico de Alterações (Master & Financeiro) */}
          {Array.isArray(card.edit_history) && card.edit_history.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.03] overflow-hidden">
              <button
                type="button"
                onClick={() => setEditHistoryOpen(!editHistoryOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-500/10 hover:bg-amber-500/15 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileEdit size={16} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Histórico de Alterações de Valor ({card.edit_history.length})
                  </span>
                </div>
                <span
                  className="inline-flex transition-transform duration-200 ease-out"
                  style={{ transform: editHistoryOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <ChevronDown size={16} className="text-amber-400" />
                </span>
              </button>
              {editHistoryOpen && (
                <div className="p-3 space-y-2.5">
                  {card.edit_history.map((item: any, idx: number) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-200">
                          <User size={11} className="text-amber-400" />
                          {item.performed_by_name || "Financeiro/Master"} ({item.performed_by_role || "ADMIN"})
                        </span>
                        <span className="font-mono text-slate-500">
                          {item.performed_at ? new Date(item.performed_at).toLocaleString("pt-BR") : "Data não registrada"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="text-slate-400 line-through font-mono">
                          R$ {Number(item.previous_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-slate-500">➔</span>
                        <span className="text-emerald-400 font-bold font-mono text-sm">
                          R$ {Number(item.new_amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {item.reason && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-[11px] italic">
                          <strong className="not-italic font-bold text-amber-300">Motivo: </strong>
                          "{item.reason}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACCORDION: Receipts History */}
          {receiptsHistory.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-700/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800/80 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <History size={16} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Histórico de Comprovantes ({receiptsHistory.length})</span>
                </div>
                <span
                  className="inline-flex transition-transform duration-200 ease-out motion-reduce:transition-none"
                  style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <ChevronDown size={16} className="text-gray-400" />
                </span>
              </button>
              <div
                className={`grid transition-all duration-200 ease-out overflow-hidden motion-reduce:transition-none ${
                  historyOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0 p-4 space-y-3 bg-gray-900/30">
                  {receiptsHistory.map((receipt, idx) => {
                    const isLast = idx === receiptsHistory.length - 1;
                    const isPixConverted = !!card.payment_conversion_log && isLast;
                    const isOldCajuReceipt = !!card.payment_conversion_log && !isLast;

                    return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isPixConverted
                          ? "border-purple-500/40 bg-purple-500/10"
                          : isLast
                          ? "border-blue-500/30 bg-blue-500/5"
                          : "border-gray-700/30 bg-gray-800/20 opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                            isPixConverted
                              ? "bg-purple-500/20 text-purple-400"
                              : isLast
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-700/50 text-gray-500"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <a
                            href={receipt.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
                          >
                            {isPixConverted
                              ? "Comprovante Pix (Ativo)"
                              : isOldCajuReceipt
                              ? `Comprovante Caju Original (v${idx + 1})`
                              : isLast
                              ? "Comprovante Atual"
                              : `Comprovante v${idx + 1}`}
                          </a>
                          <p className="text-[10px] text-gray-400">
                            {new Date(receipt.uploadedAt).toLocaleString("pt-BR")}
                            {profilesMap[receipt.uploadedBy] && ` - ${profilesMap[receipt.uploadedBy]}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPixConverted ? (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded">
                            Pix Ativo
                          </span>
                        ) : isOldCajuReceipt ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                            Histórico Caju
                          </span>
                        ) : isLast ? (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 rounded">
                            Atual
                          </span>
                        ) : null}
                        {isMasterOrFinanceiro && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProof(receipt.url);
                            }}
                            title="Excluir este comprovante"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/15 transition-all cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            </div>
          )}

          {/* ACCORDION: Histórico de Etapas & SLA (Por Coluna) */}
          <div className="mt-4 rounded-xl border overflow-hidden shadow-xs"
               style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
            <button
              type="button"
              onClick={() => setStageHistoryOpen(!stageHistoryOpen)}
              className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
              style={{ backgroundColor: "var(--surface-hover)" }}
            >
              <div className="flex items-center gap-2">
                <Clock size={16} style={{ color: "var(--text-muted)" }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  Histórico de Etapas & SLA ({stageHistory.length})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cardSla.timeToPendenteSeconds !== null && (
                  <span className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded border"
                        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
                    Pendente: <strong className="ml-1" style={{ color: "var(--text-primary)" }}>{cardSla.timeToPendenteFormatted}</strong>
                  </span>
                )}
                {cardSla.pendenteToFinalizadoSeconds !== null && (
                  <span className="hidden sm:inline-flex text-[10px] font-medium px-2 py-0.5 rounded border"
                        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}>
                    Finalizado: <strong className="ml-1" style={{ color: "var(--text-primary)" }}>{cardSla.pendenteToFinalizadoFormatted}</strong>
                  </span>
                )}
                <span
                  className="inline-flex transition-transform duration-200 ease-out motion-reduce:transition-none"
                  style={{ transform: stageHistoryOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} />
                </span>
              </div>
            </button>

            <div
              className={`grid transition-all duration-200 ease-out overflow-hidden motion-reduce:transition-none ${
                stageHistoryOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0 p-4 space-y-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
                {/* Resumo de SLAs do Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-2">
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                    <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Nova ➔ Pendente</span>
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {cardSla.timeToPendenteFormatted}
                    </span>
                    <span className="text-[10px] block" style={{ color: "var(--text-muted)" }}>
                      {cardSla.isPendenteOngoing ? "Em andamento" : "Concluído"}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                    <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Pendente ➔ Finalizado</span>
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {cardSla.pendenteToFinalizadoFormatted}
                    </span>
                    <span className="text-[10px] block" style={{ color: "var(--text-muted)" }}>
                      {card.status === "FINALIZADO" ? "Concluído" : (cardSla.pendenteToFinalizadoSeconds ? "Em andamento" : "Aguardando")}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                    <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Ciclo Total</span>
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {cardSla.totalCycleFormatted}
                    </span>
                    <span className="text-[10px] block" style={{ color: "var(--text-muted)" }}>
                      {card.status === "FINALIZADO" ? "Resolvido" : "Tempo decorrido"}
                    </span>
                  </div>
                </div>

                {/* Linha do Tempo por Coluna */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tempo por Coluna / Etapa:</p>
                  {stageHistory.map((item, idx) => {
                    const isLast = idx === stageHistory.length - 1;
                    return (
                      <div
                        key={idx}
                        className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                          isLast
                            ? "border-emerald-500/40 bg-emerald-500/5"
                            : "border-slate-800 bg-slate-900/60"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                            isLast ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">
                                {getStatusLabel(item.stage)}
                              </span>
                              {isLast && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  Atual
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Entrada: {new Date(item.entered_at).toLocaleString("pt-BR")}
                              {item.left_at && ` • Saída: ${new Date(item.left_at).toLocaleString("pt-BR")}`}
                              {item.moved_by && profilesMap[item.moved_by] && ` • Por: ${profilesMap[item.moved_by]}`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {item.duration_seconds !== null && item.duration_seconds !== undefined ? (
                            <span className="inline-block text-xs font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 text-emerald-400">
                              {formatSlaDuration(item.duration_seconds)}
                            </span>
                          ) : (
                            <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300">
                              {formatSlaDuration(Math.max(0, Math.round((Date.now() - new Date(item.entered_at).getTime()) / 1000)))}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legacy refuse form */}
          {showRefuseForm && (
            <div className="mt-4 p-4 rounded-xl flex flex-col gap-3 bg-gray-900 border border-red-500/50">
              <label className="text-xs font-bold text-red-400">Motivo da Recusa / Cancelamento *</label>
              <textarea value={refusalReason} onChange={(e) => { setRefusalReason(e.target.value); setErrorMsg(""); }} rows={3} placeholder="Explique o motivo..." className={`w-full px-3 py-2 text-sm rounded-lg outline-none resize-none bg-gray-800 text-white border ${errorMsg ? "border-red-500" : "border-gray-700"}`} />
              {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => { setShowRefuseForm(false); setRefusalReason(""); setErrorMsg(""); }} className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-white transition-colors">Cancelar</button>
                <button type="button" disabled={loading} onClick={handleRefuse} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-col gap-3 px-6 py-4 shrink-0 border-t"
             style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
          {/* Aviso se a transição estiver bloqueada */}
          {isTransitionBlocked && isMasterOrFinanceiro && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <AlertTriangle size={15} className="shrink-0 text-amber-400" />
              <span className="text-xs font-medium leading-normal">Anexe o comprovante de pagamento para habilitar o avanço de etapa.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            {/* LADO ESQUERDO: Botões de Comunicação & Notificação */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {/* Enviar no Chat */}
              <button
                type="button"
                onClick={() => {
                  const cardPayload = {
                    requestId: card.id,
                    title: card.title || "Sem título",
                    amount: card.amount,
                    status: card.status,
                  };
                  
                  const targetId = card.real_requester_id || card.created_by;
                  if (targetId && userId !== targetId) {
                    openChatWithCard(targetId, cardPayload);
                  } else {
                    setPendingCard(cardPayload);
                    setIsChatOpen(true);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/70 hover:border-slate-600 transition-all shadow-sm cursor-pointer"
                title="Conversar sobre esta solicitação no chat"
              >
                <MessageSquare size={14} className="text-slate-400" />
                <span>Chat</span>
              </button>

              {/* Ações de E-mail (Segmentado Neutro Moderno) */}
              {isMasterOrFinanceiro && card.status !== "RECUSADO" && (
                <div className="inline-flex rounded-xl border border-slate-700/70 bg-slate-800/80 p-0.5 shadow-sm">
                  {/* Solicitar Pgto: Prioridade máxima e exclusivo em Pendente e Correção Pendente */}
                  {canRequestPayment && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailModalType("REQUEST");
                        setIsEmailModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-700/90 hover:bg-slate-700 rounded-lg transition-all cursor-pointer shadow-sm"
                      title="Solicitar pagamento a Tássio (Prioridade em Pendente)"
                    >
                      <Mail size={13} className="text-amber-400" />
                      <span>Solicitar Pgto</span>
                    </button>
                  )}

                  {canRequestPayment && (card.status !== "NOVA_SOLICITACAO" || hasAttachment) && (
                    <div className="w-px h-4 self-center bg-slate-700/80" />
                  )}

                  {/* E-mail Nubank 02 */}
                  {(card.status !== "NOVA_SOLICITACAO" || hasAttachment) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailModalType("PAID_NUBANK");
                        setIsEmailModalOpen(true);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
                        !canRequestPayment
                          ? "font-semibold text-white bg-slate-700/90 hover:bg-slate-700 shadow-sm"
                          : "font-medium text-slate-300 hover:text-white hover:bg-slate-700/70"
                      }`}
                      title="Notificar Tássio por e-mail que o pagamento já foi realizado (Nubank 02)"
                    >
                      <CheckCircle2 size={13} className={!canRequestPayment ? "text-emerald-400" : "text-slate-400"} />
                      <span>E-mail Nubank 02</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* LADO DIREITO: Ações de Decisão e Avanço */}
            <div className="flex items-center justify-end gap-2 w-full sm:w-auto flex-wrap">
              {/* Mover para Lixeira */}
              {canTrash && (
                <button
                  type="button"
                  onClick={handleTrash}
                  disabled={loading}
                  className="p-2 rounded-xl border border-slate-700/70 hover:border-red-500/30 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-40"
                  title="Mover para Lixeira"
                >
                  <Trash2 size={15} />
                </button>
              )}

              {/* Recusar / Cancelar */}
              {canRefuse && !showRefuseForm && !isValidacaoGestor && !isCorrecaoPendente && (
                <button
                  type="button"
                  onClick={() => setShowRefuseForm(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-300 hover:text-red-400 bg-slate-800/80 hover:bg-red-500/10 border border-slate-700/70 hover:border-red-500/30 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Ban size={14} className="text-slate-400" />
                  <span>{userRole === "GESTOR" ? "Cancelar" : "Recusar"}</span>
                </button>
              )}

              {((canTrash || canRefuse) && !showRefuseForm && canAdvance) && (
                <div className="hidden sm:block w-px h-5 mx-0.5 bg-slate-700/70" />
              )}

              {/* Botões quando Em Aprovação ou Correção Pendente */}
              {(isEmAprovacao || isCorrecaoPendente) && isMasterOrFinanceiro && !showRefuseForm && (
                <div className="flex items-center gap-2 flex-wrap">
                  {isRecharge ? (
                    <button
                      type="button"
                      onClick={() => handleAdvance("FINALIZADO")}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      {loading ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={15} />
                          <span>Finalizar Recarga</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAdvance("VALIDACAO_GESTOR")}
                        disabled={loading || isTransitionBlocked}
                        className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                      >
                        Validação do Gestor
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdvance("AGUARDANDO_PAGAMENTO")}
                        disabled={loading || isTransitionBlocked}
                        className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                      >
                        Aguardando Nota
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdvance("FINALIZADO")}
                        disabled={loading || isTransitionBlocked}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span>Finalizar Direto</span>
                        <ArrowRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Botões quando Validado pelo Gestor */}
              {isValidadoGestor && isMasterOrFinanceiro && !showRefuseForm && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAdvance("AGUARDANDO_PAGAMENTO")}
                    disabled={loading}
                    className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Aguardando Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdvance("FINALIZADO")}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>Finalizar Direto</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Botão dedicado para Aguardando Nota (vai DIRETO para Finalizado) */}
              {(card.status === "AGUARDANDO_PAGAMENTO" || (card.status as string) === "AGUARDANDO_NOTINHA") && isMasterOrFinanceiro && !showRefuseForm && (
                <button
                  type="button"
                  onClick={() => handleAdvance("FINALIZADO")}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <span>Finalizar Pagamento</span>
                      <CheckCircle2 size={15} />
                    </>
                  )}
                </button>
              )}

              {/* Botão de avanço padrão (apenas para etapas genéricas) */}
              {!isEmAprovacao &&
                !isValidacaoGestor &&
                !isCorrecaoPendente &&
                !isValidadoGestor &&
                !isFinalizado &&
                card.status !== "AGUARDANDO_PAGAMENTO" &&
                (card.status as string) !== "AGUARDANDO_NOTINHA" &&
                canAdvance &&
                !showRefuseForm && (
                <div className="flex items-center gap-2">
                  {isAdvanceToPendenteBlocked && (
                    <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1.5 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/25 whitespace-nowrap shadow-xs">
                      <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                      Selecione o CNPJ acima para liberar
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAdvance()}
                    disabled={loading || isTransitionBlocked || isAdvanceToPendenteBlocked}
                    title={
                      isAdvanceToPendenteBlocked
                        ? "Selecione a Conta Pagadora / CNPJ (ou Nubank 02) acima para liberar a aprovação para Pendente"
                        : undefined
                    }
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {loading ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <>
                        <span>{isRecharge && isNovaSolicitacao ? "Avançar para Pendente" : (isNovaSolicitacao ? "Aprovar Solicitação" : "Avançar Status")}</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Ações para Cards FINALIZADOS (Master / Financeiro) */}
              {isFinalizado && isMasterOrFinanceiro && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Reabrir para Aguardando Nota */}
                  <button
                    type="button"
                    onClick={() => handleReopenStatus("AGUARDANDO_PAGAMENTO")}
                    disabled={isReopening}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 hover:border-amber-500/50 shadow-xs transition-all cursor-pointer disabled:opacity-40"
                    title="Tirar de Finalizado e mover para Aguardando Nota"
                  >
                    {isReopening ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RotateCcw size={13} />
                    )}
                    <span>Reabrir p/ Aguardando Nota</span>
                  </button>

                  {/* Exigir Correção (Mover para Correção Pendente) */}
                  <button
                    type="button"
                    onClick={() => {
                      setReopenTargetStatus("CORRECAO_PENDENTE");
                      setReopenReason("");
                      setIsReopenModalOpen(true);
                    }}
                    disabled={isReopening}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 shadow-xs transition-all cursor-pointer disabled:opacity-40"
                    title="Exigir correção mesmo com o card finalizado"
                  >
                    <AlertTriangle size={13} />
                    <span>Exigir Correção</span>
                  </button>

                  {/* Reabrir para Pendente / Em Aprovação */}
                  <button
                    type="button"
                    onClick={() => handleReopenStatus("EM_APROVACAO")}
                    disabled={isReopening}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 hover:border-slate-600 shadow-xs transition-all cursor-pointer disabled:opacity-40"
                    title="Tirar de Finalizado e retornar para Pendente"
                  >
                    <Undo2 size={13} />
                    <span>Reabrir p/ Pendente</span>
                  </button>

                  {/* Converter Caju para Pix */}
                  {isCajuMealRequest && (
                    <button
                      type="button"
                      onClick={() => {
                        setCajuPixKey(
                          card.payment_conversion_log?.collaboratorPixKey ||
                            card.pix_key ||
                            card.caju_phone ||
                            ""
                        );
                        setCajuPixOwner(card.pix_owner || card.pix_name || "");
                        setCajuAmount(
                          Number(card.amount || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        );
                        setCajuTargetStatus("CORRECAO_PENDENTE");
                        setCajuPixError("");
                        setShowCajuToPixModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/40 hover:border-purple-500/70 shadow-xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
                      title="Abrir assistente para converter Caju em Pix"
                    >
                      <RefreshCw size={13} />
                      <span>
                        {card.payment_conversion_log
                          ? "Editar Conversão Pix"
                          : "🔄 Converter Caju p/ Pix"}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Enviar E-mail para Tassio */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col bg-slate-900 border-slate-800 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-slate-800/80 border-slate-700/80 text-slate-200">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {emailModalType === "PAID_NUBANK" ? "Pagamento Realizado (Nubank 02)" : "Solicitar Pagamento a Tássio"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Destinatário: <span className="text-slate-300 font-semibold">tassiolimacs@gmail.com</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Alternador de Modelo (Tabs Neutras Modernas - Apenas se permitido solicitar pagamento) */}
            {canRequestPayment && (
              <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-5 pt-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEmailModalType("REQUEST")}
                  className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                    emailModalType === "REQUEST"
                      ? "border-emerald-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Mail size={14} className={emailModalType === "REQUEST" ? "text-amber-400" : "text-slate-500"} />
                  <span>Solicitar Pgto (Tássio)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmailModalType("PAID_NUBANK")}
                  className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                    emailModalType === "PAID_NUBANK"
                      ? "border-emerald-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckCircle2 size={14} className={emailModalType === "PAID_NUBANK" ? "text-emerald-400" : "text-slate-500"} />
                  <span>Pagamento Realizado (Nubank 02)</span>
                </button>
              </div>
            )}

            {/* Conteúdo */}
            <div className="p-5 space-y-4">
              {/* Seleção de CNPJ / Conta Pagadora quando for solicitação de pagamento */}
              {emailModalType === "REQUEST" && (
                <div className={`p-3.5 rounded-xl border transition-all ${
                  requiresCnpj && !localCnpj 
                    ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20" 
                    : "bg-slate-950/80 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Building2 size={15} className="text-amber-400" />
                      <span>Conta Pagadora / CNPJ</span>
                      {requiresCnpj ? (
                        <span className="text-red-400">* (Obrigatório)</span>
                      ) : (
                        <span className="text-blue-400 font-normal">(Opcional no Caju)</span>
                      )}
                    </label>
                    {requiresCnpj && !localCnpj ? (
                      <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                        Obrigatório
                      </span>
                    ) : localCnpj ? (
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Selecionado
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        Caju Liberado
                      </span>
                    )}
                  </div>
                  <select
                    value={localCnpj}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-2 text-xs text-white font-medium outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-colors cursor-pointer"
                  >
                    <option value="" className="bg-slate-900 text-slate-400">
                      {isCajuOnly ? "-- Não necessário no Caju (ou selecione Conta/CNPJ) --" : "-- Selecione a Conta / CNPJ (Obrigatório) --"}
                    </option>
                    {CNPJ_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-slate-900 text-slate-100 font-medium">
                        {opt}
                      </option>
                    ))}
                    {localCnpj && !CNPJ_OPTIONS.includes(localCnpj) && (
                      <option value={localCnpj} className="bg-slate-900 text-slate-100 font-medium">
                        {localCnpj}
                      </option>
                    )}
                  </select>
                  {requiresCnpj && !localCnpj && (
                    <p className="text-[11px] text-amber-300 mt-2 flex items-center gap-1.5 font-medium">
                      <AlertTriangle size={13} className="shrink-0 text-amber-400" />
                      <span>Escolha o pagador (Nubank 02 ou CNPJ) para definir o assunto e liberar o envio.</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Assunto:
                </label>
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-200 font-medium break-words">
                  {getEmailContent(emailModalType).subject}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Mensagem:
                </label>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto select-all">
                  {getEmailContent(emailModalType).body}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleOpenGmail}
                    disabled={emailModalType === "REQUEST" && requiresCnpj && !localCnpj}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800"
                    title={
                      emailModalType === "REQUEST" && requiresCnpj && !localCnpj
                        ? "Selecione o CNPJ / Conta Pagadora acima para liberar"
                        : "Abre a tela de envio do Gmail diretamente no navegador com tudo preenchido"
                    }
                  >
                    <ExternalLink size={14} className="text-slate-400" />
                    <span>Abrir no Gmail Web</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenDefaultMail}
                    disabled={emailModalType === "REQUEST" && requiresCnpj && !localCnpj}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800"
                    title={
                      emailModalType === "REQUEST" && requiresCnpj && !localCnpj
                        ? "Selecione o CNPJ / Conta Pagadora acima para liberar"
                        : "Abre no Outlook ou aplicativo de e-mail padrão do computador"
                    }
                  >
                    <Mail size={14} className="text-slate-400" />
                    <span>Abrir no Outlook / App</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyEmailText}
                  disabled={emailModalType === "REQUEST" && requiresCnpj && !localCnpj}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-medium border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    emailCopied
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white disabled:hover:bg-slate-800/60"
                  }`}
                  title={
                    emailModalType === "REQUEST" && requiresCnpj && !localCnpj
                      ? "Selecione o CNPJ / Conta Pagadora acima para liberar"
                      : undefined
                  }
                >
                  {emailCopied ? <CheckCircle2 size={14} /> : <Copy size={14} className="text-slate-400" />}
                  <span>{emailCopied ? "Texto copiado para a área de transferência!" : "Copiar Texto da Mensagem"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Descrição Completa Expandida */}
      {isDescriptionModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsDescriptionModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] rounded-2xl border shadow-2xl flex flex-col bg-slate-900 border-slate-800 text-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <AlignLeft size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    Descrição Completa da Solicitação
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {card.title} • <span className="font-mono text-emerald-400">#{card.id.substring(0, 6)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDescriptionModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-sm whitespace-pre-wrap leading-relaxed select-text shadow-inner">
                {card.notes || card.description}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500">
                {(card.notes || card.description || "").length} caracteres
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(card.notes || card.description || "");
                    setDescriptionCopied(true);
                    setTimeout(() => setDescriptionCopied(false), 2000);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    descriptionCopied
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                  }`}
                >
                  {descriptionCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  <span>{descriptionCopied ? "Copiado!" : "Copiar Texto"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDescriptionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Exigir Correção em Card Finalizado */}
      {isReopenModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            if (!isReopening) setIsReopenModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col bg-slate-900 border-slate-800 text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-red-500/10 border-red-500/30 text-red-400">
                  <AlertTriangle size={19} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Exigir Correção (Reabrir Solicitação)
                  </h3>
                  <p className="text-xs text-slate-400">
                    O card sairá de <strong className="text-emerald-400">Finalizado</strong> e irá para <strong className="text-red-400">Correção Pendente</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isReopening) setIsReopenModalOpen(false);
                }}
                disabled={isReopening}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Motivo da Correção / O que precisa ser ajustado? *
                </label>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Descreva detalhadamente o que o colaborador precisa corrigir (ex: nota fiscal ilegível, valor divergente, etc.)..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 resize-none font-medium leading-relaxed placeholder:text-slate-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200 leading-normal">
                  Ao confirmar, o solicitante verá este motivo com destaque e poderá reenviar a nota ou ajustar as informações.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                disabled={isReopening}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleReopenStatus("CORRECAO_PENDENTE")}
                disabled={isReopening || !reopenReason.trim()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-xl bg-red-600 hover:bg-red-500 transition-all cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isReopening ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <AlertTriangle size={14} />
                )}
                <span>Confirmar e Exigir Correção</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Redesenhado: Converter Caju para Pix */}
      {showCajuToPixModal && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => {
            if (!isConvertingCajuPix) setShowCajuToPixModal(false);
          }}
        >
          <div
            className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col bg-slate-900 border-purple-500/30 text-slate-100"
            onClick={(e) => e.stopPropagation()}
            onPaste={handleCajuPixPaste}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-purple-500/20 bg-gradient-to-r from-purple-950/50 to-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-xs">
                  <RefreshCw size={19} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Converter Caju para Pix
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Pós-Fechamento
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ajuste o titular, a chave Pix e escolha para onde a solicitação deve ir.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isConvertingCajuPix) setShowCajuToPixModal(false);
                }}
                disabled={isConvertingCajuPix}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {cajuPixError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
                  <AlertTriangle size={15} className="shrink-0 text-red-400" />
                  <span className="font-medium">{cajuPixError}</span>
                </div>
              )}

              {/* Grid: Titular e Chave Pix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Nome do Titular / Favorecido *
                  </label>
                  <input
                    type="text"
                    value={cajuPixOwner}
                    onChange={(e) => {
                      setCajuPixOwner(e.target.value);
                      setCajuPixError("");
                    }}
                    placeholder="Ex: João da Silva"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-medium"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Nome completo da pessoa que vai receber
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Chave Pix *
                  </label>
                  <input
                    type="text"
                    value={cajuPixKey}
                    onChange={(e) => {
                      setCajuPixKey(e.target.value);
                      setCajuPixError("");
                    }}
                    placeholder="CPF, CNPJ, Celular, E-mail ou Aleatória"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-mono text-emerald-400"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Chave para transferência bancária
                  </span>
                </div>
              </div>

              {/* Grid: Valor e Motivo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Valor a Pagar (R$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
                      R$
                    </span>
                    <input
                      type="text"
                      value={cajuAmount}
                      onChange={(e) => handleCurrencyFieldChange(e.target.value, setCajuAmount)}
                      placeholder="0,00"
                      className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-bold"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Pode ajustar caso o valor no Pix seja diferente
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Motivo da Conversão *
                  </label>
                  <input
                    type="text"
                    value={cajuReason}
                    onChange={(e) => {
                      setCajuReason(e.target.value);
                      setCajuPixError("");
                    }}
                    placeholder="Ex: Estabelecimento não aceita Caju"
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-700 bg-slate-950 text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 font-medium"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Justificativa para conciliação contábil
                  </span>
                </div>
              </div>

              {/* Seletor de Destino da Solicitação */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Destino da Solicitação após a conversão:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCajuTargetStatus("CORRECAO_PENDENTE")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      cajuTargetStatus === "CORRECAO_PENDENTE"
                        ? "bg-red-500/15 border-red-500 text-white ring-1 ring-red-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-400">Correção Pendente</span>
                      {cajuTargetStatus === "CORRECAO_PENDENTE" && (
                        <CheckCircle2 size={13} className="text-red-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Recomendado p/ conferência ou pagamento posterior.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCajuTargetStatus("AGUARDANDO_PAGAMENTO")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      cajuTargetStatus === "AGUARDANDO_PAGAMENTO"
                        ? "bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">Aguardando Nota</span>
                      {cajuTargetStatus === "AGUARDANDO_PAGAMENTO" && (
                        <CheckCircle2 size={13} className="text-amber-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Pronto para pagamento via Pix aguardando comprovante fiscal.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCajuTargetStatus("FINALIZADO")}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      cajuTargetStatus === "FINALIZADO"
                        ? "bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">Manter Finalizado</span>
                      {cajuTargetStatus === "FINALIZADO" && (
                        <CheckCircle2 size={13} className="text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Pix já foi pago de imediato (exige comprovante).
                    </span>
                  </button>
                </div>
              </div>

              {/* Checkbox Saldo Caju */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-purple-500/20 bg-purple-950/20 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cajuBalanceWithdrawn}
                  onChange={(e) => setCajuBalanceWithdrawn(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-purple-200 block">
                    Saldo antigo já foi retirado / cancelado no Caju
                  </span>
                  <span className="text-[10px] text-purple-400/80 block">
                    Garante que não haverá duplicidade de pagamento no cartão benefício.
                  </span>
                </div>
              </label>

              {/* Upload Comprovante Pix com suporte a Colar / Paste e Drop */}
              <div 
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5 transition-all"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      setCajuPixError("Tamanho máximo de 5MB.");
                      return;
                    }
                    setCajuPixFile(file);
                    setCajuPixError("");
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Comprovante do Pix
                    {cajuTargetStatus === "FINALIZADO" ? (
                      <span className="text-red-400 font-bold ml-1">* (Obrigatório se mantiver Finalizado)</span>
                    ) : (
                      <span className="text-slate-500 font-normal ml-1">(Opcional agora)</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteCajuPixFromClipboard}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-purple-300 hover:text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 px-2.5 py-1 rounded-lg border border-purple-500/30 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Colar print da área de transferência (ou aperte Ctrl+V)"
                  >
                    <Copy size={12} />
                    <span>Colar Print (Ctrl+V)</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => cajuPixFileInputRef.current?.click()}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-dashed border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UploadCloud size={15} />
                    <span>{cajuPixFile ? "Trocar Arquivo" : "Selecionar Arquivo"}</span>
                  </button>
                  <input
                    type="file"
                    ref={cajuPixFileInputRef}
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 5 * 1024 * 1024) {
                          setCajuPixError("Tamanho máximo de 5MB.");
                          return;
                        }
                        setCajuPixFile(f);
                        setCajuPixError("");
                      }
                    }}
                  />
                  {cajuPixFile ? (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 truncate bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      <CheckCircle2 size={13} className="shrink-0" />
                      {cajuPixFile.name}
                    </span>
                  ) : (paymentProofUrl || (card as any).receipt_url || card.invoice_url) ? (
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="shrink-0 text-slate-500" />
                      Comprovante anterior disponível no card
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">
                      Ou pressione <strong>Ctrl + V</strong> para colar a imagem aqui
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="p-4 border-t border-purple-500/20 bg-slate-950/80 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCajuToPixModal(false)}
                disabled={isConvertingCajuPix}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCajuToPix}
                disabled={isConvertingCajuPix}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white rounded-xl bg-purple-600 hover:bg-purple-500 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isConvertingCajuPix ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
                <span>Salvar e Converter para Pix</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QuickEditCardModal para Master e Financeiro */}
      {isEditModalOpen && (
        <QuickEditCardModal
          isOpen={isEditModalOpen}
          card={card}
          userRole={userRole}
          userName={simulatedUserName || userName || "Usuário"}
          userId={userId || ""}
          profilesMap={profilesMap}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(updatedCard, msg) => {
            setIsEditModalOpen(false);
            Object.assign(card, updatedCard);
            onUpdate(msg || "Solicitação atualizada com sucesso!");
          }}
        />
      )}
    </div>
  );
}



