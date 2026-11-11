"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  Gauge,
  MapPin,
  Car,
  UtensilsCrossed,
  Milestone,
  Upload,
  Copy,
  AlertCircle,
  Check,
  Loader2,
  Trash2,
  AlertTriangle,
  Crop,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { ExpenseTrip, Prospector } from "@/types/database";
import PhotoCropModal from "./PhotoCropModal";

interface NewTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prospectors: Prospector[];
  initialTrip?: ExpenseTrip | null;
}

const DEFAULT_ORIGIN =
  "Condomínio Praia do Sol, R. Praia de Iporanga, 1 - Ipitanga, Lauro de Freitas - BA, 42700-000";

export default function NewTripModal({
  isOpen,
  onClose,
  onSuccess,
  prospectors,
  initialTrip,
}: NewTripModalProps) {
  const { userId } = useAuth();

  // Estados do formulário
  const [prospectorId, setProspectorId] = useState("");
  const [tripDate, setTripDate] = useState("");
  const [originAddress, setOriginAddress] = useState(DEFAULT_ORIGIN);
  const [destinationAddress, setDestinationAddress] = useState("");
  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");
  const [kmSuggested, setKmSuggested] = useState<number | null>(null);
  const [mealAmount, setMealAmount] = useState("");
  const [tollAmount, setTollAmount] = useState("");
  const [observations, setObservations] = useState("");

  // Arquivos / Fotos
  const [startPhotoFile, setStartPhotoFile] = useState<File | null>(null);
  const [startPhotoUrl, setStartPhotoUrl] = useState<string | null>(null);

  const [endPhotoFile, setEndPhotoFile] = useState<File | null>(null);
  const [endPhotoUrl, setEndPhotoUrl] = useState<string | null>(null);

  const [mealReceiptFile, setMealReceiptFile] = useState<File | null>(null);
  const [mealReceiptUrl, setMealReceiptUrl] = useState<string | null>(null);

  const [tollReceiptFile, setTollReceiptFile] = useState<File | null>(null);
  const [tollReceiptUrl, setTollReceiptUrl] = useState<string | null>(null);

  // Estados de controle
  const [submitting, setSubmitting] = useState(false);
  const [estimatingDistance, setEstimatingDistance] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSlotPaste, setActiveSlotPaste] = useState<"start" | "end" | "meal" | "toll" | null>(null);
  const [cropTarget, setCropTarget] = useState<{
    slot: "start" | "end" | "meal" | "toll";
    imageSrc: string;
    title: string;
  } | null>(null);

  // Inicialização ao abrir modal
  useEffect(() => {
    if (!isOpen) return;

    if (initialTrip) {
      setProspectorId(initialTrip.prospector_id);
      setTripDate(initialTrip.trip_date.split("T")[0]);
      setOriginAddress(initialTrip.origin_address);
      setDestinationAddress(initialTrip.destination_address);
      setOdometerStart(String(initialTrip.odometer_start));
      setOdometerEnd(
        initialTrip.odometer_end !== null && initialTrip.odometer_end !== undefined
          ? String(initialTrip.odometer_end)
          : ""
      );
      setKmSuggested(initialTrip.km_suggested ?? null);
      setMealAmount(
        initialTrip.meal_amount > 0
          ? initialTrip.meal_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : ""
      );
      setTollAmount(
        initialTrip.toll_amount > 0
          ? initialTrip.toll_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : ""
      );
      setObservations(initialTrip.observations || "");
      setStartPhotoUrl(initialTrip.odometer_start_photo || null);
      setEndPhotoUrl(initialTrip.odometer_end_photo || null);
      setMealReceiptUrl(initialTrip.meal_receipt_url || null);
      setTollReceiptUrl(initialTrip.toll_receipt_url || null);
    } else {
      const defaultProspector =
        prospectors.find((p) => p.name.toLowerCase().includes("andreia")) || prospectors[0];
      setProspectorId(defaultProspector?.id || "");
      setTripDate(new Date().toISOString().split("T")[0]);
      setOriginAddress(defaultProspector?.default_origin_address || DEFAULT_ORIGIN);
      setDestinationAddress("");
      setOdometerStart("");
      setOdometerEnd("");
      setKmSuggested(null);
      setMealAmount("");
      setTollAmount("");
      setObservations("");
      setStartPhotoFile(null);
      setStartPhotoUrl(null);
      setEndPhotoFile(null);
      setEndPhotoUrl(null);
      setMealReceiptFile(null);
      setMealReceiptUrl(null);
      setTollReceiptFile(null);
      setTollReceiptUrl(null);
    }

    setErrorMsg(null);
  }, [isOpen, initialTrip, prospectors]);

  // Manipulador ao selecionar foto (arquivo ou Ctrl+V): abre imediatamente para enquadrar e dar zoom
  const handleSelectPhoto = (file: File, slot: "start" | "end" | "meal" | "toll") => {
    const rawUrl = URL.createObjectURL(file);
    if (slot === "start") {
      setStartPhotoFile(file);
      setStartPhotoUrl(rawUrl);
    } else if (slot === "end") {
      setEndPhotoFile(file);
      setEndPhotoUrl(rawUrl);
    } else if (slot === "meal") {
      setMealReceiptFile(file);
      setMealReceiptUrl(rawUrl);
    } else if (slot === "toll") {
      setTollReceiptFile(file);
      setTollReceiptUrl(rawUrl);
    }

    const titles: Record<string, string> = {
      start: "Enquadrar e Dar Zoom no Odômetro Inicial",
      end: "Enquadrar e Dar Zoom no Odômetro Final",
      meal: "Enquadrar e Dar Zoom na Notinha de Alimentação",
      toll: "Enquadrar e Dar Zoom no Comprovante de Pedágio",
    };
    setCropTarget({ slot, imageSrc: rawUrl, title: titles[slot] });
  };

  const handleCropApply = (croppedFile: File, croppedUrl: string) => {
    if (!cropTarget) return;
    if (cropTarget.slot === "start") {
      setStartPhotoFile(croppedFile);
      setStartPhotoUrl(croppedUrl);
    } else if (cropTarget.slot === "end") {
      setEndPhotoFile(croppedFile);
      setEndPhotoUrl(croppedUrl);
    } else if (cropTarget.slot === "meal") {
      setMealReceiptFile(croppedFile);
      setMealReceiptUrl(croppedUrl);
    } else if (cropTarget.slot === "toll") {
      setTollReceiptFile(croppedFile);
      setTollReceiptUrl(croppedUrl);
    }
    setCropTarget(null);
  };

  // Listener para colar foto via Ctrl+V
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            let targetSlot: "start" | "end" | "meal" | "toll" = "start";
            if (activeSlotPaste) {
              targetSlot = activeSlotPaste;
            } else if (!startPhotoFile && !startPhotoUrl) {
              targetSlot = "start";
            } else if (!endPhotoFile && !endPhotoUrl) {
              targetSlot = "end";
            } else if (!mealReceiptFile && !mealReceiptUrl) {
              targetSlot = "meal";
            } else if (!tollReceiptFile && !tollReceiptUrl) {
              targetSlot = "toll";
            }
            setActiveSlotPaste(null);
            handleSelectPhoto(file, targetSlot);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, activeSlotPaste, startPhotoFile, startPhotoUrl, endPhotoFile, endPhotoUrl, mealReceiptFile, mealReceiptUrl, tollReceiptFile, tollReceiptUrl]);

  if (!isOpen) return null;

  const parseCurrency = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/[R$\s]/g, "");
    if (clean.includes(",") && clean.includes(".")) {
      return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (clean.includes(",")) {
      return parseFloat(clean.replace(/\s/g, "").replace(",", ".")) || 0;
    }
    return parseFloat(clean.replace(/\s/g, "")) || 0;
  };

  const handleCurrencyInput = (val: string, setter: (v: string) => void) => {
    let clean = val.replace(/\D/g, "");
    if (!clean) {
      setter("");
      return;
    }
    const num = parseInt(clean, 10) / 100;
    setter(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };

  // Estimativa de distância via Gemini AI
  const handleEstimateDistance = async () => {
    if (!originAddress.trim() || !destinationAddress.trim()) {
      setErrorMsg("Informe a origem e o destino para estimar a distância.");
      return;
    }

    try {
      setEstimatingDistance(true);
      setErrorMsg(null);

      const res = await fetch("/api/expense-trips/estimate-distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originAddress.trim(),
          destination: destinationAddress.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao estimar distância.");
      }

      const json = await res.json();
      if (json.data?.round_trip_km) {
        setKmSuggested(json.data.round_trip_km);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao estimar rota.");
    } finally {
      setEstimatingDistance(false);
    }
  };

  // Upload de arquivo para Supabase Storage
  const uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${folder}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `expense_trips/${fileName}`;

    let { error: uploadError } = await supabase.storage.from("receipts").upload(filePath, file);
    if (uploadError) {
      const { error: fallbackError } = await supabase.storage.from("attachments").upload(filePath, file);
      if (fallbackError) {
        throw new Error("Erro no upload do anexo: " + (fallbackError.message || uploadError.message));
      }
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(filePath);
      return urlData.publicUrl;
    }

    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  // Cálculos derivados em tempo real
  const odoStartNum = parseFloat(odometerStart) || 0;
  const odoEndNum = parseFloat(odometerEnd) || 0;
  const hasEnd = odometerEnd.trim() !== "";
  const kmDrivenLive = hasEnd && odoEndNum > odoStartNum ? odoEndNum - odoStartNum : 0;
  const fuelValueLive = kmDrivenLive * 1.0;
  const mealValueLive = parseCurrency(mealAmount);
  const tollValueLive = parseCurrency(tollAmount);
  const totalValueLive = (hasEnd ? fuelValueLive : 0) + mealValueLive + tollValueLive;

  let kmDeviationLive = 0;
  let isDeviationHighLive = false;
  if (hasEnd && kmSuggested && kmSuggested > 0 && kmDrivenLive > 0) {
    kmDeviationLive = Math.round(((kmDrivenLive - kmSuggested) / kmSuggested) * 100);
    if (kmDeviationLive > 25) {
      isDeviationHighLive = true;
    }
  }

  // Submissão do Formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!prospectorId) {
      setErrorMsg("Selecione o vendedor.");
      return;
    }
    if (!tripDate) {
      setErrorMsg("Informe a data da viagem.");
      return;
    }
    if (!destinationAddress.trim()) {
      setErrorMsg("Informe o destino da viagem.");
      return;
    }
    if (!odometerStart) {
      setErrorMsg("Informe o odômetro inicial.");
      return;
    }
    const hasEnd = odometerEnd.trim() !== "";
    if (hasEnd && odoEndNum <= odoStartNum) {
      setErrorMsg("O odômetro final deve ser maior que o odômetro inicial.");
      return;
    }

    try {
      setSubmitting(true);

      // Uploads assíncronos se houver novos arquivos
      let finalStartUrl = startPhotoUrl;
      let finalEndUrl = endPhotoUrl;
      let finalMealUrl = mealReceiptUrl;
      let finalTollUrl = tollReceiptUrl;

      if (startPhotoFile) {
        finalStartUrl = await uploadFileToStorage(startPhotoFile, "odo_start");
      }
      if (endPhotoFile) {
        finalEndUrl = await uploadFileToStorage(endPhotoFile, "odo_end");
      }
      if (mealReceiptFile) {
        finalMealUrl = await uploadFileToStorage(mealReceiptFile, "meal");
      }
      if (tollReceiptFile) {
        finalTollUrl = await uploadFileToStorage(tollReceiptFile, "toll");
      }

      const payload = {
        prospector_id: prospectorId,
        trip_date: tripDate,
        origin_address: originAddress.trim(),
        destination_address: destinationAddress.trim(),
        odometer_start: odoStartNum,
        odometer_start_photo: finalStartUrl,
        odometer_end: hasEnd ? odoEndNum : null,
        odometer_end_photo: finalEndUrl,
        km_suggested: kmSuggested,
        fuel_rate_per_km: 1.0,
        meal_amount: mealValueLive,
        meal_receipt_url: finalMealUrl,
        toll_amount: tollValueLive,
        toll_receipt_url: finalTollUrl,
        observations: observations.trim() || null,
      };

      const endpoint = initialTrip ? `/api/expense-trips/${initialTrip.id}` : "/api/expense-trips";
      const method = initialTrip ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao salvar viagem.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl rounded-2xl border p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--surface-border)",
        }}
      >
        {/* Header do Modal */}
        <div
          className="flex items-center justify-between pb-3.5 mb-4 border-b"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <Car size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {initialTrip ? "Editar Viagem de Prospecção" : "Lançar Nova Viagem • Ajuda de Custos"}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Odômetros inicial/final, rota com estimativa de km e comprovantes de alimentação/pedágio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Linha 1: Vendedor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                Vendedor / Prospectador *
              </label>
              <select
                value={prospectorId}
                onChange={(e) => {
                  setProspectorId(e.target.value);
                  const p = prospectors.find((x) => x.id === e.target.value);
                  if (p?.default_origin_address) {
                    setOriginAddress(p.default_origin_address);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-amber-500 font-medium cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
                {prospectors.map((p) => (
                  <option key={p.id} value={p.id} style={{ backgroundColor: "var(--bg-secondary)" }}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                Data da Viagem *
              </label>
              <input
                type="date"
                required
                value={tripDate}
                onChange={(e) => setTripDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-amber-500 font-medium"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--surface-border)",
                  color: "var(--text-primary)",
                }}
              >
              </input>
            </div>
          </div>

          {/* Linha 2: Origem e Destino com Estimativa IA */}
          <div className="space-y-3 p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-300">
                Endereço de Origem (Saída) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  placeholder="Endereço de saída..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-amber-500 font-medium"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
                <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Destino da Viagem (Cidade / Bairro / Local) *
                </label>
                <button
                  type="button"
                  onClick={handleEstimateDistance}
                  disabled={estimatingDistance || !destinationAddress.trim()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all cursor-pointer disabled:opacity-40"
                  title="Estimar distância de ida e volta pelo trajeto mais comum"
                >
                  {estimatingDistance ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} className="text-amber-400" />
                  )}
                  <span>{estimatingDistance ? "Calculando..." : "Estimar KM (Ida e Volta)"}</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="Ex: Polo Industrial de Camaçari, Centro de Feira de Santana..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-xs outline-none border focus:border-amber-500 font-medium"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
                <MapPin size={14} className="absolute left-3 top-3 text-amber-400" />
              </div>

              {kmSuggested ? (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-blue-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>
                    Distância estimada pela IA: <strong>{kmSuggested} km</strong> (ida + volta inclusas).
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* 🍞 PÃO SUPERIOR & INFERIOR: ODÔMETROS (ALINHAMENTO RIGOROSO) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Odômetro Inicial */}
            <div
              className={`p-3.5 rounded-2xl border transition-all flex flex-col ${
                activeSlotPaste === "start"
                  ? "border-amber-400 ring-2 ring-amber-400/20"
                  : ""
              }`}
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: activeSlotPaste === "start" ? undefined : "var(--surface-border)",
              }}
            >
              {/* Header com altura fixa h-7 nivelada */}
              <div className="flex items-center justify-between h-7 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                    <Gauge size={13} />
                  </div>
                  <label className="text-xs font-bold text-amber-400 tracking-tight truncate">
                    Odômetro Inicial
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    Obrigatório
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSlotPaste(activeSlotPaste === "start" ? null : "start")}
                  className={`text-[10px] h-6 px-2.5 rounded-lg border font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    activeSlotPaste === "start"
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm animate-pulse"
                      : "text-slate-400 border-white/10 hover:text-white hover:bg-white/5"
                  }`}
                  title="Clique aqui e aperte Ctrl+V para colar a foto"
                >
                  <Copy size={10} />
                  <span>{activeSlotPaste === "start" ? "Aperte Ctrl+V" : "Colar Foto (Ctrl+V)"}</span>
                </button>
              </div>

              {/* Input de KM inicial (h-11) */}
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  value={odometerStart}
                  onChange={(e) => setOdometerStart(e.target.value)}
                  placeholder="Ex: 45210"
                  className="w-full h-11 px-3.5 pr-10 rounded-xl text-sm font-mono font-bold outline-none border focus:border-amber-500 transition-colors"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                  km
                </span>
              </div>

              {/* Subtítulo de orientação (h-5 fixa para alinhamento) */}
              <div className="h-5 flex items-center mt-1.5 mb-2">
                <span className="text-[11px] text-slate-400 truncate">
                  Registro obrigatório na saída matinal
                </span>
              </div>

              {/* Slot Foto Inicial (h-24 fixa) */}
              {startPhotoUrl ? (
                <div className="relative h-24 rounded-xl overflow-hidden border border-white/10 group bg-black/60">
                  <img
                    src={startPhotoUrl}
                    alt="Foto inicial"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() =>
                      setCropTarget({
                        slot: "start",
                        imageSrc: startPhotoUrl,
                        title: "Enquadrar e Dar Zoom no Odômetro Inicial",
                      })
                    }
                    title="Clique para ajustar o zoom e enquadramento"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropTarget({
                          slot: "start",
                          imageSrc: startPhotoUrl,
                          title: "Enquadrar e Dar Zoom no Odômetro Inicial",
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md pointer-events-auto cursor-pointer"
                      title="Editar enquadramento e dar zoom"
                    >
                      <Crop size={11} />
                      <span>Ajustar / Zoom</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartPhotoFile(null);
                        setStartPhotoUrl(null);
                      }}
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors pointer-events-auto cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="h-24 rounded-xl border border-dashed border-white/15 hover:border-amber-500/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-white/[0.01] hover:bg-amber-500/[0.03] group">
                  <Upload size={16} className="text-slate-400 group-hover:text-amber-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Anexar Foto Inicial
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Clique para selecionar ou use Ctrl+V
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectPhoto(file, "start");
                    }}
                  />
                </label>
              )}
            </div>

            {/* Odômetro Final */}
            <div
              className={`p-3.5 rounded-2xl border transition-all flex flex-col ${
                activeSlotPaste === "end"
                  ? "border-emerald-400 ring-2 ring-emerald-400/20"
                  : ""
              }`}
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: activeSlotPaste === "end" ? undefined : "var(--surface-border)",
              }}
            >
              {/* Header com altura fixa h-7 nivelada com o inicial */}
              <div className="flex items-center justify-between h-7 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <Gauge size={13} />
                  </div>
                  <label className="text-xs font-bold text-emerald-400 tracking-tight truncate">
                    Odômetro Final
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Opcional
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSlotPaste(activeSlotPaste === "end" ? null : "end")}
                  className={`text-[10px] h-6 px-2.5 rounded-lg border font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    activeSlotPaste === "end"
                      ? "bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-sm animate-pulse"
                      : "text-slate-400 border-white/10 hover:text-white hover:bg-white/5"
                  }`}
                  title="Clique aqui e aperte Ctrl+V para colar a foto"
                >
                  <Copy size={10} />
                  <span>{activeSlotPaste === "end" ? "Aperte Ctrl+V" : "Colar Foto (Ctrl+V)"}</span>
                </button>
              </div>

              {/* Input de KM final (h-11) */}
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={odometerEnd}
                  onChange={(e) => setOdometerEnd(e.target.value)}
                  placeholder="Ex: 45334"
                  className="w-full h-11 px-3.5 pr-10 rounded-xl text-sm font-mono font-bold outline-none border focus:border-emerald-500 transition-colors"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none">
                  km
                </span>
              </div>

              {/* Subtítulo de orientação (h-5 fixa exatamente igual ao inicial) */}
              <div className="h-5 flex items-center mt-1.5 mb-2">
                <span className="text-[11px] text-amber-400/90 font-medium truncate">
                  Deixe vazio se a rota estiver em andamento
                </span>
              </div>

              {/* Slot Foto Final (h-24 fixa) */}
              {endPhotoUrl ? (
                <div className="relative h-24 rounded-xl overflow-hidden border border-white/10 group bg-black/60">
                  <img
                    src={endPhotoUrl}
                    alt="Foto final"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() =>
                      setCropTarget({
                        slot: "end",
                        imageSrc: endPhotoUrl,
                        title: "Enquadrar e Dar Zoom no Odômetro Final",
                      })
                    }
                    title="Clique para ajustar o zoom e enquadramento"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropTarget({
                          slot: "end",
                          imageSrc: endPhotoUrl,
                          title: "Enquadrar e Dar Zoom no Odômetro Final",
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md pointer-events-auto cursor-pointer"
                      title="Editar enquadramento e dar zoom"
                    >
                      <Crop size={11} />
                      <span>Ajustar / Zoom</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEndPhotoFile(null);
                        setEndPhotoUrl(null);
                      }}
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors pointer-events-auto cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="h-24 rounded-xl border border-dashed border-white/15 hover:border-emerald-500/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-white/[0.01] hover:bg-emerald-500/[0.03] group">
                  <Upload size={16} className="text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Anexar Foto Final
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Opcional se em rota · Clique ou Ctrl+V
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectPhoto(file, "end");
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* 🥩 RECHEIO: ALIMENTAÇÃO & PEDÁGIO (COM FOTO OPCIONAL SEMPRE VISÍVEL E ALINHADA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Alimentação */}
            <div
              className={`p-3.5 rounded-2xl border transition-all flex flex-col ${
                activeSlotPaste === "meal"
                  ? "border-orange-400 ring-2 ring-orange-400/20"
                  : ""
              }`}
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: activeSlotPaste === "meal" ? undefined : "var(--surface-border)",
              }}
            >
              {/* Header h-7 nivelado */}
              <div className="flex items-center justify-between h-7 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                    <UtensilsCrossed size={13} />
                  </div>
                  <label className="text-xs font-bold text-orange-400 tracking-tight truncate">
                    Alimentação / Almoço
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 shrink-0">
                    Opcional
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSlotPaste(activeSlotPaste === "meal" ? null : "meal")}
                  className={`text-[10px] h-6 px-2.5 rounded-lg border font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    activeSlotPaste === "meal"
                      ? "bg-orange-500 text-slate-950 border-orange-400 font-bold shadow-sm animate-pulse"
                      : "text-slate-400 border-white/10 hover:text-white hover:bg-white/5"
                  }`}
                  title="Clique aqui e aperte Ctrl+V para colar a notinha"
                >
                  <Copy size={10} />
                  <span>{activeSlotPaste === "meal" ? "Aperte Ctrl+V" : "Colar Notinha (Ctrl+V)"}</span>
                </button>
              </div>

              {/* Input de Valor (h-11) */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="text"
                  value={mealAmount}
                  onChange={(e) => handleCurrencyInput(e.target.value, setMealAmount)}
                  placeholder="0,00"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl text-sm font-mono font-bold outline-none border focus:border-orange-500 transition-colors"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Subtítulo de orientação (h-5 fixa) */}
              <div className="h-5 flex items-center mt-1.5 mb-2">
                <span className="text-[11px] text-slate-400 truncate">
                  Reembolso com valor real gasto
                </span>
              </div>

              {/* Slot Notinha / Comprovante (h-24 fixa SEMPRE VISÍVEL) */}
              {mealReceiptUrl ? (
                <div className="relative h-24 rounded-xl overflow-hidden border border-white/10 group bg-black/60">
                  <img
                    src={mealReceiptUrl}
                    alt="Notinha Alimentação"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() =>
                      setCropTarget({
                        slot: "meal",
                        imageSrc: mealReceiptUrl,
                        title: "Enquadrar e Dar Zoom na Notinha de Alimentação",
                      })
                    }
                    title="Clique para ajustar o zoom e enquadramento"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropTarget({
                          slot: "meal",
                          imageSrc: mealReceiptUrl,
                          title: "Enquadrar e Dar Zoom na Notinha de Alimentação",
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md pointer-events-auto cursor-pointer"
                      title="Editar enquadramento e dar zoom"
                    >
                      <Crop size={11} />
                      <span>Ajustar / Zoom</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMealReceiptFile(null);
                        setMealReceiptUrl(null);
                      }}
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors pointer-events-auto cursor-pointer"
                      title="Remover notinha"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="h-24 rounded-xl border border-dashed border-white/15 hover:border-orange-500/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-white/[0.01] hover:bg-orange-500/[0.03] group">
                  <Upload size={16} className="text-slate-400 group-hover:text-orange-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Anexar Foto da Notinha
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Opcional · Clique para enviar ou Ctrl+V
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectPhoto(file, "meal");
                    }}
                  />
                </label>
              )}
            </div>

            {/* Pedágio */}
            <div
              className={`p-3.5 rounded-2xl border transition-all flex flex-col ${
                activeSlotPaste === "toll"
                  ? "border-purple-400 ring-2 ring-purple-400/20"
                  : ""
              }`}
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: activeSlotPaste === "toll" ? undefined : "var(--surface-border)",
              }}
            >
              {/* Header h-7 nivelado com Alimentação */}
              <div className="flex items-center justify-between h-7 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                    <Milestone size={13} />
                  </div>
                  <label className="text-xs font-bold text-purple-400 tracking-tight truncate">
                    Pedágio / Tarifas
                  </label>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
                    Opcional
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSlotPaste(activeSlotPaste === "toll" ? null : "toll")}
                  className={`text-[10px] h-6 px-2.5 rounded-lg border font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                    activeSlotPaste === "toll"
                      ? "bg-purple-500 text-slate-950 border-purple-400 font-bold shadow-sm animate-pulse"
                      : "text-slate-400 border-white/10 hover:text-white hover:bg-white/5"
                  }`}
                  title="Clique aqui e aperte Ctrl+V para colar o comprovante"
                >
                  <Copy size={10} />
                  <span>{activeSlotPaste === "toll" ? "Aperte Ctrl+V" : "Colar Notinha (Ctrl+V)"}</span>
                </button>
              </div>

              {/* Input de Valor (h-11) */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                  R$
                </span>
                <input
                  type="text"
                  value={tollAmount}
                  onChange={(e) => handleCurrencyInput(e.target.value, setTollAmount)}
                  placeholder="0,00"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl text-sm font-mono font-bold outline-none border focus:border-purple-500 transition-colors"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    borderColor: "var(--surface-border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* Subtítulo de orientação (h-5 fixa) */}
              <div className="h-5 flex items-center mt-1.5 mb-2">
                <span className="text-[11px] text-slate-400 truncate">
                  Reembolso de cancelas e tarifas de rota
                </span>
              </div>

              {/* Slot Notinha / Comprovante (h-24 fixa SEMPRE VISÍVEL) */}
              {tollReceiptUrl ? (
                <div className="relative h-24 rounded-xl overflow-hidden border border-white/10 group bg-black/60">
                  <img
                    src={tollReceiptUrl}
                    alt="Comprovante Pedágio"
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={() =>
                      setCropTarget({
                        slot: "toll",
                        imageSrc: tollReceiptUrl,
                        title: "Enquadrar e Dar Zoom no Comprovante de Pedágio",
                      })
                    }
                    title="Clique para ajustar o zoom e enquadramento"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-2 pointer-events-none">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCropTarget({
                          slot: "toll",
                          imageSrc: tollReceiptUrl,
                          title: "Enquadrar e Dar Zoom no Comprovante de Pedágio",
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-md pointer-events-auto cursor-pointer"
                      title="Editar enquadramento e dar zoom"
                    >
                      <Crop size={11} />
                      <span>Ajustar / Zoom</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTollReceiptFile(null);
                        setTollReceiptUrl(null);
                      }}
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors pointer-events-auto cursor-pointer"
                      title="Remover comprovante"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="h-24 rounded-xl border border-dashed border-white/15 hover:border-purple-500/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all bg-white/[0.01] hover:bg-purple-500/[0.03] group">
                  <Upload size={16} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                    Anexar Foto da Notinha
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Opcional · Clique para enviar ou Ctrl+V
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectPhoto(file, "toll");
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
              Observações do Dia / Motivo das Visitas (Opcional)
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Ex: Visita a clientes X e Y, prospecção na região norte..."
              className="w-full px-3.5 py-2 rounded-xl text-xs outline-none border focus:border-amber-500"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--surface-border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* ========================================================
              PREVIEW FINANCEIRO EM TEMPO REAL
              ======================================================== */}
          <div
            className="p-4 rounded-xl border space-y-2.5"
            style={{
              backgroundColor: "var(--bg-primary)",
              borderColor: "var(--surface-border)",
            }}
          >
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="font-semibold text-slate-300">Resumo do Percurso:</span>
              <div className="flex items-center gap-2">
                {hasEnd ? (
                  <span className="font-mono text-amber-300 font-bold">
                    {kmDrivenLive} km rodados (R$ {fuelValueLive.toFixed(2)})
                  </span>
                ) : (
                  <span className="font-mono text-amber-300 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    Em trânsito (aguardando retorno para cálculo do KM)
                  </span>
                )}
                {kmSuggested ? (
                  <span className="text-slate-400">
                    · Estimativa: <strong>{kmSuggested} km</strong>
                  </span>
                ) : null}
              </div>
            </div>

            {hasEnd && kmSuggested && isDeviationHighLive ? (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-1.5">
                <AlertTriangle size={13} className="shrink-0" />
                <span>
                  Alerta: Quilometragem rodada ({kmDrivenLive} km) supera a estimativa ({kmSuggested} km) em +{kmDeviationLive}%.
                </span>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2 border-t border-white/5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-slate-400">
                  {hasEnd ? "Total da Ajuda de Custos:" : "Total Parcial (Alimentação + Pedágio):"}
                </span>
                {!hasEnd && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Status ao salvar: Em Andamento
                  </span>
                )}
              </div>
              <span className="text-xl font-extrabold font-mono text-white">
                R$ {totalValueLive.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {!hasEnd && <span className="text-xs font-normal text-slate-400 ml-1">(parcial)</span>}
              </span>
            </div>
          </div>

          {/* Botões de Ação */}
          <div
            className="flex items-center justify-end gap-3 pt-3 border-t"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-950" />
                  <span>Salvando Viagem...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-slate-950" />
                  <span>{initialTrip ? "Salvar Alterações" : "Lançar Viagem"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Enquadramento, Zoom e Corte de Foto */}
      {cropTarget && (
        <PhotoCropModal
          isOpen={!!cropTarget}
          imageSrc={cropTarget.imageSrc}
          title={cropTarget.title}
          onClose={() => setCropTarget(null)}
          onApply={handleCropApply}
        />
      )}
    </div>
  );
}

