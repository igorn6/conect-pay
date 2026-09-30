"use client";
import { useState, useRef } from "react";
import {
  X, ArrowRight, Loader2, CreditCard, Calendar, User, AlignLeft, Tag,
  Ban, Trash2, Mail, UploadCloud, CheckCircle2, Copy, FileText, Building2,
  ShieldCheck, ShieldAlert, Zap, ChevronDown, ChevronUp, History, AlertTriangle, MessageSquare
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import type { PaymentRequest, ReceiptHistoryItem } from "@/types/database";

const NEXT_STATUS: Record<string, string> = {
  NOVA_SOLICITACAO: "EM_APROVACAO",
  EM_APROVACAO: "AGUARDANDO_PAGAMENTO",
  AGUARDANDO_PAGAMENTO: "VALIDACAO_GESTOR",
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

  // ========== HANDLERS ==========

  async function handleAdvance(targetStatus?: string) {
    if (!isMasterOrFinanceiro) return;
    const newStatus = targetStatus || NEXT_STATUS[card.status];
    if (!newStatus) return;
    if (isTransitionBlocked) return;
    setLoading(true);
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: newStatus, payment_proof_url: paymentProofUrl, invoice_url: invoiceUrl })
      .eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao avanÃ§ar solicitacao."); return; }
    onUpdate(`Solicitacao avancou para ${newStatus.replace(/_/g, " ")}`);
  }

  async function handleRefuse() {
    if (!refusalReason.trim()) { setErrorMsg("O motivo e obrigatorio."); return; }
    setLoading(true);
    const prefix = userRole === "GESTOR" ? "Cancelado pelo Gestor" : "Recusado pelo Financeiro";
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: "RECUSADO", refusal_reason: `${prefix}: ${refusalReason.trim()}`, payment_proof_url: paymentProofUrl, invoice_url: invoiceUrl })
      .eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao recusar solicitacao."); return; }
    onUpdate("Solicitacao enviada para Recusados.");
  }

  async function handleTrash() {
    if (!window.confirm("Deseja realmente mover este card para a Lixeira?")) return;
    setLoading(true);
    const { error } = await supabase.from("payment_requests").update({ is_deleted: true }).eq("id", card.id);
    setLoading(false);
    if (error) { alert("Erro ao excluir card."); return; }
    onUpdate("Card movido para a Lixeira.");
  }

  async function handleSendEmail() {
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? "Bom dia" : "Boa tarde";
    const cnpjDisplay = localCnpj || card.cnpj || "Sem CNPJ";
    const subject = encodeURIComponent(`Pagamento Ref. ${card.title} | ${cnpjDisplay}`);
    const formattedAmount = Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const body = encodeURIComponent(
      `--\n${greeting}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: ${card.title}\nValor: R$ ${formattedAmount}\nChave pix / Linha digitavel: ${card.pix_key || ""}\nTitular: ${card.pix_owner || ""}`
    );
    window.open(`mailto:tassiolimacs@gmail.com?subject=${subject}&body=${body}`, '_blank');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh] shadow-2xl relative"
        style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--surface-border)" }}
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Detalhes da Solicitacao</h2>
            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md" style={{ backgroundColor: "var(--brand-primary)", color: "var(--bg-primary)" }}>
              #{card.id.substring(0, 6)}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">

          {/* ALERT: CORRECAO PENDENTE */}
          {isCorrecaoPendente && card.rejection_reason && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/40">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1">Correcao Exigida pelo Gestor</p>
                  <p className="text-sm text-red-300 leading-relaxed">{card.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-2xl font-black text-white leading-tight mb-1">{card.title}</h3>
                <p className="text-4xl font-black text-emerald-400 tracking-tighter">
                  R$ {Number(card.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                  <Tag size={16} className="text-gray-400" />
                  <span className="font-semibold">{card.category}</span>
                </div>
                {card.payment_type === "Pix" && isMasterOrFinanceiro && (
                  <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                    <Building2 size={16} className="text-gray-400" />
                    <div className="flex flex-col w-full">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">CNPJ de Faturamento</span>
                      <select value={localCnpj} onChange={(e) => handleCnpjChange(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-md px-2 py-1 text-sm text-white outline-none focus:border-brand-primary">
                        <option value="">Selecione um CNPJ...</option>
                        {CNPJ_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                      </select>
                    </div>
                  </div>
                )}
                {card.payment_type === "Pix" && !isMasterOrFinanceiro && localCnpj && (
                  <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                    <Building2 size={16} className="text-gray-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">CNPJ de Faturamento</span>
                      <span className="font-semibold">{localCnpj}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                  <User size={16} className="text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Solicitante Real</span>
                    <span className="font-semibold">{requesterName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                  <Calendar size={16} className="text-gray-400" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Data do Pedido</span>
                    <span className="font-semibold">{new Date(card.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                {card.notes && (
                  <div className="flex flex-col gap-2 text-sm text-gray-300 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">ObservaÃ§Ãµes / DescriÃ§Ã£o</span>
                    <span className="font-medium whitespace-pre-wrap">{card.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="flex flex-col gap-4">
              {/* Payment Data */}
              <div className="p-5 rounded-2xl bg-gray-800/80 border border-gray-700 shadow-inner">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className="text-blue-400" />
                  <h4 className="font-bold text-white text-sm uppercase tracking-wider">Dados de Pagamento</h4>
                </div>
                <div className="space-y-4">
                  {(card.splits && card.splits.length > 0 ? card.splits : [{
                    id: "legacy", payment_type: card.payment_type || card.payment_method,
                    amount: card.amount, pix_owner: card.pix_owner || card.pix_name,
                    pix_key: card.pix_key, caju_phone: card.caju_phone
                  }]).map((split: any, idx: number) => (
                    <div key={split.id || idx} className="p-3 rounded-lg border relative" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/20">{split.payment_type}</span>
                        <span className="text-xs font-bold text-emerald-400">R$ {Number(split.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      {split.payment_type === "Pix" && (
                        <div className="space-y-2 mt-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-secondary)" }}>Chave Pix</span>
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border group" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                              <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{split.pix_key}</span>
                              <button onClick={async () => { if (split.pix_key) { await navigator.clipboard.writeText(split.pix_key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); } }} className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--text-secondary)" }} title="Copiar Chave Pix">
                                {copiedKey ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-secondary)" }}>Titular</span>
                            <span className="text-xs font-semibold block truncate" style={{ color: "var(--text-primary)" }}>{split.pix_owner}</span>
                          </div>
                        </div>
                      )}
                      {split.payment_type === "Caju" && (
                        <div className="mt-2">
                          <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-secondary)" }}>Titular</span>
                          <span className="text-xs font-semibold block truncate" style={{ color: "var(--text-primary)" }}>{split.caju_phone}</span>
                        </div>
                      )}
                      {split.payment_type === "Boleto" && (
                        <div className="space-y-2 mt-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-secondary)" }}>Linha DigitÃ¡vel</span>
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border group" style={{ backgroundColor: "var(--surface-hover)", borderColor: "var(--surface-border)" }}>
                              <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{split.boleto_barcode || "-"}</span>
                              <button onClick={async () => { if (split.boleto_barcode) { await navigator.clipboard.writeText(split.boleto_barcode); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); } }} className="p-1 rounded transition-colors shrink-0" style={{ color: "var(--text-secondary)" }} title="Copiar Linha DigitÃ¡vel">
                                {copiedKey ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: "var(--text-secondary)" }}>Data de Vencimento</span>
                            <span className="text-xs font-semibold block truncate" style={{ color: "var(--text-primary)" }}>{split.boleto_due_date ? new Date(split.boleto_due_date + "T12:00:00Z").toLocaleDateString("pt-BR") : "-"}</span>
                          </div>
                          
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notinha */}
              <div className={`p-4 rounded-xl border ${isValidacaoGestor && !invoiceUrl ? "border-amber-500/50 bg-amber-500/10" : "border-gray-700/50 bg-gray-800/30"} flex flex-col gap-2`}>
                <div className="flex items-center gap-3 text-gray-300">
                  <FileText size={20} className={invoiceUrl ? "text-blue-400" : "text-amber-400"} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Notinha ou Nota Fiscal</p>
                    <p className="text-[10px] text-gray-500">Comprovante de compra/gasto real</p>
                  </div>
                </div>
                {isUploadingInvoice ? (
                  <div className="flex items-center justify-center gap-2 py-3 text-blue-400">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs font-semibold">Enviando nota...</span>
                  </div>
                ) : invoiceUrl ? (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-700/50">
                    <div className="flex flex-wrap gap-2">
                      {invoiceUrl.split(',').map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors flex items-center gap-1">
                          Nota {i + 1}
                        </a>
                      ))}
                    </div>
                    <button onClick={() => invoiceInputRef.current?.click()} className="text-[10px] text-gray-400 hover:text-white underline self-start">+ Adicionar Mais</button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <button onClick={() => invoiceInputRef.current?.click()} disabled={isUploadingInvoice} className="px-3 py-1.5 text-xs font-medium border border-dashed border-gray-600 rounded text-gray-400 hover:text-white hover:border-gray-400 transition-colors w-full flex items-center justify-center gap-2">+ Anexar Nota / Recibo</button>
                  </div>
                )}
                <input type="file" multiple ref={invoiceInputRef} className="hidden" accept="image/*,.pdf" onChange={handleInvoiceUpload} />
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
            <div className={`mt-6 p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${isUploading ? 'border-blue-500/50 bg-blue-500/5' : hasAttachment ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-700 hover:border-gray-500 bg-gray-800/30 hover:bg-gray-800/50'}`}>
              {isUploading ? (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="animate-spin" size={32} />
                  <span className="text-sm font-medium">Enviando anexo...</span>
                </div>
              ) : paymentProofUrl ? (
                <div className="flex flex-col items-center gap-2 text-emerald-400 w-full">
                  <CheckCircle2 size={32} />
                  <span className="text-sm font-bold">Comprovante(s) Anexado(s)</span>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {paymentProofUrl.split(',').map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs underline text-blue-400 hover:text-blue-300">Visualizar {i + 1}</a>
                    ))}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs mt-2 text-gray-400 hover:text-white underline">+ Adicionar Mais Comprovantes</button>
                </div>
              ) : (
                <>
                  <UploadCloud size={36} className="text-gray-500" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-300">Comprovante(s) de Pagamento</p>
                    <p className="text-xs text-gray-500 mt-1">Apenas para Master/Financeiro. Anexe as imagens ou PDFs.<br /><span className="text-red-400 font-medium">*Obrigatorio para avanÃ§ar</span></p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="mt-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors">Selecionar Arquivos</button>
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
                    <p className="text-[11px] text-gray-500 mt-1">O Gestor exigiu uma correcao. Anexe o novo comprovante para reenviar a validacao.</p>
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
                <h4 className="font-bold text-white text-sm uppercase tracking-wider">Validacao do Pagamento</h4>
              </div>

              {latestReceipt && (
                <div className="mb-4 p-3 rounded-lg bg-gray-800/60 border border-gray-700/50">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Ultimo Comprovante</span>
                  <a href={latestReceipt.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-400 hover:text-blue-300 underline">Visualizar Comprovante</a>
                  <p className="text-[10px] text-gray-500 mt-1">
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
                    Exigir Correcao
                  </button>
                </div>
              )}

              {isOwner && showRejectForm && (
                <div className="flex flex-col gap-3 mt-2 p-4 rounded-xl bg-gray-900 border border-red-500/40">
                  <label className="text-xs font-bold text-red-400">Motivo da Correcao *</label>
                  <textarea value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setErrorMsg(""); }} rows={3} placeholder="Descreva o que esta errado nÃ£o comprovante..." className={`w-full px-3 py-2 text-sm rounded-lg outline-none resize-none bg-gray-800 text-white border ${errorMsg ? "border-red-500" : "border-gray-700"}`} />
                  {errorMsg && <span className="text-xs text-red-500">{errorMsg}</span>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowRejectForm(false); setRejectReason(""); setErrorMsg(""); }} className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-400 hover:text-white transition-colors">Cancelar</button>
                    <button onClick={() => handleValidateAction("REJECT")} disabled={loading} className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50">
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      Enviar para Correcao
                    </button>
                  </div>
                </div>
              )}

              {userRole === "MASTER" && (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <button onClick={() => handleValidateAction("FORCE_APPROVE")} disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all disabled:opacity-50">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={16} />}
                    Forcar Aprovacao (Admin)
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
                Forcar Aprovacao (Admin Override)
              </button>
            </div>
          )}

          {/* ACCORDION: Receipts History */}
          {receiptsHistory.length > 0 && (
            <div className="mt-6 rounded-xl border border-gray-700/50 overflow-hidden">
              <button onClick={() => setHistoryOpen(!historyOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800/80 transition-colors">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-gray-400" />
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">HistÃ³rico de Comprovantes ({receiptsHistory.length})</span>
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
                          <p className="text-[10px] text-gray-500">
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
            <div className="mt-2 p-4 rounded-xl flex flex-col gap-3 bg-gray-900 border border-red-500/50">
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
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-6 py-5 shrink-0" style={{ borderTop: "1px solid var(--surface-border)", backgroundColor: "rgba(0,0,0,0.2)" }}>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Enviar no Chat */}
            <div className="relative group">
              <button
                onClick={() => {
                  setPendingCard({
                    requestId: card.id,
                    title: card.title,
                    amount: card.amount,
                    status: card.status,
                  });
                  setIsChatOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/20 hover:border-emerald-500/40 shadow-sm cursor-pointer"
              >
                <MessageSquare size={16} />
                Enviar no Chat
              </button>
            </div>
            {isEmAprovacao && card.payment_type === "Pix" && isMasterOrFinanceiro && (
              <button onClick={handleSendEmail} className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all border border-gray-700 shadow-sm">
                <Mail size={16} />
                Solicitar via E-mail
              </button>
            )}
            {isTransitionBlocked && isMasterOrFinanceiro && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <Ban size={14} />
                <span className="text-xs font-semibold">Anexe o comprovante de Pgto para avanÃ§ar</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 w-full lg:w-auto flex-wrap">
            <div className="flex items-center gap-2">
              {canTrash && (
                <button onClick={handleTrash} disabled={loading} className="flex items-center justify-center p-2.5 rounded-xl bg-gray-800/50 text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-gray-700/50 hover:border-red-500/30 transition-all disabled:opacity-50" title="Mover para Lixeira">
                  <Trash2 size={18} />
                </button>
              )}
              {canRefuse && !showRefuseForm && !isValidacaoGestor && !isCorrecaoPendente && (
                <button onClick={() => setShowRefuseForm(true)} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-gray-800/50 text-gray-300 hover:text-red-400 hover:bg-red-500/10 border border-gray-700/50 hover:border-red-500/30 transition-all disabled:opacity-50">
                  <Ban size={16} />
                  {userRole === "GESTOR" ? "Solicitar Cancelamento" : "Recusar"}
                </button>
              )}
            </div>

            {((canTrash || canRefuse) && !showRefuseForm && canAdvance) && (
              <div className="hidden sm:block w-px h-8 bg-gray-700/50 mx-1" />
            )}

            {(isEmAprovacao || isCorrecaoPendente) && isMasterOrFinanceiro && !showRefuseForm && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleAdvance("VALIDACAO_GESTOR")} disabled={loading || isTransitionBlocked} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  ValidaÃ§Ã£o do Gestor
                </button>
                <button onClick={() => handleAdvance("AGUARDANDO_PAGAMENTO")} disabled={loading || isTransitionBlocked} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  Aguardando Nota
                </button>
                <button onClick={() => handleAdvance("FINALIZADO")} disabled={loading || isTransitionBlocked} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  Finalizar Direto
                </button>
              </div>
            )}

            {isValidadoGestor && isMasterOrFinanceiro && !showRefuseForm && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleAdvance("AGUARDANDO_PAGAMENTO")} disabled={loading} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                  Aguardando Nota
                </button>
                <button onClick={() => handleAdvance("FINALIZADO")} disabled={loading} className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  Finalizar Direto
                </button>
              </div>
            )}

            {!isEmAprovacao && !isValidacaoGestor && !isCorrecaoPendente && !isValidadoGestor && !isFinalizado && canAdvance && !showRefuseForm && (
              <button onClick={() => handleAdvance()} disabled={loading || isTransitionBlocked} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl bg-brand-primary hover:bg-brand-primary/90 border border-brand-primary/50 shadow-[0_4px_12px_var(--brand-glow)] transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: "var(--brand-primary)" }}>
                {loading ? (<Loader2 size={18} className="animate-spin" />) : (<>{isNovaSolicitacao ? "Aprovar SolicitaÃ§Ã£o" : "AvanÃ§ar Status"}<ArrowRight size={18} /></>)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


