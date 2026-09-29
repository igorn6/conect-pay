"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useProfilesMap } from "@/hooks/useProfilesMap";
import { Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { PaymentRequest } from "@/types/database";

export default function SettingsExport() {
  const { userRole } = useAuth();
  const router = useRouter();
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [loading, setLoading] = useState(false);
  const { profilesMap } = useProfilesMap();

  // Proteção de Rota (RBAC)
  useEffect(() => {
    if (userRole && userRole !== "FINANCEIRO" && (userRole as any) !== "MASTER") {
      router.push("/");
    }
  }, [userRole, router]);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      alert("Por favor, selecione as datas inicial e final.");
      return;
    }

    setLoading(true);

    try {
      // Ajusta para o final do dia para incluir tudo
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from("payment_requests")
        .select("*")
        .eq("is_deleted", false)
        .gte("created_at", new Date(startDate).toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: true });

      if (statusFilter !== "TODOS") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao buscar dados:", error);
        alert("Erro ao buscar dados do Supabase.");
        return;
      }

      if (!data || data.length === 0) {
        alert("Nenhum registro encontrado para os filtros selecionados.");
        return;
      }

      // Mapeamento limpo das colunas
      const formattedData = (data as PaymentRequest[]).map((req) => ({
        "Data do Pedido": new Date(req.created_at).toLocaleDateString("pt-BR"),
        "Título": req.title,
        "Valor (R$)": Number(req.amount),
        "Categoria": req.category,
        "Status": req.status,
        "Solicitante": (profilesMap[req.real_requester_id] || "Desconhecido"),
        "Tipo de Pagamento": req.payment_type,
        "Titular Pix": req.pix_owner || "-",
        "Chave Pix": req.pix_key || "-",
      }));

      // Geração do Excel via Client-Side
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Financeiro");
      
      const dateString = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `ConectPay_Relatorio_Financeiro_${dateString}.xlsx`);

    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
      alert("Ocorreu um erro ao gerar o relatório.");
    } finally {
      setLoading(false);
    }
  };

  if (!userRole) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      
      
      <div className="flex-1 overflow-y-auto w-full flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Download className="text-emerald-500" />
              Exportação Financeira
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Gere relatórios precisos em Excel filtrando as solicitações por período e status.
            </p>
          </div>

          <form onSubmit={handleExport} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Data Inicial *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-300">Data Final *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Status da Solicitação</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer"
              >
                <option value="TODOS">Todos</option>
                <option value="NOVA_SOLICITACAO">Nova Solicitação</option>
                <option value="EM_APROVACAO">Em Aprovação</option>
                <option value="AGUARDANDO_NOTINHA">Aguardando Notinha</option>
                <option value="PAGAMENTO_FINALIZADO">Pagamento Finalizado</option>
                <option value="RECUSADO">Recusado</option>
              </select>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-700">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Gerando Relatório...
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Gerar e Baixar Relatório (Excel)
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
