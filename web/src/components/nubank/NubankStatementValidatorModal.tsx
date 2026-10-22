"use client";

import { useState } from "react";
import {
  X,
  FileCheck2,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Clipboard,
  Calendar,
  Save,
  RefreshCw,
} from "lucide-react";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import { type FullReconciliationReport } from "@/lib/nubankReconciliation";

interface NubankStatementValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onReconciliationSaved?: () => void;
}

const SAMPLE_CSV = `Data,Valor,Identificador,Descrição
19/10/2026,-290.00,6ad5fd7f-b953-4435-a9ea-846b24703b7c,Transferência enviada pelo Pix - VITORIA DE LIMA SILVA - •••.200.995-•• - CAIXA ECONOMICA FEDERAL (0104) Agência: 947 Conta: 1288000000802044022-2
19/10/2026,-60.00,6ad5fdb5-ca4f-4a16-9217-84143a03373b,Transferência enviada pelo Pix - Wellington de Barros Dias Junior - •••.565.495-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 39142393-0
19/10/2026,-338.78,6ad62924-0db5-43dc-9b3a-db1f3335623c,Transferência enviada pelo Pix - JUDSON ROCHA ARIMATEA - •••.086.817-•• - BCO BRADESCO S.A. (0237) Agência: 3009 Conta: 720001-3
19/10/2026,-150.00,6ad62954-ff4f-418f-affc-e0acbc9cbecf,Transferência enviada pelo Pix - RODRIGO SANTANA SANTOS - •••.809.975-•• - BCO DO BRASIL S.A. (0001) Agência: 60 Conta: 53141-3
19/10/2026,1500.00,6ad62974-2b62-4b0a-8c14-27f27c0e7066,Transferência recebida pelo Pix - LIMA T C G F M E LTDA - 45.983.838/0001-80 - BCO DO BRASIL S.A. (0001) Agência: 7124 Conta: 5882-3`;

export default function NubankStatementValidatorModal({
  isOpen,
  onClose,
  userId,
  onReconciliationSaved,
}: NubankStatementValidatorModalProps) {
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [manualBalance, setManualBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [report, setReport] = useState<FullReconciliationReport | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Estados de confirmação e ajuste de saldo oficial
  const [isConfirmAdjustOpen, setIsConfirmAdjustOpen] = useState(false);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
  const [adjustFeedbackMsg, setAdjustFeedbackMsg] = useState<string | null>(null);
  const [adjustErrorMsg, setAdjustErrorMsg] = useState<string | null>(null);

  const handleConfirmAdjustBalance = async () => {
    if (!report) return;
    setIsAdjustingBalance(true);
    setAdjustErrorMsg(null);
    setAdjustFeedbackMsg(null);

    try {
      const res = await fetch("/api/nubank-balance/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBalance: report.statementBalance,
          reason: `Ajuste oficial de conciliação bancária conforme extrato Nubank (${report.periodStart} a ${report.periodEnd})`,
          userId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao ajustar saldo.");

      setAdjustFeedbackMsg(`Saldo do cofre atualizado com sucesso para ${formatBRL(json.balance)}!`);

      // Atualiza o relatório local para marcar como 100% conciliado
      setReport({
        ...report,
        systemBalance: json.balance,
        balanceDivergence: 0,
        isBalanceDivergent: false,
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("nubank-balance-updated"));
      }

      setTimeout(() => {
        setIsConfirmAdjustOpen(false);
        setAdjustFeedbackMsg(null);
      }, 3000);
    } catch (err: any) {
      setAdjustErrorMsg(err.message || "Erro ao ajustar saldo.");
    } finally {
      setIsAdjustingBalance(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setErrorMsg(null);
      setReport(null);
    }
  };

  const handleValidate = async () => {
    setErrorMsg(null);
    setSaveSuccessMsg(null);
    setLoading(true);

    try {
      let res: Response;

      if (activeTab === "file") {
        if (!selectedFile) {
          throw new Error("Por favor, selecione um arquivo de extrato (.csv ou .pdf).");
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (userId) formData.append("userId", userId);
        if (manualBalance.trim()) formData.append("statementBalance", manualBalance.trim());

        res = await fetch("/api/nubank-balance/reconcile", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!pastedText.trim()) {
          throw new Error("Cole o conteúdo do extrato na área de texto.");
        }
        res = await fetch("/api/nubank-balance/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawText: pastedText.trim(),
            fileName: "Extrato Colado",
            statementBalance: manualBalance.trim()
              ? parseFloat(manualBalance.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."))
              : undefined,
            userId,
          }),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Erro ao processar validação do extrato.");
      }

      setReport(json.report);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClosure = async () => {
    if (!report || report.dailyResults.length === 0) return;
    setSaving(true);
    setSaveSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/nubank-balance/reconcile/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyResults: report.dailyResults,
          sourceFileName: selectedFile?.name || "Extrato Nubank",
          userId,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao salvar fechamento diário.");

      setSaveSuccessMsg(`Fechamento diário registrado com sucesso para ${json.savedCount} dia(s)!`);
      if (onReconciliationSaved) onReconciliationSaved();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar fechamento.");
    } finally {
      setSaving(false);
    }
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden relative"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/[0.08] bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#820AD1]/20 border border-[#820AD1]/40 text-[#d8b4fe] flex items-center justify-center shadow-lg shadow-purple-950/40">
              <FileCheck2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Validador & Conciliador de Extrato Nubank
                </h2>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#820AD1]/20 text-[#d8b4fe] border border-[#820AD1]/40">
                  7 Dias • Nubank 02
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Importe o extrato do Nubank para auditar cada débito/crédito e registrar o saldo diário oficial.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
          
          {/* Seção 1: Entrada do Extrato (Tabs Upload ou Colar) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/80 border border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setActiveTab("file")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "file"
                      ? "bg-[#820AD1] text-white shadow-md shadow-purple-950/50"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Upload size={13} />
                  <span>Importar Arquivo (CSV / PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === "text"
                      ? "bg-[#820AD1] text-white shadow-md shadow-purple-950/50"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Clipboard size={13} />
                  <span>Colar Texto do Extrato</span>
                </button>
              </div>

              {activeTab === "text" && (
                <button
                  type="button"
                  onClick={() => {
                    setPastedText(SAMPLE_CSV);
                    setManualBalance("1515,45");
                  }}
                  className="text-[11px] font-mono text-purple-400 hover:text-purple-300 underline underline-offset-4 cursor-pointer"
                >
                  Carregar Exemplo de Teste (19/10/2026)
                </button>
              )}
            </div>

            {/* Tab: Arquivo */}
            {activeTab === "file" ? (
              <div className="relative border-2 border-dashed border-white/10 hover:border-[#820AD1]/60 rounded-2xl p-6 text-center transition-all bg-slate-950/40 hover:bg-slate-900/40 cursor-pointer">
                <input
                  type="file"
                  accept=".csv,.pdf,.ofx,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2.5 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-[#d8b4fe] flex items-center justify-center">
                    <FileText size={22} />
                  </div>
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-emerald-400 font-mono">
                        Arquivo: {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Clique para trocar
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Arraste seu arquivo do Nubank aqui ou clique para selecionar
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formatos suportados: <strong>.CSV</strong> (recomendado), <strong>.PDF</strong> oficial do Nubank ou <strong>.OFX</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Tab: Colar Texto */
              <div className="space-y-2">
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Cole aqui as linhas do extrato CSV (ex: Data,Valor,Identificador,Descrição) ou texto copiado do app..."
                  className="w-full p-4 rounded-2xl bg-slate-950/70 border border-white/10 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#820AD1] focus:ring-1 focus:ring-[#820AD1] leading-relaxed custom-scrollbar"
                />
              </div>
            )}

            {/* Saldo Final no Extrato (Opcional se CSV) + Botão de Validar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">Saldo Final no Extrato (opcional se CSV):</span>
                <input
                  type="text"
                  value={manualBalance}
                  onChange={(e) => setManualBalance(e.target.value)}
                  placeholder="Ex: 1.515,45"
                  className="w-32 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono font-bold text-white focus:outline-none focus:border-[#820AD1]"
                />
              </div>

              <button
                type="button"
                onClick={handleValidate}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#820AD1] via-[#9333ea] to-purple-700 hover:from-[#7308bd] hover:to-purple-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-950/50 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Auditando Extrato...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Validar & Conciliar Lançamentos</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Mensagens de Erro / Sucesso */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle size={16} className="shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* ========================================================
              RELATÓRIO DE AUDITORIA & CONCILIAÇÃO
              ======================================================== */}
          {report && (
            <div className="space-y-6 pt-4 border-t border-white/[0.08] animate-in fade-in">
              
              {/* Banner de Auditoria de Saldo (Extrato x Sistema) */}
              <div
                className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  !report.isBalanceDivergent
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                    : "bg-amber-500/15 border-amber-500/40 text-amber-200"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      !report.isBalanceDivergent
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    }`}
                  >
                    {!report.isBalanceDivergent ? (
                      <CheckCircle2 size={22} className="animate-pulse" />
                    ) : (
                      <AlertTriangle size={22} className="animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                      {!report.isBalanceDivergent
                        ? "Saldo 100% Conciliado sem divergências"
                        : `Atenção: Divergência de Saldo de ${formatBRL(Math.abs(report.balanceDivergence))}`}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed text-slate-300">
                      {!report.isBalanceDivergent ? (
                        <>
                          O saldo final do extrato bancário (
                          <strong className="text-emerald-400">{formatBRL(report.statementBalance)}</strong>
                          ) bate perfeitamente com o saldo controlado no Conect Pay (
                          <strong className="text-emerald-400">{formatBRL(report.systemBalance)}</strong>
                          ).
                        </>
                      ) : (
                        <>
                          Saldo no Extrato: <strong className="text-white">{formatBRL(report.statementBalance)}</strong> | Saldo no Conect Pay: <strong className="text-white">{formatBRL(report.systemBalance)}</strong>. Diferença: <strong className="text-rose-400">{formatBRL(report.balanceDivergence)}</strong>.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  {report.isBalanceDivergent && (
                    <button
                      type="button"
                      onClick={() => setIsConfirmAdjustOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Comparar e ajustar o saldo do Conect Pay para o saldo oficial do extrato com sua validação"
                    >
                      <Sparkles size={13} />
                      <span>Alinhar Saldo com Extrato</span>
                    </button>
                  )}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                      !report.isBalanceDivergent
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    {!report.isBalanceDivergent ? "100% CONCILIADO" : "DIVERGENTE"}
                  </span>
                </div>
              </div>

              {/* Card Interativo: Validação do Usuário para Ajuste do Saldo */}
              {isConfirmAdjustOpen && (
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-950/40 border-2 border-amber-500/50 shadow-2xl space-y-3.5 animate-in zoom-in-95 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                      <Sparkles size={16} />
                      <span>Validação do Usuário: Alinhar Saldo do Cofre com o Extrato Oficial</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfirmAdjustOpen(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    O extrato bancário oficial do Nubank apurou um saldo final de{" "}
                    <strong className="text-emerald-400">{formatBRL(report.statementBalance)}</strong>, enquanto o Conect Pay registra{" "}
                    <strong className="text-white">{formatBRL(report.systemBalance)}</strong>. Confirme abaixo se deseja gravar o ajuste oficial de saldo no sistema:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-1 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                      <span className="text-[10px] text-slate-400 block uppercase">Saldo Atual Conect Pay</span>
                      <strong className="text-sm text-slate-200 mt-0.5 block">{formatBRL(report.systemBalance)}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30">
                      <span className="text-[10px] text-emerald-400/80 block uppercase">Saldo Oficial no Extrato</span>
                      <strong className="text-sm text-emerald-400 mt-0.5 block">{formatBRL(report.statementBalance)}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10">
                      <span className="text-[10px] text-slate-400 block uppercase">Diferença a Ajustar</span>
                      <strong
                        className={`text-sm mt-0.5 block ${
                          report.balanceDivergence > 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {report.balanceDivergence > 0 ? "+" : ""}
                        {formatBRL(report.balanceDivergence)}
                      </strong>
                    </div>
                  </div>

                  {adjustFeedbackMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={16} />
                      <span>{adjustFeedbackMsg}</span>
                    </div>
                  )}

                  {adjustErrorMsg && (
                    <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle size={16} />
                      <span>{adjustErrorMsg}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfirmAdjustOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAdjustBalance}
                      disabled={isAdjustingBalance}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center gap-2"
                    >
                      {isAdjustingBalance ? (
                        <>
                          <RefreshCw size={13} className="animate-spin text-slate-950" />
                          <span>Atualizando Saldo...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Confirmar e Ajustar Saldo para {formatBRL(report.statementBalance)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 4 KPIs de Auditoria */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.06]">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Lançamentos no Extrato</span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    {report.totalItems}
                  </span>
                  <span className="text-[10px] text-slate-500">Período: {report.periodStart} a {report.periodEnd}</span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-mono uppercase text-emerald-400/80 block">Conciliados (Match)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                    {report.matchedItemsCount} de {report.totalItems}
                  </span>
                  <span className="text-[10px] text-emerald-300/70">
                    {report.totalItems > 0
                      ? Math.round((report.matchedItemsCount / report.totalItems) * 100)
                      : 100}
                    % conferido
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[10px] font-mono uppercase text-rose-400/80 block">Não Lançados no Sistema</span>
                  <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                    {report.unmatchedItemsCount}
                  </span>
                  <span className="text-[10px] text-rose-300/70">Despesas ausentes no cofre</span>
                </div>

                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] font-mono uppercase text-[#d8b4fe]/80 block">Entradas / Saídas</span>
                  <div className="text-xs font-mono font-bold mt-1 space-y-0.5">
                    <span className="text-emerald-400 block">+{formatBRL(report.totalEntries)}</span>
                    <span className="text-rose-400 block">-{formatBRL(report.totalExits)}</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Lançamentos do Extrato e Status de Cada Um */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                    Detalhamento dos Lançamentos do Extrato x Conect Pay
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    {report.itemsResults.length} transações analisadas
                  </span>
                </div>

                <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-slate-950/60">
                  <div className="overflow-x-auto custom-scrollbar max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 font-mono text-[10px] uppercase tracking-wider sticky top-0 z-10 border-b border-white/[0.08]">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Descrição no Extrato</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3">Status de Auditoria</th>
                          <th className="px-4 py-3">Movimentação Conect Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {report.itemsResults.map((r, idx) => {
                          const it = r.statementItem;
                          const isEntry = it.amount > 0;
                          const isMatched = r.status === "CONCILIADO";

                          return (
                            <tr key={it.id || idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-300">
                                {it.date.split("-").reverse().join("/")}
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isEntry
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                  }`}
                                >
                                  {isEntry ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                                  <span>{isEntry ? "Entrada" : "Saída"}</span>
                                </span>
                              </td>

                              <td className="px-4 py-3 font-medium max-w-sm truncate text-white" title={it.description}>
                                {it.description}
                              </td>

                              <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                <span className={isEntry ? "text-emerald-400" : "text-rose-400"}>
                                  {isEntry ? "+" : ""}
                                  {formatBRL(it.amount)}
                                </span>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    isMatched
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                      : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                  }`}
                                >
                                  {isMatched ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                  <span>{isMatched ? "Conciliado" : "Não Lançado"}</span>
                                </span>
                              </td>

                              <td className="px-4 py-3 text-slate-400 text-[11px] truncate max-w-xs">
                                {r.matchedMovementDesc || r.matchedPaymentRequestTitle || (
                                  <span className="text-rose-400/80 italic">Pendente de lançamento</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Seção: Fechamento Diário para Gravação Oficial */}
              {report.dailyResults.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={14} className="text-[#d8b4fe]" />
                      <span>Registrar Fechamento Diário Oficial</span>
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Grava no histórico o fechamento de cada dia ({report.dailyResults.map((d) => d.date.split("-").reverse().join("/")).join(", ")}) com saldo sistema x extrato.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveClosure}
                    disabled={saving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    {saving ? (
                      <>
                        <RefreshCw size={13} className="animate-spin text-slate-950" />
                        <span>Gravando...</span>
                      </>
                    ) : (
                      <>
                        <Save size={13} />
                        <span>Salvar Fechamento Diário</span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
