const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), "src/components/NewRequestModal.tsx");

const newCode = `"use client";

import { useState, useRef, type FormEvent } from "react";
import { X, Loader2, UploadCloud, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PAYMENT_TYPES } from "@/constants/requesters";
import { useProfilesMap } from "@/hooks/useProfilesMap";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";

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
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  
  const [splits, setSplits] = useState<any[]>([
    { id: uuidv4(), payment_type: "", amount: "", pix_owner: "", pix_key: "", caju_phone: "" }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSelectRequester = userRole === "FINANCEIRO" || userRole === "MASTER";

  const addSplit = () => {
    setSplits([...splits, { id: uuidv4(), payment_type: "", amount: "", pix_owner: "", pix_key: "", caju_phone: "" }]);
  };

  const removeSplit = (id: string) => {
    if (splits.length > 1) {
      setSplits(splits.filter(s => s.id !== id));
    }
  };

  const updateSplit = (id: string, field: string, value: string) => {
    setSplits(splits.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setInvoiceFile(e.target.files[0]);
    }
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: FormErrors = {};

    if (!title.trim()) newErrors.title = "Campo obrigatrio";
    if (!amount.trim()) newErrors.amount = "Campo obrigatrio";
    if (!category) newErrors.category = "Campo obrigatrio";
    if (!notes.trim()) newErrors.notes = "Campo obrigatrio";

    const totalAmount = parseFloat(amount.replace(/[\\R$\\s.]/g, "").replace(",", "."));
    
    let splitsTotal = 0;
    let hasSplitErrors = false;

    splits.forEach(s => {
      if (!s.payment_type) hasSplitErrors = true;
      if (s.payment_type === "Pix" && (!s.pix_owner || !s.pix_key)) hasSplitErrors = true;
      if (s.payment_type === "Caju" && !s.caju_phone) hasSplitErrors = true;
      
      const val = parseFloat(String(s.amount).replace(/[\\R$\\s.]/g, "").replace(",", ".")) || 0;
      if (val <= 0) hasSplitErrors = true;
      splitsTotal += val;
    });

    if (hasSplitErrors) {
      newErrors.splits = "Preencha todos os campos das formas de pagamento corretamente.";
    } else if (Math.abs(splitsTotal - totalAmount) > 0.01) {
      newErrors.splits = \`A soma das divises (R$ \${splitsTotal.toFixed(2)}) deve ser igual ao valor total (R$ \${totalAmount.toFixed(2)}).\`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      let fileUrl = null;
      if (invoiceFile) {
        const fileExt = invoiceFile.name.split('.').pop();
        const fileName = \`\${Math.random()}.\${fileExt}\`;
        const filePath = \`invoices/\${fileName}\`;
        const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, invoiceFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
        fileUrl = publicUrl;
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
        category,
        payment_method: mainSplit.payment_type === "Pix" ? "PIX" : "CAJU",
        payment_type: mainSplit.payment_type === "Pix" ? "PIX" : "CAJU",
        pix_name: mainSplit.pix_owner || null,
        pix_key: mainSplit.pix_key || null,
        caju_phone: mainSplit.caju_phone || null,
        status: "NOVA_SOLICITACAO",
        created_by: userId,
        real_requester_id: requesterId || userId,
        invoice_url: fileUrl,
        due_date: d.toISOString(),
        splits: splits.map(s => ({
          id: s.id,
          payment_type: s.payment_type,
          amount: parseFloat(String(s.amount).replace(/[\\R$\\s.]/g, "").replace(",", ".")),
          pix_owner: s.pix_owner,
          pix_key: s.pix_key,
          caju_phone: s.caju_phone
        }))
      }]);

      if (error) throw error;
      onSave();
    } catch (err: any) {
      console.error(err);
      alert("Erro ao criar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatBRL = (val: string) => {
    let num = val.replace(/\\D/g, "");
    if (!num) return "";
    num = (Number(num) / 100).toFixed(2);
    return num.replace(".", ",").replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
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
            Nova Solicitaǜo
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
                Ttulo / Descriǜo Curta *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
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
                  }}
                  placeholder="0,00"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none"
                  style={{ ...inputStyle, borderColor: errors.amount ? "#ef4444" : "var(--surface-border)" }}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>
                  Categoria *
                </label>
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
                  {!isLoadingCategories && categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
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
              <div key={split.id} className="p-4 bg-[#14151a] rounded-lg border border-gray-800 space-y-3 relative">
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
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo</label>
                    <select
                      value={split.payment_type}
                      onChange={(e) => updateSplit(split.id, 'payment_type', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                    >
                      <option value="">Selecione...</option>
                      {PAYMENT_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                    <input
                      type="text"
                      value={split.amount}
                      onChange={(e) => updateSplit(split.id, 'amount', formatBRL(e.target.value))}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                    />
                  </div>
                </div>

                {split.payment_type === "Pix" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Titular</label>
                      <input
                        type="text"
                        value={split.pix_owner}
                        onChange={(e) => updateSplit(split.id, 'pix_owner', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Chave Pix</label>
                      <input
                        type="text"
                        value={split.pix_key}
                        onChange={(e) => updateSplit(split.id, 'pix_key', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                )}
                
                {split.payment_type === "Caju" && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Telefone (Caju)</label>
                    <input
                      type="text"
                      value={split.caju_phone || ""}
                      onChange={(e) => updateSplit(split.id, 'caju_phone', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-2">
            <label className={labelClass} style={labelStyle}>
              Observaes *
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (errors.notes) setErrors((prev) => ({ ...prev, notes: undefined }));
              }}
              rows={3}
              placeholder="Detalhes, justificativas, centro de custo..."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white outline-none resize-none"
              style={errors.notes ? { borderColor: "#ef4444" } : {}}
            />
          </div>

          <div className="mt-2">
            <label className={labelClass} style={labelStyle}>
              Notinha ou Nota Fiscal (Opcional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,.pdf"
              onChange={handleFileChange}
            />
            <div 
              className={`p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
                invoiceFile 
                  ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                  : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/60'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {invoiceFile ? (
                <div className="flex flex-col items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={24} />
                  <span className="text-xs font-bold">{invoiceFile.name}</span>
                  <span className="text-[10px] text-gray-400 mt-1">Clique para substituir</span>
                </div>
              ) : (
                <>
                  <UploadCloud size={24} className="text-gray-500 mb-2" />
                  <span className="text-xs font-medium text-gray-300">Anexar Notinha ou Nota Fiscal</span>
                  <span className="text-[10px] text-gray-500 mt-0.5">Imagens ou PDF (Mx: 5MB)</span>
                </>
              )}
            </div>
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
            {loading ? <Loader2 size={16} className="animate-spin" /> : "Criar Solicitao"}
          </button>
        </div>
      </div>
    </div>
  );
}
`

fs.writeFileSync(file, newCode);
console.log("NewRequestModal.tsx updated for splits");
