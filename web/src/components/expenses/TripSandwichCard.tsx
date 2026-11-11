"use client";

import { useState } from "react";
import {
  ChevronDown,
  Gauge,
  MapPin,
  UtensilsCrossed,
  Milestone,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  Pencil,
  Trash2,
  Car,
  Image as ImageIcon,
  Check,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { ExpenseTrip, ExpenseTripStatus } from "@/types/database";
import TripPhotoLightbox from "./TripPhotoLightbox";

interface TripSandwichCardProps {
  trip: ExpenseTrip;
  onStatusChange: (id: string, newStatus: ExpenseTripStatus) => Promise<void>;
  onEdit: (trip: ExpenseTrip) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function TripSandwichCard({
  trip,
  onStatusChange,
  onEdit,
  onDelete,
}: TripSandwichCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const isTripInProgress = trip.status === "EM_ANDAMENTO" || trip.odometer_end == null;
  const kmDriven = !isTripInProgress
    ? (Number(trip.km_driven) || ((trip.odometer_end ?? 0) - trip.odometer_start))
    : 0;
  const kmSuggested = trip.km_suggested ? Number(trip.km_suggested) : null;
  const fuelAmount = !isTripInProgress
    ? (Number(trip.fuel_amount) || (kmDriven * Number(trip.fuel_rate_per_km || 1)))
    : 0;
  const mealAmount = Number(trip.meal_amount) || 0;
  const tollAmount = Number(trip.toll_amount) || 0;
  const totalAmount = Number(trip.total_amount) || (fuelAmount + mealAmount + tollAmount);

  // Cálculo de discrepância de KM
  let kmDiffPct = 0;
  let isHighDeviation = false;
  if (!isTripInProgress && kmSuggested && kmSuggested > 0) {
    kmDiffPct = Math.round(((kmDriven - kmSuggested) / kmSuggested) * 100);
    if (kmDiffPct > 25) {
      isHighDeviation = true;
    }
  }

  const formatBRL = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleAction = async (status: ExpenseTripStatus) => {
    try {
      setLoadingAction(true);
      await onStatusChange(trip.id, status);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <>
      <div
        className="rounded-2xl border overflow-hidden transition-all duration-200 hover:border-amber-500/40 shadow-sm"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
      >
        {/* ========================================================
            HEADER DO CARD (CLICÁVEL PARA EXPANDIR)
            ======================================================== */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
        >
          {/* Lado Esquerdo: Badge Status + Vendedor + Rota */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Status Badge */}
            {trip.status === "EM_ANDAMENTO" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse shrink-0">
                <Clock size={12} className="text-amber-400" />
                Em Andamento
              </span>
            )}
            {trip.status === "PENDENTE" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Pendente
              </span>
            )}
            {trip.status === "APROVADO" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Aprovado
              </span>
            )}
            {trip.status === "PAGO" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                <Check size={12} className="text-emerald-400" />
                Pago
              </span>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  {trip.prospector?.name || "Andreia"}
                </h4>
                <span className="text-xs text-slate-400 font-mono">
                  • {formatDate(trip.trip_date)}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md">
                Destino: <strong className="text-slate-200">{trip.destination_address}</strong>
              </p>
            </div>
          </div>

          {/* Lado Direito: KM + Total R$ + Chevron */}
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-1.5 sm:justify-end">
                <Car size={13} className="text-amber-400" />
                <span className={`text-xs font-mono font-bold ${isTripInProgress ? "text-amber-300" : "text-slate-200"}`}>
                  {isTripInProgress ? "Em rota..." : `${kmDriven} km rodados`}
                </span>
              </div>
              {kmSuggested ? (
                <p className="text-[11px] text-slate-400">
                  {kmSuggested} km est. (ida+volta)
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <p className="text-base font-extrabold font-mono text-white tracking-tight">
                R$ {formatBRL(totalAmount)}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">
                {isTripInProgress ? "Total Parcial" : "Total a Pagar"}
              </p>
            </div>

            <div className="p-1 rounded-lg text-slate-400 group-hover:text-white transition-colors">
              <ChevronDown
                size={18}
                className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </div>

        {/* ========================================================
            CORPO DO SANDUÍCHE (EXPANDÍVEL)
            ======================================================== */}
        {expanded && (
          <div className="border-t border-white/5">
            {/* 🍞 PÃO SUPERIOR: Odômetro Inicial */}
            <div
              className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4 border-b border-white/5"
              style={{ backgroundColor: "rgba(245, 158, 11, 0.03)" }}
            >
              <div className="w-1 self-stretch rounded-full bg-amber-500/50 shrink-0" />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Gauge size={15} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Odômetro Inicial (Saída)
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold font-mono text-white tracking-tight">
                    {trip.odometer_start.toLocaleString("pt-BR")} <span className="text-xs text-slate-400 font-sans font-normal">km</span>
                  </p>
                  <div className="flex items-start gap-1.5 mt-2">
                    <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-tight">
                      <strong>Origem:</strong> {trip.origin_address}
                    </p>
                  </div>
                </div>

                {/* Foto do Odômetro Inicial */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                    Foto do Painel Inicial:
                  </label>
                  {trip.odometer_start_photo ? (
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({
                          url: trip.odometer_start_photo!,
                          title: `Odômetro Inicial (${trip.odometer_start} km) - ${formatDate(trip.trip_date)}`,
                        })
                      }
                      className="group relative w-full sm:w-56 h-28 rounded-xl overflow-hidden border border-white/10 hover:border-amber-400/50 transition-all cursor-pointer shadow-sm"
                    >
                      <img
                        src={trip.odometer_start_photo}
                        alt="Odômetro Inicial"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-1.5">
                        <ImageIcon size={14} />
                        <span>Ver Foto</span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-full sm:w-56 h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-500 italic">
                      Sem foto anexada
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 🚗 DIVISOR EM TRÂNSITO */}
            <div className="px-5 py-2 flex items-center gap-3 text-xs text-slate-400 bg-black/20">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              <div className="h-px flex-1 border-t border-dashed border-white/10" />
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-300/80">
                <Car size={13} className="text-amber-400" />
                <span>Em Trânsito • Visitas a Clientes</span>
              </div>
              <div className="h-px flex-1 border-t border-dashed border-white/10" />
              <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
            </div>

            {/* 🥩 RECHEIO: Alimentação, Pedágio e Observações */}
            <div
              className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-3 gap-3.5 border-b border-white/5"
              style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
            >
              {/* Card Alimentação */}
              <div
                className="p-3.5 rounded-xl border flex flex-col justify-between"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                      <UtensilsCrossed size={13} />
                      Alimentação
                    </span>
                    {mealAmount > 0 && trip.meal_receipt_url && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Check size={11} /> Comprovante
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold font-mono text-white">
                    R$ {formatBRL(mealAmount)}
                  </p>
                </div>
                {trip.meal_receipt_url && (
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({
                        url: trip.meal_receipt_url!,
                        title: `Comprovante de Alimentação (R$ ${formatBRL(mealAmount)})`,
                      })
                    }
                    className="mt-2 text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon size={13} />
                    <span>Ver Comprovante</span>
                  </button>
                )}
              </div>

              {/* Card Pedágio */}
              <div
                className="p-3.5 rounded-xl border flex flex-col justify-between"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Milestone size={13} />
                      Pedágio
                    </span>
                    {tollAmount > 0 && trip.toll_receipt_url && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Check size={11} /> Comprovante
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-bold font-mono text-white">
                    R$ {formatBRL(tollAmount)}
                  </p>
                </div>
                {trip.toll_receipt_url && (
                  <button
                    type="button"
                    onClick={() =>
                      setLightbox({
                        url: trip.toll_receipt_url!,
                        title: `Comprovante de Pedágio (R$ ${formatBRL(tollAmount)})`,
                      })
                    }
                    className="mt-2 text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon size={13} />
                    <span>Ver Comprovante</span>
                  </button>
                )}
              </div>

              {/* Observações da Rota */}
              <div
                className="p-3.5 rounded-xl border"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--surface-border)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare size={13} className="text-slate-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Observações
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {trip.observations || <span className="text-slate-500 italic">Nenhuma observação registrada.</span>}
                </p>
              </div>
            </div>

            {/* 🏁 DIVISOR DE CHEGADA */}
            <div className="px-5 py-2 flex items-center gap-3 text-xs text-slate-400 bg-black/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
              <div className="h-px flex-1 border-t border-dashed border-white/10" />
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-emerald-300/80">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>Chegada • Fim da Rota</span>
              </div>
              <div className="h-px flex-1 border-t border-dashed border-white/10" />
              <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
            </div>

            {/* 🍞 PÃO INFERIOR: Odômetro Final OU Banner de Em Andamento */}
            {trip.odometer_end != null ? (
              <div
                className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4 border-b border-white/5"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.03)" }}
              >
                <div className="w-1 self-stretch rounded-full bg-emerald-500/50 shrink-0" />
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Gauge size={15} className="text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        Odômetro Final (Chegada)
                      </span>
                    </div>
                    <p className="text-2xl font-extrabold font-mono text-white tracking-tight">
                      {trip.odometer_end.toLocaleString("pt-BR")} <span className="text-xs text-slate-400 font-sans font-normal">km</span>
                    </p>
                    <div className="flex items-start gap-1.5 mt-2">
                      <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-300 leading-tight">
                        <strong>Destino:</strong> {trip.destination_address}
                      </p>
                    </div>
                  </div>

                  {/* Foto do Odômetro Final */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      Foto do Painel Final:
                    </label>
                    {trip.odometer_end_photo ? (
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            url: trip.odometer_end_photo!,
                            title: `Odômetro Final (${trip.odometer_end} km) - ${formatDate(trip.trip_date)}`,
                          })
                        }
                        className="group relative w-full sm:w-56 h-28 rounded-xl overflow-hidden border border-white/10 hover:border-emerald-400/50 transition-all cursor-pointer shadow-sm"
                      >
                        <img
                          src={trip.odometer_end_photo}
                          alt="Odômetro Final"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-semibold gap-1.5">
                          <ImageIcon size={14} />
                          <span>Ver Foto</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full sm:w-56 h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-xs text-slate-500 italic">
                        Sem foto anexada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 bg-amber-500/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30 mt-0.5 sm:mt-0">
                    <Clock size={20} className="animate-spin text-amber-400" style={{ animationDuration: "8s" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Rota em Andamento • Aguardando Retorno
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">
                      A viagem foi iniciada pela manhã e o odômetro final ainda não foi registrado. Quando Andreia retornar, insira o odômetro final para calcular os KMs rodados e fechar a ajuda de custos.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onEdit(trip)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer shadow-md shrink-0 font-medium"
                >
                  <Gauge size={14} className="text-slate-950" />
                  <span>Inserir Odômetro Final</span>
                </button>
              </div>
            )}

            {/* ========================================================
                RODAPÉ FINANCEIRO & AÇÕES
                ======================================================== */}
            <div
              className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)",
              }}
            >
              {/* Comparativo de KM */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-left">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">KM Real Rodado</p>
                  <p className={`text-base font-extrabold font-mono ${isTripInProgress ? "text-amber-300" : "text-white"}`}>
                    {isTripInProgress ? "Em rota..." : `${kmDriven} km`}
                  </p>
                </div>

                <div className="h-7 w-px bg-white/10 hidden sm:block" />

                <div className="text-left">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">KM Estimado (Ida+Volta)</p>
                  <p className="text-base font-extrabold font-mono text-blue-300">
                    {kmSuggested ? `${kmSuggested} km` : "Não estimado"}
                  </p>
                </div>

                {isTripInProgress ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Clock size={12} className="text-amber-400" />
                    Em andamento
                  </span>
                ) : kmSuggested ? (
                  isHighDeviation ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
                      <AlertTriangle size={12} className="text-amber-400" />
                      +{kmDiffPct}% desvio (atenção)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <Check size={12} />
                      Dentro da média ({kmDiffPct > 0 ? `+${kmDiffPct}%` : `${kmDiffPct}%`})
                    </span>
                  )
                ) : null}
              </div>

              {/* Breakdown Financeiro */}
              <div className="flex items-center gap-3 flex-wrap text-right">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Combustível</p>
                  <p className="text-xs font-mono font-bold text-amber-300">
                    {isTripInProgress ? (
                      <span className="text-slate-400 font-normal">A calcular</span>
                    ) : (
                      <>
                        R$ {formatBRL(fuelAmount)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">({kmDriven}km × R$1)</span>
                      </>
                    )}
                  </p>
                </div>
                <span className="text-slate-500 text-sm font-bold">+</span>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Alimentação</p>
                  <p className="text-xs font-mono font-bold text-orange-300">R$ {formatBRL(mealAmount)}</p>
                </div>
                <span className="text-slate-500 text-sm font-bold">+</span>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Pedágio</p>
                  <p className="text-xs font-mono font-bold text-purple-300">R$ {formatBRL(tollAmount)}</p>
                </div>
                <span className="text-slate-500 text-sm font-bold">=</span>
                <div className="text-right pl-2 border-l border-white/10">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">
                    {isTripInProgress ? "Total Parcial" : "Total Geral"}
                  </p>
                  <p className="text-lg font-extrabold font-mono text-white">R$ {formatBRL(totalAmount)}</p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 self-end lg:self-center shrink-0 pt-2 lg:pt-0">
                {trip.status === "EM_ANDAMENTO" && (
                  <button
                    type="button"
                    onClick={() => onEdit(trip)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer shadow-sm active:scale-95"
                    title="Inserir Odômetro Final e Concluir Rota"
                  >
                    <Gauge size={13} />
                    <span>Concluir Rota</span>
                  </button>
                )}

                {trip.status === "PENDENTE" && (
                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => handleAction("APROVADO")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <ThumbsUp size={13} />
                    <span>Aprovar</span>
                  </button>
                )}

                {trip.status === "APROVADO" && (
                  <button
                    type="button"
                    disabled={loadingAction}
                    onClick={() => handleAction("PAGO")}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} />
                    <span>Marcar Pago</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onEdit(trip)}
                  className="p-2 rounded-xl border text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ borderColor: "var(--surface-border)" }}
                  title="Editar Viagem"
                >
                  <Pencil size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Deseja realmente excluir esta viagem?")) {
                      onDelete(trip.id);
                    }
                  }}
                  className="p-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Excluir Viagem"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox para zoom nas fotos */}
      {lightbox && (
        <TripPhotoLightbox
          url={lightbox.url}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

