export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { authorize } from "@/lib/nubankBalance";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { v4 as uuidv4 } from "uuid";
import { sendPushNotification } from "@/lib/pushNotifications";

const DEFAULT_RECHARGE_PIX_OWNER = "Lima e Trindade";
const DEFAULT_RECHARGE_CNPJ = "CNPJ 2";
const DEFAULT_RECHARGE_AMOUNT = 1500.00;

function parseBRL(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val !== "string") return NaN;
  const clean = val.trim().replace(/^R\$\s*/i, "").trim();
  if (!clean) return NaN;
  if (clean.includes(",") && clean.includes(".")) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }
  if (clean.includes(",")) {
    return parseFloat(clean.replace(/\s/g, "").replace(",", "."));
  }
  return parseFloat(clean.replace(/\s/g, ""));
}

export async function POST(req: Request) {
  try {
    const reqBody = await req.json().catch(() => ({}));
    const rawAmount = reqBody?.amount;
    const paymentType = ((reqBody?.payment_type || reqBody?.paymentType || "BOLETO") as string).toUpperCase();
    const barcode = ((reqBody?.boleto_barcode || reqBody?.barcode || "") as string).trim();
    const pixKey = ((reqBody?.pix_key || reqBody?.pixKey || "") as string).trim();
    const pixOwner = ((reqBody?.pix_owner || reqBody?.pixOwner || DEFAULT_RECHARGE_PIX_OWNER) as string).trim();
    const cnpj = ((reqBody?.cnpj || DEFAULT_RECHARGE_CNPJ) as string).trim();
    const notes = ((reqBody?.notes || "Recarga saldo Nubank") as string).trim();
    const providedUserId = reqBody?.userId || req.headers.get("x-user-id");
    const providedName = ((reqBody?.requesterName || "") as string).trim();

    const auth = await authorize(["MASTER", "FINANCEIRO"], req, providedUserId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Identificar o nome do solicitante
    let requesterName = providedName;
    if (!requesterName) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name")
        .eq("id", auth.userId)
        .maybeSingle();

      if (profile?.name) {
        requesterName = profile.name;
      } else {
        requesterName = auth.name || "Solicitante";
      }
    }

    // Due date (D+3 úteis)
    const d = new Date();
    let added = 0;
    while (added < 3) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }

    const parsedAmount = parseBRL(rawAmount);
    const amountNum = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : DEFAULT_RECHARGE_AMOUNT;

    const formattedAmount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amountNum);

    const identifier = paymentType === "BOLETO" ? (barcode || "") : (pixKey || "");

    const splitId = uuidv4();
    const cardData = {
      title: `Recarga Nubank - ${formattedAmount}`,
      notes: notes,
      amount: amountNum,
      category: "Recarga de Saldo",
      cnpj: cnpj,
      payment_method: paymentType,
      payment_type: paymentType,
      pix_name: pixOwner,
      pix_owner: pixOwner,
      pix_key: paymentType === "PIX" ? pixKey : "",
      status: "NOVA_SOLICITACAO",
      stage_history: [
        {
          stage: "NOVA_SOLICITACAO",
          entered_at: new Date().toISOString(),
          left_at: null,
          duration_seconds: null,
          moved_by: auth.userId,
        },
      ],
      created_by: auth.userId,
      real_requester_id: auth.userId,
      due_date: d.toISOString(),
      request_kind: "RECARGA_NUBANK",
      balance_processed: false,
      splits: [
        {
          id: splitId,
          payment_type: paymentType,
          amount: amountNum,
          pix_owner: pixOwner,
          pix_key: paymentType === "PIX" ? pixKey : "",
          caju_phone: null,
          boleto_barcode: paymentType === "BOLETO" ? (barcode || null) : null,
          boleto_due_date: null,
          boleto_notes: null,
        },
      ],
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("payment_requests")
      .insert([cardData])
      .select()
      .single();

    if (insertError) {
      console.error("[API request-recharge] Erro ao inserir card:", insertError);
      return NextResponse.json({ error: "Falha ao criar solicitação no Kanban: " + insertError.message }, { status: 500 });
    }

    // Disparar Push Notification
    sendPushNotification({
      title: "Nova Solicitação de Recarga Nubank!",
      body: `Recarga Nubank - ${formattedAmount} por ${requesterName}`,
      url: "/kanban",
      targetRoles: ["MASTER", "FINANCEIRO"],
      excludeUserId: auth.userId,
    }).catch((e) => console.warn("Falha no push de recarga:", e));

    // Formatar e-mail padronizado para Tássio
    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? "Bom dia" : "Boa tarde";
    const subject = `Pagamento Ref. Recarga Nubank | ${cnpj}`;
    const displayIdentifier = identifier || "(não informada)";
    const body = `--\n${greeting}, Tassio!\n\nSolicito por meio deste o pagamento:\n\nMotivo: ${notes}\nValor: ${formattedAmount}\nChave pix / Linha digitável: ${displayIdentifier}\nTitular: ${pixOwner}\nSolicitante: ${requesterName}`;

    return NextResponse.json({
      ok: true,
      card: inserted,
      email: {
        to: "tassiolimacs@gmail.com",
        subject,
        body,
        encodedSubject: encodeURIComponent(subject),
        encodedBody: encodeURIComponent(body),
      },
    });
  } catch (err: any) {
    console.error("[API request-recharge POST]", err);
    return NextResponse.json({ error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}

