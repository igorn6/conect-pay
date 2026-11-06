"use client";

import { useState, useEffect } from "react";
import { Sparkles, Mail, Copy, Check, AlertCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface CajuRechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CajuRechargeModal({
  isOpen,
  onClose,
  onSuccess,
}: CajuRechargeModalProps) {
  const { userId, userName } = useAuth();

  const [form, setForm] = useState({
    amount: "3.000,00",
    paymentType: "PIX" as const,
    pixKey: "",
    pixOwner: "Caju",
    cnpj: "CNPJ 2",
    notes: "Recarga Caju",
    requesterName: userName || "Igor Nascimento",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    card: any;
    email: { to: string; subject: string; body: string; encodedSubject: string; encodedBody: string };
  } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Sempre limpa a chave Pix e reseta o formulário ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      setForm((prev) => ({
        ...prev,
        amount: "3.000,00",
        paymentType: "PIX",
        pixKey: "",
        pixOwner: "Caju",
        cnpj: "CNPJ 2",
        notes: "Recarga Caju",
        requesterName: userName || prev.requesterName || "Igor Nascimento",
      }));
      setErrorMsg(null);
      setSuccessData(null);
      setCopiedEmail(false);
    }
  }, [isOpen, userName]);

  const handleClose = () => {
    setForm((prev) => ({ ...prev, pixKey: "" }));
    setErrorMsg(null);
    setSuccessData(null);
    setCopiedEmail(false);
    onClose();
  };

  if (!isOpen) return null;

  const parseCurrencyInput = (val: string): number => {
    if (!val) return NaN;
    const clean = val.replace(/[R$\s]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", "."));
    }
    if (clean.includes(",")) {
      return parseFloat(clean.replace(/\s/g, "").replace(",", "."));
    }
    return parseFloat(clean.replace(/\s/g, ""));
  };

  const handleAmountInput = (val: string) => {
    let clean = val.replace(/\D/g, "");
    if (!clean) {
      setForm((prev) => ({ ...prev, amount: "" }));
      return;
    }
    const num = parseInt(clean, 10) / 100;
    const formatted = num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    setForm((prev) => ({ ...prev, amount: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const amountNum = parseCurrencyInput(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setErrorMsg("Informe um valor válido maior que zero.");
      return;
    }

    if (!form.pixKey.trim()) {
      setErrorMsg("Informe a Chave Pix da recarga Caju.");
      return;
    }

    try {
      setSubmitting(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      const res = await fetch("/api/nubank-balance/request-recharge", {
        method: "POST",
        headers,
        body: JSON.stringify({
          request_kind: "RECARGA_CAJU",
          amount: amountNum,
          payment_type: "PIX",
          pix_key: form.pixKey.trim(),
          pix_owner: form.pixOwner.trim() || "Caju",
          cnpj: form.cnpj.trim() || "CNPJ 2",
          notes: form.notes.trim() || "Recarga Caju",
          userId,
          requesterName: form.requesterName.trim() || userName || "Igor Nascimento",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Falha ao solicitar recarga Caju.");
      }

      const data = await res.json();
      setSuccessData(data);
      // Limpa a chave Pix imediatamente após a solicitação para nunca ficar resíduo
      setForm((prev) => ({ ...prev, pixKey: "" }));
      if (onSuccess) onSuccess();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("caju-balance-updated"));
        window.dispatchEvent(new Event("nubank-balance-updated"));
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Bom dia" : "Boa tarde";
  const displayIdentifier = form.pixKey.trim();

  const previewBody = `--\n${greeting}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: ${
    form.notes.trim() || "Recarga Caju"
  }\nValor: R$ ${form.amount || "3.000,00"}\nChave pix: ${displayIdentifier}\nTitular: ${
    form.pixOwner.trim() || "Caju"
  }\nSolicitante: ${form.requesterName.trim() || userName || "Igor Nascimento"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      {/* Modal de Sucesso com E-mail */}
      {successData ? (
        <div
          className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Solicitação de Recarga Caju Lançada no Kanban!
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                O card de R$ {form.amount || "3.000,00"} foi inserido com sucesso em <strong>Nova Solicitação</strong>. Envie o e-mail padronizado para Tássio:
              </p>
            </div>
          </div>

          <div
            className="p-4 rounded-xl border font-mono text-xs whitespace-pre-wrap leading-relaxed select-text"
            style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
          >
            {successData.email.body}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(successData.email.body);
                setCopiedEmail(true);
                setTimeout(() => setCopiedEmail(false), 2000);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all hover:bg-white/5 cursor-pointer"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              {copiedEmail ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedEmail ? "Copiado!" : "Copiar Texto"}</span>
            </button>

            <div className="flex items-center gap-2">
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${successData.email.to}&su=${successData.email.encodedSubject}&body=${successData.email.encodedBody}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Mail size={14} />
                <span>Abrir no Gmail</span>
              </a>

              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Formulário de Configuração Pré-Envio */
        <div
          className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: "var(--surface-border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Solicitar Recarga de Saldo Caju
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Padrão: CNPJ 2 e R$ 3.000,00. Insira a chave Pix abaixo antes de lançar o card no Kanban.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Motivo */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Motivo da Solicitação *
                </label>
                <input
                  type="text"
                  required
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Recarga Caju"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-rose-500 font-medium"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Valor da Recarga (R$) *
                </label>
                <input
                  type="text"
                  required
                  value={form.amount}
                  onChange={(e) => handleAmountInput(e.target.value)}
                  placeholder="3.000,00"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-rose-500 font-bold font-mono text-rose-400"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)" }}
                />
              </div>

              {/* Titular */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Titular / Favorecido *
                </label>
                <input
                  type="text"
                  required
                  value={form.pixOwner}
                  onChange={(e) => setForm((prev) => ({ ...prev, pixOwner: e.target.value }))}
                  placeholder="Caju"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-rose-500 font-medium"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Conta Pagadora / CNPJ */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Conta Pagadora / CNPJ *
                </label>
                <select
                  value={form.cnpj}
                  onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-rose-500 font-medium cursor-pointer"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                >
                  <option value="CNPJ 2" style={{ backgroundColor: "var(--bg-secondary)" }}>CNPJ 2 (Padrão)</option>
                  <option value="CNPJ 1" style={{ backgroundColor: "var(--bg-secondary)" }}>CNPJ 1</option>
                  <option value="Conect Solucoes" style={{ backgroundColor: "var(--bg-secondary)" }}>Conect Soluções</option>
                  <option value="Nubank 02" style={{ backgroundColor: "var(--bg-secondary)" }}>Nubank 02</option>
                </select>
              </div>

              {/* Solicitante */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Solicitante (Identificação no Kanban e E-mail) *
                </label>
                <input
                  type="text"
                  required
                  value={form.requesterName}
                  onChange={(e) => setForm((prev) => ({ ...prev, requesterName: e.target.value }))}
                  placeholder={userName || "Igor Nascimento"}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-rose-500 font-medium"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Chave Pix de Recarga Caju (Exclusivo Pix) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                  Chave Pix de Recarga Caju *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={form.pixKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, pixKey: e.target.value }))}
                  placeholder="Cole a chave Pix de recarga Caju aqui..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono outline-none border focus:border-rose-500 font-medium"
                  style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Pagamento exclusivo via Pix (sem boleto bancário). A chave será limpa automaticamente após cada envio.
                </span>
              </div>
            </div>

            {/* Prévia ao vivo do E-mail Padronizado */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Mail size={13} className="text-rose-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Prévia do E-mail Padronizado para Tássio:
                </span>
              </div>
              <div
                className="p-3.5 rounded-xl border font-mono text-xs whitespace-pre-wrap leading-relaxed select-text"
                style={{ backgroundColor: "var(--bg-primary)", borderColor: "var(--surface-border)", color: "var(--text-primary)" }}
              >
                {previewBody}
              </div>
            </div>

            {/* Botões de Ação do Modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--surface-border)" }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-rose-600 to-pink-700 hover:from-rose-400 hover:to-pink-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Sparkles size={14} className="text-white" />
                <span>{submitting ? "Lançando no Kanban..." : "Lançar no Kanban"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
