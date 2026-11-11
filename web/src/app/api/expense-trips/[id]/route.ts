export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { UpdateExpenseTripPayload, ExpenseTripStatus } from "@/types/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/expense-trips/[id]
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const body: UpdateExpenseTripPayload = await req.json().catch(() => ({}));
    const updatePayload: Record<string, any> = { ...body };

    // Validação de odômetro se ambos forem passados
    if (body.odometer_start !== undefined && body.odometer_end !== undefined) {
      if (Number(body.odometer_end) <= Number(body.odometer_start)) {
        return NextResponse.json({ error: "Odômetro final deve ser maior que o inicial." }, { status: 400 });
      }
    }

    // Se o odômetro final foi preenchido e estava EM_ANDAMENTO, avança para PENDENTE
    if (!body.status && body.odometer_end) {
      const { data: current } = await supabaseAdmin.from("expense_trips").select("status").eq("id", id).single();
      if (current?.status === "EM_ANDAMENTO") {
        updatePayload.status = "PENDENTE";
      }
    }

    // Auditoria de transições de status
    if (body.status || updatePayload.status) {
      const newStatus = (body.status || updatePayload.status) as ExpenseTripStatus;
      if (newStatus === "APROVADO") {
        updatePayload.approved_by = auth.userId;
        updatePayload.approved_at = new Date().toISOString();
      } else if (newStatus === "PAGO") {
        updatePayload.paid_by = auth.userId;
        updatePayload.paid_at = new Date().toISOString();
      } else if (newStatus === "PENDENTE" || newStatus === "EM_ANDAMENTO") {
        updatePayload.approved_by = null;
        updatePayload.approved_at = null;
        updatePayload.paid_by = null;
        updatePayload.paid_at = null;
      }
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("expense_trips")
      .update(updatePayload)
      .eq("id", id)
      .select("*, prospector:prospectors(id, name, default_origin_address)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}

// DELETE /api/expense-trips/[id]
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("expense_trips")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}

