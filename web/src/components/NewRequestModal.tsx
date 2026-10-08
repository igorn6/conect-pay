"use client";

import { useState, useRef, type FormEvent } from "react";
import { X, Loader2, UploadCloud, CheckCircle2, Plus, Trash2, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PAYMENT_TYPES } from "@/constants/requesters";
import { useProfilesMap } from "@/hooks/useProfilesMap";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { sendPushNotification } from "@/lib/pushNotifications";
import type { AiCategorySuggestion } from "@/types/database";

interface NewRequestModalProps {
  onClose: () => void;
  onSave: () => void;
}

interface FormErrors {
  title?: string;
  notes?: string;
  amount?: string;
  category?: string;
  splits?: string;
}

export default function NewRequestModal({ onClose, onSave }: NewRequestModalProps) {
  const { categories, isLoading: isLoadingCategories } = useCategories();
  const { profilesList } = useProfilesMap();
  const { userRole, userId } = useAuth();
  
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [requesterId, setRequesterId] = useState("");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  
  const [splits, setSplits] = useState<any[]>([
    { id: uuidv4(), payment_type: "", amount: "", pix_owner: "", pix_key: "", caju_phone: "", boleto_barcode: "", boleto_due_date: "", boleto_notes: "" }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // IA Categorization states
  const [isAiCategorizing, setIsAiCategorizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiCategorySuggestion | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const handleAutoCategorize = async (silent = false) => {
    if (!title.trim() && !notes.trim()) {
      if (!silent) alert("Preencha o título ou as observações para a IA sugerir a categoria.");
      return;
    }

    try {
      setIsAiCategorizing(true);
      setAiFeedback(null);

      const parsedAmount = parseFloat(String(amount).replace(/[\R$\s.]/g, "").replace(",", ".")) || null;

      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          amount: parsedAmount,
          saveSuggestion: false,
        }),
      });

      if (!res.ok) throw new Error("Falha na comunicação com a IA");
      const data: AiCategorySuggestion = await res.json();
      setAiSuggestion(data);

      if (data.is_new_category_suggested && data.suggested_category_name) {
        setCategory(data.suggested_category_name);
        setAiFeedback(`💡 Nova categoria sugerida: "${data.suggested_category_name}". Ficará pendente de validação do Master.`);
      } else if (data.category) {
        setCategory(data.category);
        setAiFeedback(`✨ Categoria selecionada: ${data.category} (${Math.round((data.confidence || 0.9) * 100)}% de precisão)`);
      }
    } catch (e) {
      console.error("Erro na categorização com IA:", e);
      if (!silent) alert("Não foi possível conectar com a IA no momento.");
    } finally {
      setIsAiCategorizing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSelectRequester = userRole === "FINANCEIRO" || userRole === "MASTER";

  const addSplit = () => {
    setSplits([...splits, { id: uuidv4(), payment_type: "", amount: "", pix_owner: "", pix_key: "", caju_phone: "", boleto_barcode: "", boleto_due_date: "", boleto_notes: "" }]);
    if (errors.splits) setErrors(prev => ({ ...prev, splits: undefined }));
  };

  const removeSplit = (id: string) => {
    if (splits.length > 1) {
      setSplits(splits.filter(s => s.id !== id));
      if (errors.splits) setErrors(prev => ({ ...prev, splits: undefined }));
    }
  };

  const updateSplit = (id: string, field: string, value: string) => {
    setSplits(splits.map(s => s.id === id ? { ...s, [field]: value } : s));
    if (errors.splits) setErrors(prev => ({ ...prev, splits: undefined }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length > 0) {
      setInvoiceFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeInvoiceFile = (indexToRemove: number) => {
    setInvoiceFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAllInvoiceFiles = () => {
    setInvoiceFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: FormErrors = {};

    if (!title.trim()) newErrors.title = "Campo obrigatorio";
    if (!amount.trim()) newErrors.amount = "Campo obrigatorio";
    if (!category) newErrors.category = "Campo obrigatorio";
    if (!notes.trim()) newErrors.notes = "Campo obrigatorio";

    const totalAmount = parseFloat(amount.replace(/[\R$\s.]/g, "").replace(",", "."));
    
    let splitsTotal = 0;
    let hasSplitErrors = false;

    splits.forEach(s => {
      if (!s.payment_type) hasSplitErrors = true;
      if (s.payment_type === "Pix" && (!s.pix_owner || !s.pix_key)) hasSplitErrors = true;
      if (s.payment_type === "Caju" && !s.caju_phone) hasSplitErrors = true;
      
      const val = parseFloat(String(s.amount).replace(/[\R$\s.]/g, "").replace(",", ".")) || 0;
      if (val <= 0) hasSplitErrors = true;
      splitsTotal += val;
    });

    if (hasSplitErrors) {
      newErrors.splits = "Preencha todos os campos das formas de pagamento corretamente.";
    } else if (Math.round(splitsTotal * 100) !== Math.round(totalAmount * 100)) {
      newErrors.splits = `A soma das divisoes (R$ ${splitsTotal.toFixed(2).replace(".", ",")}) deve ser igual ao valor total (R$ ${totalAmount.toFixed(2).replace(".", ",")}).`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      let fileUrl = null;
      if (invoiceFiles && invoiceFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (const file of invoiceFiles) {
          const fileExt = file.name.split('.').pop() || 'png';
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `invoices/${fileName}`;
          let { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
          if (uploadError) {
            const { error: fallbackError } = await supabase.storage.from('attachments').upload(`receipts/${fileName}`, file);
            if (fallbackError) {
              console.error("Erro ao subir comprovante:", uploadError, fallbackError);
              throw uploadError;
            }
            const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(`receipts/${fileName}`);
            uploadedUrls.push(urlData.publicUrl);
          } else {
            const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
            uploadedUrls.push(publicUrl);
          }
        }
        fileUrl = uploadedUrls.join(',');
      }

      // First split determines the main payment type for legacy compatibility
      const mainSplit = splits[0];
      
      // Calculate due date (3 business days from now)
      const d = new Date();
      let added = 0;
      while (added < 3) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }

      const { error } = await supabase.from("payment_requests").insert([{
        title,
        notes,
        amount: totalAmount,
        category: category,
        payment_method: mainSplit.payment_type === "Pix" ? "PIX" : mainSplit.payment_type === "Caju" ? "CAJU" : "RETIRADA_DE_SALDO",
        payment_type: mainSplit.payment_type === "Pix" ? "PIX" : mainSplit.payment_type === "Caju" ? "CAJU" : "RETIRADA_DE_SALDO",
        pix_name: mainSplit.pix_owner || null,
        pix_key: mainSplit.pix_key || null,
        caju_phone: mainSplit.caju_phone || null,
        status: "NOVA_SOLICITACAO",
        stage_history: [
          {
            stage: "NOVA_SOLICITACAO",
            entered_at: new Date().toISOString(),
            left_at: null,
            duration_seconds: null,
            moved_by: userId,
          }
        ],
        created_by: userId,
        real_requester_id: requesterId || userId,
        invoice_url: fileUrl,
        ai_category_suggestion: aiSuggestion,
        due_date: d.toISOString(),
        splits: splits.map(s => ({
          id: s.id,
          payment_type: s.payment_type,
          amount: parseFloat(String(s.amount).replace(/[\R$\s.]/g, "").replace(",", ".")),
          pix_owner: s.pix_owner,
          pix_key: s.pix_key,
          caju_phone: s.caju_phone,
          boleto_barcode: s.boleto_barcode,
          boleto_due_date: s.boleto_due_date,
          boleto_notes: s.boleto_notes
        }))
      }]);

      if (error) throw error;

      // Se a IA sugeriu uma nova categoria, registrar para o Master aprovar
      if (aiSuggestion?.is_new_category_suggested && aiSuggestion.suggested_category_name) {
        fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            notes,
            amount: totalAmount,
            saveSuggestion: true,
          }),
        }).catch((e) => console.warn("Falha ao salvar sugestão de categoria:", e));
      }

      // Disparar Web Push nativo em segundo plano para MASTER e FINANCEIRO
      sendPushNotification({
        title: "Nova Solicitação de Pagamento!",
        body: `${title} - R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        url: "/kanban",
        targetRoles: ["MASTER", "FINANCEIRO"],
        excludeUserId: userId || undefined,
      }).catch((e) => console.warn("Falha no envio de push em background:", e));

      onSave();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao criar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatBRL = (val: string) => {
    let num = val.replace(/\D/g, "");
    if (!num) return "";
    num = (Number(num) / 100).toFixed(2);
    return num.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const inputStyle = {
    backgroundColor: "var(--bg-primary)",
    border: "1px solid var(--surface-border)",
    color: "var(--text-primary)",
  };
  const labelStyle = { color: "var(--text-secondary)" };
  const labelClass = "block text-xs font-semibold mb-1 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-[#1e2128] sm:rounded-l-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300" style={{ backgroundColor: "var(--bg-secondary)" }}>
        
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Nova Solicitacao
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-800 transition-colors group"
          >
            <X size={20} className="text-gray-400 group-hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          
          <div className="space-y-4">
            <div>
              <label className={labelClass} style={labelStyle}>
                Titulo / Descricao Curta *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                onBlur={() => {
                  if (title.trim().length >= 4 && !category && !isAiCategorizing) {
                    handleAutoCategorize(true);
                  }
                }}
                placeholder="Ex: Pagamento de fornecedor"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                style={{ ...inputStyle, borderColor: errors.title ? "#ef4444" : "var(--surface-border)" }}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>
                  Valor Total (R$) *
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => {
                    setAmount(formatBRL(e.target.value));
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                    if (errors.splits) setErrors((prev) => ({ ...prev, splits: undefined }));
                  }}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                  style={{ ...inputStyle, borderColor: errors.amount ? "#ef4444" : "var(--surface-border)" }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>
                    Categoria *
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAutoCategorize(false)}
                    disabled={isAiCategorizing || (!title.trim() && !notes.trim())}
                    className="text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Classificar automaticamente com IA Gemini a partir do título e observações"
                  >
                    {isAiCategorizing ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        <span>Analisando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={11} className="text-indigo-400" />
                        <span>Sugerir com IA</span>
                      </>
                    )}
                  </button>
                </div>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (errors.category) setErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none appearance-none"
                  style={{ ...inputStyle, borderColor: errors.category ? "#ef4444" : "var(--surface-border)" }}
                >
                  <option value="">Selecione...</option>
                  {aiSuggestion?.is_new_category_suggested && aiSuggestion.suggested_category_name && !categories.some(c => c.name.toLowerCase() === aiSuggestion.suggested_category_name?.toLowerCase()) && (
                    <option value={aiSuggestion.suggested_category_name}>
                      ✨ [Nova Sugerida] {aiSuggestion.suggested_category_name}
                    </option>
                  )}
                  {!isLoadingCategories && categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>

                {aiFeedback && (
                  <p className="text-[11px] mt-1.5 text-indigo-300/90 leading-tight">
                    {aiFeedback}
                  </p>
                )}
              </div>
            </div>

            {canSelectRequester && (
              <div>
                <label className={labelClass} style={labelStyle}>
                  Solicitante Real
                </label>
                <select
                  value={requesterId}
                  onChange={(e) => setRequesterId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none appearance-none"
                  style={inputStyle}
                >
                  <option value="">(Opcional - Criar em nome de outro)</option>
                  {profilesList.filter(p => p.is_active !== false && p.id !== userId).map((req) => (
                    <option key={req.id} value={req.id}>{req.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl flex flex-col gap-4" style={{ backgroundColor: "var(--surface-hover)", border: "1px solid var(--surface-border)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                Formas de Pagamento
              </h3>
              <button
                type="button"
                onClick={addSplit}
                className="text-xs font-semibold flex items-center gap-1 text-brand-primary hover:opacity-80 transition-opacity"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
            
            {errors.splits && <p className="text-xs font-semibold" style={{ color: "#ef4444" }}>{errors.splits}</p>}

            {splits.map((split, index) => (
              <div key={split.id} className="p-4 rounded-lg border space-y-3 relative" style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)" }}>
                {splits.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeSplit(split.id)}
                    className="absolute top-3 right-3 text-red-500 hover:text-red-400 p-1 bg-red-500/10 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                
                <div className="grid grid-cols-2 gap-3 pr-8">
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Tipo</label>
                    <select
                      value={split.payment_type}
                      onChange={(e) => updateSplit(split.id, 'payment_type', e.target.value)}
                      className="w-full px-3 py-2 rounded text-xs outline-none"
                      style={inputStyle}
                    >
                      <option value="">Selecione...</option>
                      {PAYMENT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Valor (R$)</label>
                    <input
                      type="text"
                      value={split.amount}
                      onChange={(e) => updateSplit(split.id, 'amount', formatBRL(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-3 py-2 rounded text-xs outline-none"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {split.payment_type === "Pix" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Titular</label>
                      <input
                        type="text"
                        value={split.pix_owner}
                        onChange={(e) => updateSplit(split.id, 'pix_owner', e.target.value)}
                        className="w-full px-3 py-2 rounded text-xs outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Chave Pix</label>
                      <input
                        type="text"
                        value={split.pix_key}
                        onChange={(e) => updateSplit(split.id, 'pix_key', e.target.value)}
                        className="w-full px-3 py-2 rounded text-xs outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}
                
                {split.payment_type === "Caju" && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Titular</label>
                    <input
                      type="text"
                      value={split.caju_phone || ""}
                      onChange={(e) => updateSplit(split.id, 'caju_phone', e.target.value)}
                      className="w-full px-3 py-2 rounded text-xs outline-none"
                      style={inputStyle}
                    />
                  </div>
                )}

                {split.payment_type === "Boleto" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Linha Digitável</label>
                      <input
                        type="text"
                        value={split.boleto_barcode || ""}
                        onChange={(e) => updateSplit(split.id, 'boleto_barcode', e.target.value)}
                        className="w-full px-3 py-2 rounded text-xs outline-none"
                        style={inputStyle}
                        placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Data de Vencimento</label>
                      <input
                        type="date"
                        value={split.boleto_due_date || ""}
                        onChange={(e) => updateSplit(split.id, 'boleto_due_date', e.target.value)}
                        className="w-full px-3 py-2 rounded text-xs outline-none"
                        style={inputStyle}
                      />
                    </div>
                    
                  </div>
                )}

              </div>
            ))}
          </div>

          <div className="mt-2">
            <label className={labelClass} style={labelStyle}>
              Observações *
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (errors.notes) setErrors((prev) => ({ ...prev, notes: undefined }));
              }}
              onBlur={() => {
                if (title.trim().length >= 3 && !category && !isAiCategorizing) {
                  handleAutoCategorize(true);
                }
              }}
              rows={3}
              placeholder="Detalhes, justificativas, centro de custo..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ ...inputStyle, borderColor: errors.notes ? "#ef4444" : "var(--surface-border)" }}
            />
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>
                Notinha ou Nota Fiscal (Opcional)
              </label>
              {invoiceFiles.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllInvoiceFiles}
                  className="text-[11px] text-red-400/80 hover:text-red-400 hover:underline transition-colors cursor-pointer"
                >
                  Remover todos
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,.pdf"
              onClick={(e) => {
                (e.target as HTMLInputElement).value = "";
              }}
              onChange={handleFileChange}
            />

            {invoiceFiles.length === 0 ? (
              <div 
                className="p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-white/[0.02]"
                style={{ borderColor: "var(--surface-border)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={24} className="mb-2" style={{ color: "var(--text-secondary)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Anexar Notinha ou Nota Fiscal</span>
                <span className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>Imagens ou PDF (Clique para selecionar)</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                  {invoiceFiles.map((file, idx) => {
                    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
                    return (
                      <div
                        key={`${file.name}-${file.size}-${idx}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors group"
                        style={{
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--surface-border)",
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <div className={`p-1.5 rounded-md shrink-0 ${isPdf ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                            {isPdf ? <FileText size={15} /> : <ImageIcon size={15} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p 
                              className="font-medium truncate leading-tight" 
                              style={{ color: "var(--text-primary)" }}
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeInvoiceFile(idx);
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                          title="Excluir comprovante"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-lg border border-dashed text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer hover:bg-white/[0.02]"
                  style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
                >
                  <Plus size={14} />
                  <span>Adicionar outro comprovante</span>
                </button>
              </div>
            )}
          </div>
        </form>

        <div
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--surface-border)", backgroundColor: "var(--bg-secondary)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--bg-primary)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Criar Solicitação"}
          </button>
        </div>
      </div>
    </div>
  );
}
