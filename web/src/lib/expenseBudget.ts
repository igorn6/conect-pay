import type { ExpenseTrip } from "@/types/database";

export const ANDREIA_SOFT_LIMIT_BRL = 2000;
export const ANDREIA_HARD_CEILING_BRL = 3000;

export type BudgetAlertLevel = "OK" | "WARNING_2K" | "CRITICAL_3K";

export interface MonthlyExpenseBudgetSummary {
  softLimit: number;
  hardCeiling: number;
  fuelTotal: number;
  mealTotal: number;
  tollTotal: number;
  totalSpent: number;
  paidTotal: number;
  openTotal: number;
  totalKm: number;
  tripsCount: number;
  pctOfSoftLimit: number;
  ceilingBarFillPct: number;
  softMarkerPct: number;
  remainingToSoft: number;
  exceededSoftBy: number;
  remainingToCeiling: number;
  exceededCeilingBy: number;
  level: BudgetAlertLevel;
}

function normalizeName(val: string | null | undefined): string {
  return (val || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getTripBreakdown(trip: ExpenseTrip) {
  const isInProgress =
    trip.status === "EM_ANDAMENTO" || trip.odometer_end == null;
  const kmDriven = !isInProgress
    ? Number(trip.km_driven) || Math.max(0, (trip.odometer_end ?? 0) - trip.odometer_start)
    : 0;
  const fuel = !isInProgress
    ? Number(trip.fuel_amount) || kmDriven * Number(trip.fuel_rate_per_km || 1)
    : 0;
  const meal = Number(trip.meal_amount) || 0;
  const toll = Number(trip.toll_amount) || 0;
  const total = Number(trip.total_amount) || fuel + meal + toll;

  return { isInProgress, kmDriven, fuel, meal, toll, total };
}

/**
 * Calcula o consumo acumulado no mês frente ao limite de alerta (R$ 2.000)
 * e ao teto máximo absoluto (R$ 3.000), somando combustível (km), alimentação e pedágio.
 */
export function computeMonthlyExpenseBudget(
  trips: ExpenseTrip[],
  options?: {
    andreiaProspectorId?: string | null;
    softLimit?: number;
    hardCeiling?: number;
  }
): MonthlyExpenseBudgetSummary {
  const softLimit = options?.softLimit ?? ANDREIA_SOFT_LIMIT_BRL;
  const hardCeiling = options?.hardCeiling ?? ANDREIA_HARD_CEILING_BRL;
  const andreiaId = options?.andreiaProspectorId ?? null;

  const targetTrips = trips.filter((t) => {
    if (andreiaId) return t.prospector_id === andreiaId;
    if (t.prospector?.name) {
      return normalizeName(t.prospector.name).includes("andreia");
    }
    return true;
  });

  let fuelTotal = 0;
  let mealTotal = 0;
  let tollTotal = 0;
  let totalSpentRaw = 0;
  let paidTotal = 0;
  let openTotal = 0;
  let totalKm = 0;

  for (const trip of targetTrips) {
    const b = getTripBreakdown(trip);
    fuelTotal += b.fuel;
    mealTotal += b.meal;
    tollTotal += b.toll;
    totalSpentRaw += b.total;
    totalKm += b.kmDriven;
    if (trip.status === "PAGO") {
      paidTotal += b.total;
    } else {
      openTotal += b.total;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  fuelTotal = round2(fuelTotal);
  mealTotal = round2(mealTotal);
  tollTotal = round2(tollTotal);
  const totalSpent = round2(totalSpentRaw);
  paidTotal = round2(paidTotal);
  openTotal = round2(openTotal);

  const pctOfSoftLimit =
    softLimit > 0 ? Math.round((totalSpent / softLimit) * 1000) / 10 : 0;
  const ceilingBarFillPct =
    hardCeiling > 0
      ? Math.min(100, Math.round((totalSpent / hardCeiling) * 1000) / 10)
      : 0;
  const softMarkerPct =
    hardCeiling > 0 ? Math.round((softLimit / hardCeiling) * 1000) / 10 : 66.7;

  const remainingToSoft = round2(Math.max(0, softLimit - totalSpent));
  const exceededSoftBy = round2(Math.max(0, totalSpent - softLimit));
  const remainingToCeiling = round2(Math.max(0, hardCeiling - totalSpent));
  const exceededCeilingBy = round2(Math.max(0, totalSpent - hardCeiling));

  let level: BudgetAlertLevel = "OK";
  if (totalSpent >= hardCeiling) {
    level = "CRITICAL_3K";
  } else if (totalSpent >= softLimit) {
    level = "WARNING_2K";
  }

  return {
    softLimit,
    hardCeiling,
    fuelTotal,
    mealTotal,
    tollTotal,
    totalSpent,
    paidTotal,
    openTotal,
    totalKm: Math.round(totalKm * 10) / 10,
    tripsCount: targetTrips.length,
    pctOfSoftLimit,
    ceilingBarFillPct,
    softMarkerPct,
    remainingToSoft,
    exceededSoftBy,
    remainingToCeiling,
    exceededCeilingBy,
    level,
  };
}

