export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CreateExpenseTripPayload } from "@/types/database";

// GET /api/expense-trips
export async function GET(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const prospectorId = searchParams.get("prospector_id");
    const status = searchParams.get("status");
    const month = searchParams.get("month"); // formato: "YYYY-MM"

    let query = supabaseAdmin
      .from("expense_trips")
      .select("*, prospector:prospectors(id, name, default_origin_address)", { count: "exact" })
      .order("trip_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (prospectorId) {
      query = query.eq("prospector_id", prospectorId);
    }
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const nextMonth = m === 12 ? `${year + 1}-01-01` : `${year}-${String(m + 1).padStart(2, "0")}-01`;
      query = query.gte("trip_date", start).lt("trip_date", nextMonth);
    }

    const { data: trips, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calcular resumo do mês atual (ou do filtro de mês selecionado)
    const allTrips = trips || [];
    const stats = {
      total_paid: allTrips.filter((t) => t.status === "PAGO").reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0),
      total_pending: allTrips.filter((t) => t.status === "PENDENTE" || t.status === "APROVADO").reduce((sum, t) => sum + (Number(t.total_amount) || 0), 0),
      total_in_progress: allTrips.filter((t) => t.status === "EM_ANDAMENTO").length,
      total_km: allTrips.reduce((sum, t) => sum + (Number(t.km_driven) || 0), 0),
      count: allTrips.length,
    };

    return NextResponse.json({ data: allTrips, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}

// POST /api/expense-trips
export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body: CreateExpenseTripPayload = await req.json().catch(() => ({}));

    if (!body.prospector_id) {
      return NextResponse.json({ error: "Vendedor / Prospector é obrigatório." }, { status: 400 });
    }
    if (!body.trip_date) {
      return NextResponse.json({ error: "Data da viagem é obrigatória." }, { status: 400 });
    }
    if (!body.origin_address?.trim() || !body.destination_address?.trim()) {
      return NextResponse.json({ error: "Origem e destino são obrigatórios." }, { status: 400 });
    }

    const odoStart = Number(body.odometer_start);
    if (!Number.isFinite(odoStart) || odoStart < 0) {
      return NextResponse.json({ error: "Odômetro inicial é obrigatório e deve ser numérico." }, { status: 400 });
    }

    const hasEnd = body.odometer_end !== undefined && body.odometer_end !== null && String(body.odometer_end).trim() !== "";
    const odoEnd = hasEnd ? Number(body.odometer_end) : null;

    if (odoEnd !== null) {
      if (!Number.isFinite(odoEnd)) {
        return NextResponse.json({ error: "Odômetro final deve ser numérico." }, { status: 400 });
      }
      if (odoEnd <= odoStart) {
        return NextResponse.json({ error: "O odômetro final deve ser maior que o odômetro inicial." }, { status: 400 });
      }
    }

    const meal = Number(body.meal_amount) || 0;
    const toll = Number(body.toll_amount) || 0;

    if (meal < 0 || toll < 0) {
      return NextResponse.json({ error: "Valores de alimentação e pedágio não podem ser negativos." }, { status: 400 });
    }

    // Status inicial: se não tem odômetro final, fica "EM_ANDAMENTO". Se já tem, "PENDENTE"
    const initialStatus = body.status || (odoEnd !== null ? "PENDENTE" : "EM_ANDAMENTO");

    const insertData: Record<string, any> = {
      prospector_id: body.prospector_id,
      trip_date: body.trip_date,
      origin_address: body.origin_address.trim(),
      destination_address: body.destination_address.trim(),
      odometer_start: odoStart,
      odometer_start_photo: body.odometer_start_photo || null,
      odometer_end: odoEnd,
      odometer_end_photo: body.odometer_end_photo || null,
      km_suggested: body.km_suggested ? Number(body.km_suggested) : null,
      fuel_rate_per_km: body.fuel_rate_per_km ? Number(body.fuel_rate_per_km) : 1.0,
      meal_amount: meal,
      meal_receipt_url: body.meal_receipt_url || null,
      toll_amount: toll,
      toll_receipt_url: body.toll_receipt_url || null,
      status: initialStatus,
      observations: body.observations ? String(body.observations).trim() : null,
      created_by: auth.userId,
    };

    const { data, error } = await supabaseAdmin
      .from("expense_trips")
      .insert([insertData])
      .select("*, prospector:prospectors(id, name, default_origin_address)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}

