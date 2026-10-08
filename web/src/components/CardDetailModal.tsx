"use client";
import { useState, useRef, useEffect } from "react";
import {
  X, ArrowRight, Loader2, CreditCard, Calendar, User, AlignLeft, Tag,
  Ban, Trash2, Mail, UploadCloud, CheckCircle2, Copy, FileText, Building2,
  ShieldCheck, ShieldAlert, Zap, ChevronDown, ChevronUp, History, AlertTriangle, MessageSquare, ExternalLink, Maximize2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import type { PaymentRequest, ReceiptHistoryItem } from "@/types/database";
import { getStatusLabel } from "@/constants/kanban";

const NEXT_STATUS: Record<string, string> = {
  NOVA_SOLICITACAO: "EM_APROVACAO",
  EM_APROVACAO: "AGUARDANDO_PAGAMENTO",
  VALIDADO_GESTOR: "AGUARDANDO_PAGAMENTO",
  AGUARDANDO_PAGAMENTO: "FINALIZADO",
};

const CNPJ_OPTIONS = ["CNPJ 1", "CNPJ 2", "CNPJ 3", "CNPJ 4", "CNPJ 5", "CNPJ 6"];

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
  const { userId } = useAuth();
  const { setIsChatOpen, setPendingCard, allProfiles, setActiveChatId, startChat, openChatWithCard } = useChat();
  const [loading, setLoading] = useState(false);
  const [showRefuseForm, setShowRefuseForm] = useState(false);
  const [refusalReason, setRefusalReason] = useState(card.refusal_reason || "");
  const [errorMsg, setErrorMsg] = useState("");

  // Maker-Checker
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Payment Proof (Type A - Financeiro)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(card.payment_proof_url || null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const correctionInputRef = useRef<HTMLInputElement>(null);

  // Invoice / Notinha (Type B - Gestor)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(card.invoice_url || null);
  const [isUploadingInvoice, setIsUploadingInvoice] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const [copiedKey, setCopiedKey] = useState(false);
  const [localCnpj, setLocalCnpj] = useState(card.cnpj || "");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailModalType, setEmailModalType] = useState<"PAID_NUBANK" | "REQUEST">("PAID_NUBANK");
  const [requesterSector, setRequesterSector] = useState<string>("");
  const [emailCopied, setEmailCopied] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [descriptionCopied, setDescriptionCopied] = useState(false);

  // Status helpers
  const isNovaSolicitacao = card.status === "NOVA_SOLICITACAO";
  const isEmAprovacao = card.status === "EM_APROVACAO";
  
  const isValidacaoGestor = card.status === "VALIDACAO_GESTOR";
  const isValidadoGestor = card.status === "VALIDADO_GESTOR";
  const isCorrecaoPendente = card.status === "CORRECAO_PENDENTE";
  const isFinalizado = card.status === "FINALIZADO";

  const isMasterOrFinanceiro = userRole === "FINANCEIRO" || userRole === "MASTER";
  const canTrash = isMasterOrFinanceiro;
  const hasAttachment = !!paymentProofUrl;
  const isTransitionBlocked = isEmAprovacao && !paymentProofUrl;

  // Forma de pagamento Pix (no card ou nos splits)
  const isPix =
    card.payment_type?.toUpperCase() === "PIX" ||
    card.payment_method?.toUpperCase() === "PIX" ||
    Boolean(card.splits && card.splits.some((s: any) => s.payment_type?.toUpperCase() === "PIX"));

  const canAdvance = isMasterOrFinanceiro && NEXT_STATUS[card.status];
  const canRefuseFinanceiro = isMasterOrFinanceiro && card.status !== "RECUSADO" && card.status !== "FINALIZADO";
  const canCancelGestor = userRole === "GESTOR" && card.status !== "RECUSADO" && card.status !== "FINALIZADO";
  const canRefuse = canRefuseFinanceiro || canCancelGestor;

  // Maker-Checker: is the current user the owner of this card?
  const isOwner = userId === card.created_by || userId === card.real_requester_id;

  // Receipts history
  const receiptsHistory: ReceiptHistoryItem[] = (card.receipts_history as ReceiptHistoryItem[] | null) || [];
  const latestReceipt = receiptsHistory.length > 0 ? receiptsHistory[receiptsHistory.length - 1] : null;

  const requesterName = profilesMap[card.real_requester_id || ""] || profilesMap[card.created_by] || "Desconhecido";

  // Buscar setor do solicitante para compor no e-mail (ex: Instalação)
  useEffect(() => {
    async function loadRequesterSector() {
      const targetUserId = card.real_requester_id || card.created_by;
      if (!targetUserId) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("sector")
          .eq("id", targetUserId)
          .maybeSingle();

        if (profile?.sector) {
          const { data: sectorData } = await supabase
            .from("sectors")
            .select("name")
            .eq("id", profile.sector)
            .maybeSingle();

          if (sectorData?.name) {
            setRequesterSector(sectorData.name);
          } else {
            setRequesterSector(profile.sector);
          }
        }
      } catch (e) {
        console.error("Erro ao buscar setor do solicitante:", e);
      }
    }
    loadRequesterSector();
  }, [card.real_requester_id, card.created_by]);

  // ========== HANDLERS ==========

  async function handleAdvance(targetStatus?: string) {
    if (!isMasterOrFinanceiro) return;
    let newStatus = targetStatus;
    if (!newStatus) {
      if (card.status === "AGUARDANDO_PAGAMENTO" || (card.status as string) === "AGUARDANDO_NOTINHA") {
        newStatus = "FINALIZADO";
      } else {
        newStatus = NEXT_STATUS[card.status];
      }
    }
    if (!newStatus) return;
    if (isTransitionBlocked) return;
    setLoading(true);
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: newStatus, payment_proof_url: paymentProofUrl, invoice_url: invoiceUrl })
      .eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao avançar solicitação."); return; }
    onUpdate(`Solicitação avançou para ${getStatusLabel(newStatus)}`);
  }

  async function handleRefuse() {
    if (!refusalReason.trim()) { setErrorMsg("O motivo é obrigatório."); return; }
    setLoading(true);
    const prefix = userRole === "GESTOR" ? "Cancelado pelo Gestor" : "Recusado pelo Financeiro";
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: "RECUSADO", refusal_reason: `${prefix}: ${refusalReason.trim()}`, payment_proof_url: paymentProofUrl, invoice_url: invoiceUrl })
      .eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao recusar solicitação."); return; }
    onUpdate("Solicitação enviada para Recusados.");
  }

  async function handleTrash() {
    if (!window.confirm("Deseja realmente mover este card para a Lixeira?")) return;
    setLoading(true);
    const { error } = await supabase.from("payment_requests").update({ is_deleted: true }).eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao excluir solicitação."); return; }
    onUpdate("Solicitação movida para a Lixeira.");
  }

  function getEmailContent(type: "PAID_NUBANK" | "REQUEST" = emailModalType) {
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? "Bom dia" : "Boa tarde";
    const formattedAmount = Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

    // Obter dados do Pix (dos splits ou direto do card)
    const pixSplit = card.splits?.find((s: any) => s.payment_type?.toUpperCase() === "PIX");
    const pixKey = pixSplit?.pix_key || card.pix_key || "Não informado";
    const pixOwner = pixSplit?.pix_owner || card.pix_owner || card.pix_name || "Não informado";

    const solicitante = requesterSector || (requesterName !== "Desconhecido" ? requesterName : "Solicitante");
    const gestorName = requesterName !== "Desconhecido" ? requesterName : "Solicitante";

    if (type === "PAID_NUBANK") {
      const rawSubject = `Pagamento Realizado | ${card.title} | Nubank`;
      const motivo = (card.notes || card.description)?.trim() || card.title;

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

      return {
        to: "tassiolimacs@gmail.com",
        subject: rawSubject,
        body: rawBody,
        encodedSubject: encodeURIComponent(rawSubject),
        encodedBody: encodeURIComponent(rawBody),
      };
    }

    // Tipo REQUEST (Solicitar pagamento a Tassio)
    const cnpjDisplay = localCnpj || card.cnpj || "Sem CNPJ";
    const rawSubject = `Pagamento Ref. ${card.title} | ${cnpjDisplay}`;
    const rawBody = `--\n${greeting}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: ${card.title}\nValor: R$ ${formattedAmount}\nChave pix / Linha digitável: ${pixKey}\nTitular: ${pixOwner}\nSolicitante: ${gestorName}`;

    return {
      to: "tassiolimacs@gmail.com",
      subject: rawSubject,
      body: rawBody,
      encodedSubject: encodeURIComponent(rawSubject),
      encodedBody: encodeURIComponent(rawBody),
    };
  }

  function handleOpenGmail() {
    const { to, encodedSubject, encodedBody } = getEmailContent(emailModalType);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodedSubject}&body=${encodedBody}`;
    window.open(gmailUrl, "_blank");
  }

  function handleOpenDefaultMail() {
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

    const { error } = await supabase.from("payment_requests").update({
      payment_proof_url: combinedProof,
      receipts_history: updatedHistory,
      rejection_reason: null,
      status: "VALIDACAO_GESTOR",
    }).eq("id", card.id);
    setIsUploading(false);
    if (error) { alert("Erro ao enviar correcao."); return; }
    onUpdate("Comprovante corrigido. Aguardando nova validacao do Gestor.");
  };

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingInvoice(true);
    const uploadedUrls: string[] = [];
    for (const file of Array.from(e.target.files)) {
      if (file.size > 5 * 1024 * 1024) continue;
      const fileExt = file.name.split('.').pop();
      const fileName = `invoice_${card.id}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `receipts/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
        uploadedUrls.push(urlData.publicUrl);
      }
    }
    if (uploadedUrls.length > 0) {
      const newCombinedUrl = invoiceUrl ? `${invoiceUrl},${uploadedUrls.join(',')}` : uploadedUrls.join(',');
      setInvoiceUrl(newCombinedUrl);
      await supabase.from("payment_requests").update({ invoice_url: newCombinedUrl }).eq("id", card.id);
      onUpdate("Notinha(s) anexada(s) com sucesso.");
    }
    setIsUploadingInvoice(false);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.indexOf("image") !== -1) {
        const file = item.getAsFile();
        if (file) {
          const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
          if (isCorrecaoPendente && isMasterOrFinanceiro) {
            handleCorrectionUpload(fakeEvent);
          } else if (isMasterOrFinanceiro) {
            handleFileUpload(fakeEvent);
          } else {
            handleInvoiceUpload(fakeEvent);
          }
        }
        break;
      }
    }
  };

  const handleCnpjChange = async (newCnpj: string) => {
    setLocalCnpj(newCnpj);
    await supabase.from("payment_requests").update({ cnpj: newCnpj }).eq("id", card.id);
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
      setLoading(false);
      onUpdate(data.message || "Solicitacao atualizada.");
    } catch {
      setLoading(false);
      alert("Erro de rede ao validar.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl flex flex-col max-h-[92vh] shadow-2xl relative overflow-hidden"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--surface-border)" }}
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 border-b"
             style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-hover)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Detalhes da Solicitação</h2>
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-md bg-brand-primary text-white">
              #{card.id.substring(0, 6)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">

          {/* ALERT: CORRECAO PENDENTE */}
          {isCorrecaoPendente && card.rejection_reason && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/40">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Correção Exigida pelo Gestor</p>
                  <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed font-medium">{card.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-2xl font-black leading-tight mb-1" style={{ color: "var(--text-primary)" }}>{card.title}</h3>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  R$ {Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border"
                     style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                  <Tag size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{card.category}</span>
                </div>
                {isPix && isMasterOrFinanceiro && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border"
                       style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                    <Building2 size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div className="flex flex-col w-full">
                      <span className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>CNPJ de Faturamento</span>
                      <select 
                        value={localCnpj} 
                        onChange={(e) => handleCnpjChange(e.target.value)} 
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-brand-primary font-medium"
                        style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                      >
                        <option value="" style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>Selecione um CNPJ...</option>
                        {CNPJ_OPTIONS.map((opt) => (
                          <option key={opt} value={opt} style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {isPix && !isMasterOrFinanceiro && localCnpj && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border"
                       style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                    <Building2 size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>CNPJ de Faturamento</span>
                      <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{localCnpj}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-xl border"
                     style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                  <User size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>Solicitante Real</span>
                    <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{requesterName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border"
                     style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                  <Calendar size={16} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>Data do Pedido</span>
                    <span className="font-semibold text-xs" style={{ color: "var(--text-primary)" }}>{new Date(card.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                {(card.notes || card.description) && (
                  <div
                    className="flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all"
                    style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <AlignLeft size={14} className="text-emerald-500 shrink-0" />
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
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 transition-all cursor-pointer"
                          title="Abrir descrição completa em janela expandida"
                        >
                          <Maximize2 size={11} />
                          <span>Ver Completa</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border max-h-64 overflow-y-auto custom-scrollbar" style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}>
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
              <div className="p-5 rounded-2xl border shadow-sm"
                   style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className="text-blue-500" />
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
                    const labelBadge = isSplitPix ? "Pix" : isSplitCaju ? "Caju" : isSplitBoleto ? "Boleto" : (split.payment_type || "Outro");

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
                              <button onClick={async () => { if (split.pix_key) { await navigator.clipboard.writeText(split.pix_key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); } }} className="p-1 rounded transition-colors shrink-0 cursor-pointer" style={{ color: "var(--text-secondary)" }} title="Copiar Chave Pix">
                                {copiedKey ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
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
                          <span className="text-xs font-bold block truncate" style={{ color: "var(--text-primary)" }}>{split.caju_phone}</span>
                        </div>
                      )}
                      {isSplitBoleto && (
                        <div className="space-y-2 mt-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-muted)" }}>Linha Digitável</span>
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border group" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{split.boleto_barcode || "-"}</span>
                              <button onClick={async () => { if (split.boleto_barcode) { await navigator.clipboard.writeText(split.boleto_barcode); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); } }} className="p-1 rounded transition-colors shrink-0 cursor-pointer" style={{ color: "var(--text-secondary)" }} title="Copiar Linha Digitável">
                                {copiedKey ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
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

              {/* Notinha */}
              <div className={`p-4 rounded-xl border ${isValidacaoGestor && !invoiceUrl ? "border-amber-500/50 bg-amber-500/10" : ""} flex flex-col gap-2`}
                   style={!(isValidacaoGestor && !invoiceUrl) ? { backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" } : undefined}>
                <div className="flex items-center gap-3">
                  <FileText size={20} className={invoiceUrl ? "text-blue-500" : "text-amber-500"} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>Notinha ou Nota Fiscal</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Comprovante de compra/gasto real</p>
                  </div>
                </div>
                {isUploadingInvoice ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-blue-500">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-semibold">Enviando nota...</span>
                  </div>
                ) : invoiceUrl ? (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t" style={{ borderColor: "var(--surface-border)" }}>
                    <div className="flex flex-wrap gap-2">
                      {invoiceUrl.split(',').map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-bold bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors flex items-center gap-1">
                          Nota {i + 1}
                        </a>
                      ))}
                    </div>
                    <button onClick={() => invoiceInputRef.current?.click()} className="text-[10px] hover:underline self-start cursor-pointer" style={{ color: "var(--text-muted)" }}>+ Adicionar Mais</button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <button onClick={() => invoiceInputRef.current?.click()} disabled={isUploadingInvoice} 
                      className="px-3 py-2 text-xs font-medium border border-dashed rounded-lg transition-colors w-full flex items-center justify-center gap-2 hover:opacity-80 cursor-pointer"
                      style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}>
                      + Anexar Nota / Recibo
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

          {/* COMPROVANTE UPLOAD (Financeiro) - Normal flow */}
          {!isNovaSolicitacao && isMasterOrFinanceiro && !isCorrecaoPendente && !isValidacaoGestor && (
            <div className={`mt-6 p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${isUploading ? 'border-blue-500/50 bg-blue-500/5' : hasAttachment ? 'border-emerald-500/40 bg-emerald-500/5' : 'hover:opacity-90'}`}
                 style={!isUploading && !hasAttachment ? { backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" } : undefined}>
              {isUploading ? (
                <div className="flex flex-col items-center gap-2" style={{ color: "var(--text-muted)" }}>
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <span className="text-sm font-medium">Enviando anexo...</span>
                </div>
              ) : paymentProofUrl ? (
                <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400 w-full">
                  <CheckCircle2 size={32} />
                  <span className="text-sm font-bold">Comprovante(s) Anexado(s)</span>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {paymentProofUrl.split(',').map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs underline font-semibold text-blue-600 dark:text-blue-400 hover:opacity-80">Visualizar {i + 1}</a>
                    ))}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs mt-2 underline cursor-pointer" style={{ color: "var(--text-muted)" }}>+ Adicionar Mais Comprovantes</button>
                </div>
              ) : (
                <>
                  <UploadCloud size={36} style={{ color: "var(--text-muted)" }} />
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Comprovante(s) de Pagamento</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Apenas para Master/Financeiro. Anexe as imagens ou PDFs.<br /><span className="text-amber-600 dark:text-amber-400 font-bold">*Obrigatório para avançar</span></p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">Selecionar Arquivos</button>
                </>
              )}
            </div>
          )}

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
            <div className="mt-6 p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5">
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

              {isOwner && !showRejectForm && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button onClick={() => handleValidateAction("APPROVE")} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all disabled:opacity-50">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={18} />}
                    Validar Pagamento
                  </button>
                  <button onClick={() => setShowRejectForm(true)} disabled={loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-all disabled:opacity-50">
                    <ShieldAlert size={18} />
                    Exigir Correção
                  </button>
                </div>
              )}

              {isOwner && showRejectForm && (
                <div className="flex flex-col gap-3 mt-2 p-4 rounded-xl bg-gray-900 border border-red-500/40">
                  <label className="text-xs font-bold text-red-400">Motivo da Correção *</label>
                  <textarea value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setErrorMsg(""); }} rows={3} placeholder="Descreva o que está errado no comprovante..." className={`w-full px-3 py-2 text-sm rounded-lg outline-none resize-none bg-gray-800 text-white border ${errorMsg ? "border-red-500" : "border-gray-700"}`} />
                  {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowRejectForm(false); setRejectReason(""); setErrorMsg(""); }} className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={() => handleValidateAction("REJECT")} disabled={loading} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50">
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

          {/* ACCORDION: Receipts History */}
          {receiptsHistory.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-700/50 overflow-hidden">
              <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Histórico de Comprovantes ({receiptsHistory.length})</span>
                </div>
                {historyOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {historyOpen && (
                <div className="p-4 space-y-3 bg-gray-900/30">
                  {receiptsHistory.map((receipt, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${idx === receiptsHistory.length - 1 ? "border-blue-500/30 bg-blue-500/5" : "border-gray-700/30 bg-gray-800/20 opacity-60"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${idx === receiptsHistory.length - 1 ? "bg-blue-500/20 text-blue-400" : "bg-gray-700/50 text-gray-500"}`}>{idx + 1}</div>
                        <div>
                          <a href={receipt.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline">
                            {idx === receiptsHistory.length - 1 ? "Comprovante Atual" : `Comprovante v${idx + 1}`}
                          </a>
                          <p className="text-[10px] text-gray-400">
                            {new Date(receipt.uploadedAt).toLocaleString("pt-BR")}
                            {profilesMap[receipt.uploadedBy] && ` - ${profilesMap[receipt.uploadedBy]}`}
                          </p>
                        </div>
                      </div>
                      {idx === receiptsHistory.length - 1 && (<span className="px-2 py-0.5 text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 rounded">Atual</span>)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300">
              <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold leading-normal">Anexe o comprovante de pagamento acima para habilitar o avanço de etapa.</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            {/* LADO ESQUERDO: Botões de Comunicação / Envio */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
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
                className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/60 transition-all shadow-sm cursor-pointer"
                title="Conversar sobre esta solicitação no chat"
              >
                <MessageSquare size={15} />
                <span>Enviar no Chat</span>
              </button>

              {/* Notificar Pagamento Realizado para Tassio (Nubank) */}
              {isMasterOrFinanceiro && card.status !== "RECUSADO" && (card.status !== "NOVA_SOLICITACAO" || hasAttachment) && (
                <button
                  type="button"
                  onClick={() => {
                    setEmailModalType("PAID_NUBANK");
                    setIsEmailModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-purple-600/15 hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-500/40 hover:border-purple-500/60 transition-all shadow-sm cursor-pointer"
                  title="Notificar Tássio por e-mail que o pagamento já foi realizado (Nubank)"
                >
                  <CheckCircle2 size={15} />
                  <span>E-mail: Pagamento Realizado (Nubank)</span>
                </button>
              )}

              {/* Solicitar via E-mail para Tassio (Liberado a partir de Pendente / EM_APROVACAO em diante, nunca em NOVA_SOLICITACAO) */}
              {isPix && isMasterOrFinanceiro && card.status !== "NOVA_SOLICITACAO" && card.status !== "RECUSADO" && card.status !== "FINALIZADO" && (
                <button
                  type="button"
                  onClick={() => {
                    setEmailModalType("REQUEST");
                    setIsEmailModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-blue-600/15 hover:bg-blue-600/25 text-blue-700 dark:text-blue-300 border border-blue-500/40 hover:border-blue-500/60 transition-all shadow-sm cursor-pointer"
                  title="Enviar solicitação de pagamento por e-mail para Tassio"
                >
                  <Mail size={15} />
                  <span>Solicitar Pgto (Tássio)</span>
                </button>
              )}
            </div>

            {/* LADO DIREITO: Ações de Decisão e Avanço */}
            <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto flex-wrap">
              {/* Mover para Lixeira */}
              {canTrash && (
                <button
                  type="button"
                  onClick={handleTrash}
                  disabled={loading}
                  className="p-2.5 rounded-xl border transition-all hover:bg-red-500/10 hover:border-red-500/40 cursor-pointer disabled:opacity-50"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-muted)" }}
                  title="Mover para Lixeira"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {/* Recusar / Cancelar */}
              {canRefuse && !showRefuseForm && !isValidacaoGestor && !isCorrecaoPendente && (
                <button
                  type="button"
                  onClick={() => setShowRefuseForm(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl text-red-600 dark:text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Ban size={14} />
                  <span>{userRole === "GESTOR" ? "Solicitar Cancelamento" : "Recusar"}</span>
                </button>
              )}

              {((canTrash || canRefuse) && !showRefuseForm && canAdvance) && (
                <div className="hidden sm:block w-px h-6 mx-1" style={{ backgroundColor: "var(--surface-border)" }} />
              )}

              {/* Botões quando Em Aprovação ou Correção Pendente */}
              {(isEmAprovacao || isCorrecaoPendente) && isMasterOrFinanceiro && !showRefuseForm && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAdvance("VALIDACAO_GESTOR")}
                    disabled={loading || isTransitionBlocked}
                    className="px-3.5 py-2.5 text-xs font-bold rounded-xl bg-purple-600/15 text-purple-700 dark:text-purple-300 hover:bg-purple-600/25 border border-purple-500/40 hover:border-purple-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Validação do Gestor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdvance("AGUARDANDO_PAGAMENTO")}
                    disabled={loading || isTransitionBlocked}
                    className="px-3.5 py-2.5 text-xs font-bold rounded-xl bg-sky-600/15 text-sky-700 dark:text-sky-300 hover:bg-sky-600/25 border border-sky-500/40 hover:border-sky-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Aguardando Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdvance("FINALIZADO")}
                    disabled={loading || isTransitionBlocked}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 hover:border-emerald-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Finalizar Direto
                  </button>
                </div>
              )}

              {/* Botões quando Validado pelo Gestor */}
              {isValidadoGestor && isMasterOrFinanceiro && !showRefuseForm && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAdvance("AGUARDANDO_PAGAMENTO")}
                    disabled={loading}
                    className="px-3.5 py-2.5 text-xs font-bold rounded-xl bg-sky-600/15 text-sky-700 dark:text-sky-300 hover:bg-sky-600/25 border border-sky-500/40 hover:border-sky-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Aguardando Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdvance("FINALIZADO")}
                    disabled={loading}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 hover:border-emerald-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                  >
                    Finalizar Direto
                  </button>
                </div>
              )}

              {/* Botão dedicado para Aguardando Nota (vai DIRETO para Finalizado) */}
              {(card.status === "AGUARDANDO_PAGAMENTO" || (card.status as string) === "AGUARDANDO_NOTINHA") && isMasterOrFinanceiro && !showRefuseForm && (
                <button
                  type="button"
                  onClick={() => handleAdvance("FINALIZADO")}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
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
                <button
                  type="button"
                  onClick={() => handleAdvance()}
                  disabled={loading || isTransitionBlocked}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <span>{isNovaSolicitacao ? "Aprovar Solicitação" : "Avançar Status"}</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
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
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    emailModalType === "PAID_NUBANK"
                      ? "bg-purple-600/20 border-purple-500/40 text-purple-400"
                      : "bg-blue-500/15 border-blue-500/30 text-blue-400"
                  }`}
                >
                  {emailModalType === "PAID_NUBANK" ? <CheckCircle2 size={20} /> : <Mail size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {emailModalType === "PAID_NUBANK" ? "Pagamento Realizado (Nubank)" : "Solicitar Pagamento a Tássio"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Destinatário: <span className="text-blue-400 font-semibold">tassiolimacs@gmail.com</span>
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

            {/* Alternador de Modelo (Tabs) */}
            <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-5 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setEmailModalType("PAID_NUBANK")}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  emailModalType === "PAID_NUBANK"
                    ? "border-purple-500 text-purple-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <CheckCircle2 size={14} />
                <span>Pagamento Realizado (Nubank)</span>
              </button>

              <button
                type="button"
                onClick={() => setEmailModalType("REQUEST")}
                className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  emailModalType === "REQUEST"
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Mail size={14} />
                <span>Solicitar Pgto (Tássio)</span>
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-4">
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
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20 cursor-pointer"
                    title="Abre a tela de envio do Gmail diretamente no navegador com tudo preenchido"
                  >
                    <ExternalLink size={14} />
                    <span>Abrir no Gmail Web</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenDefaultMail}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
                    title="Abre no Outlook ou aplicativo de e-mail padrão do computador"
                  >
                    <Mail size={14} />
                    <span>Abrir no Outlook / App</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopyEmailText}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    emailCopied
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200"
                  }`}
                >
                  {emailCopied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
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
    </div>
  );
}



