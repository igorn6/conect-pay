"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  Plus,
  RefreshCw,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Gauge,
  AlertCircle,
  TrendingUp,
  MapPin,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AnimatedCurrency from "@/components/ui/AnimatedCurrency";
import BudgetCeilingMonitor from "@/components/expenses/BudgetCeilingMonitor";
import TripSandwichCard from "@/components/expenses/TripSandwichCard";
import NewTripModal from "@/components/expenses/NewTripModal";
import { computeMonthlyExpenseBudget } from "@/lib/expenseBudget";
import type { ExpenseTrip, ExpenseTripStatus, Prospector } from "@/types/database";

export default function AjudaCustosPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const isMaster = userRole === "MASTER";
  const isFinanceiro = userRole === "FINANCEIRO";

  // Estados principais
  const [trips, setTrips] = useState<ExpenseTrip[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<ExpenseTrip | null>(null);

  // Carregar lista de vendedores (Andreia)
  const fetchProspectors = useCallback(async () => {
    try {
      const res = await fetch("/api/prospectors");
      if (res.ok) {
        const json = await res.json();
        setProspectors(json.data || []);
      }
    } catch (err) {
      console.error("Erro ao carregar prospectores:", err);
    }
  }, []);

  // Carregar todas as viagens do mês selecionado (filtragem por status feita localmente para preservar o monitor mensal)
  const fetchTrips = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        setError(null);

        const params = new URLSearchParams();
        if (selectedMonth) params.set("month", selectedMonth);

        const res = await fetch(`/api/expense-trips?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Falha ao carregar ajudas de custo.");
        }

        const json = await res.json();
        setTrips(json.data || []);
      } catch (err: any) {
        setError(err.message || "Erro de conexão ao carregar viagens.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedMonth]
  );

  useEffect(() => {
    fetchProspectors();
  }, [fetchProspectors]);

  useEffect(() => {
    fetchTrips(false);
  }, [fetchTrips]);

  // Ação: Alterar status (Aprovar / Pagar)
  const handleStatusChange = async (id: string, newStatus: ExpenseTripStatus) => {
    try {
      const res = await fetch(`/api/expense-trips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao atualizar status.");
      }

      fetchTrips(true);
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar status.");
    }
  };

  // Ação: Excluir viagem
  const handleDeleteTrip = async (id: string) => {
    try {
      const res = await fetch(`/api/expense-trips/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao excluir viagem.");
      }

      fetchTrips(true);
    } catch (err: any) {
      alert(err.message || "Erro ao excluir viagem.");
    }
  };

  // Ação: Abrir modal de edição
  const handleOpenEdit = (trip: ExpenseTrip) => {
    setEditingTrip(trip);
    setIsModalOpen(true);
  };

  const andreiaProspectorId = useMemo(() => {
    const match = prospectors.find((p) =>
      (p.name || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes("andreia")
    );
    return match?.id || null;
  }, [prospectors]);

  const monthlyBudget = useMemo(
    () => computeMonthlyExpenseBudget(trips, { andreiaProspectorId }),
    [trips, andreiaProspectorId]
  );

  const filteredTrips = useMemo(() => {
    if (selectedStatus === "ALL") return trips;
    return trips.filter((t) => t.status === selectedStatus);
  }, [trips, selectedStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: trips.length,
      EM_ANDAMENTO: 0,
      PENDENTE: 0,
      APROVADO: 0,
      PAGO: 0,
    };
    for (const t of trips) {
      if (counts[t.status] !== undefined) counts[t.status] += 1;
    }
    return counts;
  }, [trips]);

  // Cálculos de Resumo do Mês
  const stats = useMemo(() => {
    const paid = trips
      .filter((t) => t.status === "PAGO")
      .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const pending = trips
      .filter((t) => t.status === "PENDENTE" || t.status === "APROVADO")
      .reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0);
    const inProgressTrips = trips.filter((t) => t.status === "EM_ANDAMENTO");
    const inProgressCount = inProgressTrips.length;
    const totalKm = trips.reduce(
      (sum, t) => sum + (Number(t.km_driven) || (t.odometer_end != null ? t.odometer_end - t.odometer_start : 0)),
      0
    );

    return {
      paid,
      pending,
      inProgressCount,
      totalKm,
      count: trips.length,
    };
  }, [trips]);

  return (
    <div
      id="ajuda-custos-scroll-container"
      className="flex-1 flex flex-col w-full min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-transparent"
      style={{
        color: "var(--text-primary)",
        overflowY: "auto",
        height: "100%",
        maxHeight: "100%",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="max-w-[1360px] mx-auto w-full space-y-6 pb-16">
        {/* ========================================================
            HEADER PRINCIPAL & BOTÃO + NOVA VIAGEM
            ======================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
                <Car className="text-amber-400" size={26} />
                <span>Ajuda de Custos • Vendedores</span>
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Sparkles size={11} className="text-amber-400" />
                Andreia · Prospecção de Campo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Controle de odômetros, combustível (R$ 1/km), alimentação e pedágio para visitas externas.
            </p>
          </div>

          {/* Botões de Ação Superiores */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => fetchTrips(true)}
              disabled={refreshing}
              title="Atualizar lista agora"
              className="p-2.5 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-amber-400" : ""} />
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingTrip(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Plus size={16} className="text-slate-950 stroke-[3]" />
              <span>Nova Viagem</span>
            </button>
          </div>
        </div>

        {/* ========================================================
            MONITOR DE TETO MENSAL (R$ 2.000 ALERTA / R$ 3.000 MÁX.)
            ======================================================== */}
        <BudgetCeilingMonitor budget={monthlyBudget} selectedMonth={selectedMonth} />

        {/* ========================================================
            CARDS DE RESUMO (KPIs)
            ======================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Pago */}
          <div
            className="p-4 rounded-2xl border relative overflow-hidden group hover:border-emerald-500/40 transition-colors"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={13} />
                Total Pago no Mês
              </span>
              <span className="text-[10px] font-mono text-slate-400">Reembolsado</span>
            </div>
            <div className="mt-1">
              <AnimatedCurrency
                value={stats.paid}
                prefix="R$ "
                className="text-2xl font-extrabold text-white font-mono tracking-tight"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Viagens finalizadas e pagas.</p>
          </div>

          {/* Card 2: Total Pendente */}
          <div
            className="p-4 rounded-2xl border relative overflow-hidden group hover:border-amber-500/40 transition-colors"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Clock size={13} />
                Pendente / Em Aberto
              </span>
              <span className="text-[10px] font-mono text-slate-400">Aguardando</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 flex-wrap">
              <AnimatedCurrency
                value={stats.pending}
                prefix="R$ "
                className="text-2xl font-extrabold text-amber-300 font-mono tracking-tight"
              />
              {stats.inProgressCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {stats.inProgressCount} em rota
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Viagens a aprovar ou pagar.</p>
          </div>

          {/* Card 3: KM Total */}
          <div
            className="p-4 rounded-2xl border relative overflow-hidden group hover:border-blue-500/40 transition-colors"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Gauge size={13} />
                Quilometragem Total
              </span>
              <span className="text-[10px] font-mono text-slate-400">Odômetro</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono tracking-tight">
                {stats.totalKm.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs font-semibold text-blue-300">km</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Equivalente a R$ {stats.totalKm.toFixed(2)} de combustível.</p>
          </div>

          {/* Card 4: Total de Viagens */}
          <div
            className="p-4 rounded-2xl border relative overflow-hidden group hover:border-purple-500/40 transition-colors"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <TrendingUp size={13} />
                Viagens Lançadas
              </span>
              <span className="text-[10px] font-mono text-slate-400">Volume</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono tracking-tight">
                {stats.count}
              </span>
              <span className="text-xs font-semibold text-purple-300">
                {stats.count === 1 ? "rota" : "rotas"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Registradas no período selecionado.</p>
          </div>
        </div>

        {/* ========================================================
            BARRA DE FILTROS & STATUS
            ======================================================== */}
        <div
          className="p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.4)",
            borderColor: "var(--surface-border)",
          }}
        >
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "Todas" },
              { id: "EM_ANDAMENTO", label: "Em Andamento" },
              { id: "PENDENTE", label: "Pendentes" },
              { id: "APROVADO", label: "Aprovadas" },
              { id: "PAGO", label: "Pagas" },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedStatus(pill.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  selectedStatus === pill.id
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span>{pill.label}</span>
                <span className="font-mono text-[10px] opacity-75">
                  ({statusCounts[pill.id] ?? 0})
                </span>
              </button>
            ))}
          </div>

          {/* Filtro Mês */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium outline-none border focus:border-amber-500 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* ========================================================
            LISTA DE CARDS SANDUÍCHE
            ======================================================== */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border animate-pulse"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--surface-border)",
                }}
              />
            ))}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div
            className="p-12 rounded-2xl border border-dashed text-center space-y-3"
            style={{
              borderColor: "var(--surface-border)",
              backgroundColor: "rgba(15, 23, 42, 0.3)",
            }}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <Car size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Nenhuma viagem encontrada</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                {trips.length > 0 && selectedStatus !== "ALL"
                  ? "Nenhuma viagem com este status no mês selecionado. Selecione 'Todas' para visualizar os demais lançamentos."
                  : "Não há registros de ajuda de custos para o mês selecionado. Clique no botão abaixo para lançar a primeira viagem da Andreia."}
              </p>
            </div>
            {trips.length > 0 && selectedStatus !== "ALL" ? (
              <button
                type="button"
                onClick={() => setSelectedStatus("ALL")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md cursor-pointer"
              >
                <span>Ver Todas do Mês</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingTrip(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors shadow-md cursor-pointer"
              >
                <Plus size={14} className="stroke-[3]" />
                <span>Lançar Primeira Viagem</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredTrips.map((trip) => (
              <TripSandwichCard
                key={trip.id}
                trip={trip}
                onStatusChange={handleStatusChange}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTrip}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Nova Viagem / Edição */}
      <NewTripModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTrip(null);
        }}
        onSuccess={() => fetchTrips(true)}
        prospectors={prospectors}
        initialTrip={editingTrip}
      />
    </div>
  );
}

