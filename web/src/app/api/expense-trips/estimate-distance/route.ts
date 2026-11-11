export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { estimateRealRouteDistance } from "@/lib/routing";

// POST /api/expense-trips/estimate-distance
export async function POST(req: Request) {
  try {
    const auth = await authorize(["MASTER", "FINANCEIRO", "GESTOR"], req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const { origin, destination } = body || {};

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "Origem e destino são obrigatórios para estimar a distância." },
        { status: 400 }
      );
    }

    const estimate = await estimateRealRouteDistance({
      origin: String(origin),
      destination: String(destination),
    });

    return NextResponse.json({ data: estimate });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro ao estimar distância." }, { status: 500 });
  }
}

