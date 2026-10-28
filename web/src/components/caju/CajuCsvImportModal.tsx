"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  UserPlus,
  Clock,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  FileCheck,
  Bot,
} from "lucide-react";
import type { CajuImportSummary } from "@/constants/caju";
import { CAJU_CUTOFF_LABEL } from "@/constants/caju";
import { supabase } from "@/lib/supabase";

export interface CajuCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onImported: (hubData: any, summary: CajuImportSummary) => void;
}

export default function CajuCsvImportModal({
  isOpen,
  onClose,
  userId,
  onImported,
}: CajuCsvImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<CajuImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reseta estados quando o modal abre/fecha
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setIsDragging(false);
      setUploading(false);
      setErrorMsg(null);
      setSummary(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setErrorMsg("Selecione um arquivo no formato CSV (.csv).");
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setErrorMsg("Selecione um arquivo no formato CSV (.csv).");
        return;
      }
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMsg("Selecione o arquivo CSV antes de enviar.");
      return;
    }

    try {
      setUploading(true);
      setErrorMsg(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (userId) headers["x-user-id"] = userId;

      const formData = new FormData();
      formData.append("file", selectedFile);
      if (userId) formData.append("userId", userId);

      const res = await fetch("/api/caju/import", {
        method: "POST",
        headers,
        body: formData,
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || "Falha ao importar extrato CSV do Caju.");
      }

      const returnedSummary: CajuImportSummary = resJson.summary;
      setSummary(returnedSummary);
      onImported(resJson, returnedSummary);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado ao processar o arquivo CSV.");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSummary(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-5 animate-in zoom-in-95 custom-scrollbar"
        style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
      >
        {/* Header Modal */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30 shadow-inner">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Importar Extrato Oficial Caju
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  CSV Oficial
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Processamento idempotente com conciliação automática via Validador IA
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

        {/* Badges de Regras do Hub Caju */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Regra 1: Apenas Completas */}
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 size={13} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Completas &amp; Pendentes</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                Inclui compras pendentes no cartão e ignora apenas transações <em>Estornadas</em>.
              </p>
            </div>
          </div>

          {/* Regra 2: Anti-Duplicidade (Hash Único) */}
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck size={13} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Anti-Duplicidade (Hash Único)</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                Permite importar extratos com períodos sobrepostos com garantia de idempotência.
              </p>
            </div>
          </div>

          {/* Regra 3: Auto-Cadastro */}
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
              <UserPlus size={13} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Auto-Cadastro de Colaboradores</p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                Novos CPFs presentes no extrato entram automaticamente na lista com saldo atualizado.
              </p>
            </div>
          </div>

          {/* Regra 4: Corte Temporal */}
          <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={13} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                Corte Temporal ({CAJU_CUTOFF_LABEL})
              </p>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                ≤ marco zero compõem histórico sem alterar saldo inicial; &gt; marco zero atualizam saldos.
              </p>
            </div>
          </div>
        </div>

        {/* Visualização de Resumo Pós-Importação */}
        {summary ? (
          <div className="space-y-4 animate-in fade-in">
            {/* Banner Sucesso */}
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check size={18} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-emerald-400">
                  Extrato Processado e Conciliado com Sucesso!
                </h4>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  Arquivo: <span className="font-mono text-white">{summary.fileName}</span> (Lote{" "}
                  <span className="font-mono text-white text-[11px]">{summary.batchId.slice(0, 8)}...</span>)
                </p>
              </div>
            </div>

            {/* Grid de Estatísticas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Total de Linhas</span>
                <span className="text-lg font-bold text-white tabular-nums">{summary.totalRows}</span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Completas Processadas</span>
                <span className="text-lg font-bold text-emerald-400 tabular-nums">
                  {summary.completedRows}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Ignoradas (Pendentes)</span>
                <span className="text-lg font-bold text-slate-400 tabular-nums">
                  {summary.ignoredRows}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Inéditas Inseridas</span>
                <span className="text-lg font-bold text-rose-400 tabular-nums">
                  {summary.inserted}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Duplicadas Barradas</span>
                <span className="text-lg font-bold text-cyan-400 tabular-nums">
                  {summary.duplicates}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Pós-Marco-Zero</span>
                <span className="text-lg font-bold text-amber-400 tabular-nums">
                  {summary.applied}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Novos Colaboradores</span>
                <span className="text-lg font-bold text-purple-400 tabular-nums">
                  +{summary.newCollaborators}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Conciliação IA (Depósitos)</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold text-emerald-400 tabular-nums">
                    {summary.reconciled} OK
                  </span>
                  <span className="text-slate-600">/</span>
                  <span className="text-xs font-semibold text-slate-400 tabular-nums">
                    {summary.unreconciled} pend
                  </span>
                </div>
              </div>
            </div>

            {/* Avisos de Parsing se houver */}
            {summary.parseWarnings && summary.parseWarnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} className="text-amber-400" />
                  <span>Avisos de processamento:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/80">
                  {summary.parseWarnings.slice(0, 5).map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                  {summary.parseWarnings.length > 5 && (
                    <li>...e mais {summary.parseWarnings.length - 5} avisos.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Botões pós-importação */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Importar Outro Arquivo</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          /* Dropzone e Formulário de Upload */
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-rose-500 bg-rose-500/10 scale-[1.01]"
                  : selectedFile
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-white/15 hover:border-rose-500/40 hover:bg-white/[0.02]"
              }`}
            >
              {selectedFile ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <FileCheck size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white truncate max-w-sm">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      Tamanho: {formatFileSize(selectedFile.size)} &bull; Clique ou arraste para substituir
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <Upload size={22} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">
                      Arraste o arquivo CSV do Caju aqui ou <span className="text-rose-400 underline">clique para selecionar</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Extrato Caju oficial &bull; Ponto-e-vírgula (;) &bull; UTF-8 com BOM
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Erro de Validação/Upload */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processando e Conciliando com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Importar e Processar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
