import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const lines = env.split("\n");
let url = "", serviceKey = "", anonKey = "";
for (let line of lines) {
  line = line.trim();
  if (line.startsWith("#") || !line.includes("=")) continue;
  const idx = line.indexOf("=");
  const key = line.substring(0, idx).trim();
  let val = line.substring(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  if (key === "NEXT_PUBLIC_SUPABASE_URL") url = val;
  if (key === "SUPABASE_SERVICE_ROLE_KEY") serviceKey = val;
  if (key === "NEXT_PUBLIC_SUPABASE_ANON_KEY") anonKey = val;
}
process.env.NEXT_PUBLIC_SUPABASE_URL = url;
process.env.SUPABASE_SERVICE_ROLE_KEY = (serviceKey && serviceKey !== "[SENSITIVE]") ? serviceKey : anonKey;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;

const csvPath = "C:\\Users\\Conectsol\\Downloads\\6a5fc6e6-746a-4424-aa04-bf6c3b8f7fd1-2026-10-21-2026-10-27.csv";
const csvText = fs.readFileSync(csvPath, "utf8");

import { parseNubankCsv } from "@/utils/nubankStatementParser";
let supabaseAdmin: any;

export const KNOWN_CORPORATE_ALIASES = [
  {
    keywords: ["caju", "recarga caju", "beneficio", "beneficios"],
    aliases: [
      "empresa brasileira de beneficios",
      "empresa brasileira de ben",
      "caju beneficios",
      "caju tecnologia",
      "caju",
      "pix.bpp.com.br",
    ],
  },
  {
    keywords: ["lima e trindade", "recarga nubank", "recarga saldo", "lima t c g f m e"],
    aliases: [
      "lima e trindade",
      "lima t c g f m e ltda",
      "45.983.838/0001-80",
      "lima trindade",
      "conectsol",
    ],
  },
  {
    keywords: ["google ads", "google", "anuncio"],
    aliases: ["google brasil internet", "google", "ebanx"],
  },
  {
    keywords: ["claro", "recarga celular", "chip"],
    aliases: ["multidisplay comercio", "multidisplay", "claro"],
  },
  {
    keywords: [
      "crea",
      "crea-ba",
      "conselho regional de engenharia",
      "cons regional de engenharia",
      "cons regional de engenharia e agronomia",
      "art crea",
      "art - crea",
      "art",
      "arts",
      "anotacao de responsabilidade tecnica"
    ],
    aliases: [
      "cons regional de engenharia e agronomia",
      "cons regional de engenharia",
      "conselho regional de engenharia",
      "conselho regional de engenharia e agronomia",
      "crea",
      "crea-ba",
      "art crea",
      "art - crea",
      "art",
      "arts"
    ],
  },
  {
    keywords: ["mercado pago", "mercado livre"],
    aliases: ["mercado pago", "mercado livre", "mercadopago"],
  },
];

function normalize(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSignificantTokens(str: string): string[] {
  const stopWords = new Set([
    "de", "da", "do", "das", "dos", "e", "em", "para", "por", "com",
    "ltda", "sa", "me", "epp", "ip", "s", "a", "transferencia", "enviada",
    "recebida", "pelo", "pix", "pagamento", "boleto", "efetuado", "banco",
    "agencia", "conta", "valor", "comprovante"
  ]);
  return normalize(str)
    .split(" ")
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

function checkEntityMatch(textA: string, textB: string): boolean {
  const normA = normalize(textA);
  const normB = normalize(textB);

  if (!normA || !normB) return false;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  for (const group of KNOWN_CORPORATE_ALIASES) {
    const aMatches = group.keywords.some((k) => {
      if (k.length <= 4) {
        return new RegExp(`(^|\\s)${k}(\\s|$)`).test(normA);
      }
      return normA.includes(k);
    }) || group.aliases.some((al) => {
      if (al.length <= 4) {
        return new RegExp(`(^|\\s)${al}(\\s|$)`).test(normA);
      }
      return normA.includes(al);
    });

    const bMatches = group.keywords.some((k) => {
      if (k.length <= 4) {
        return new RegExp(`(^|\\s)${k}(\\s|$)`).test(normB);
      }
      return normB.includes(k);
    }) || group.aliases.some((al) => {
      if (al.length <= 4) {
        return new RegExp(`(^|\\s)${al}(\\s|$)`).test(normB);
      }
      return normB.includes(al);
    });

    if (aMatches && bMatches) return true;
  }

  const tokensA = getSignificantTokens(textA);
  const tokensB = getSignificantTokens(textB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const matches = tokensA.filter((t) => tokensB.includes(t));
  if (matches.length >= 2) return true;
  if (matches.length >= 1 && matches.some((t) => t.length >= 6)) return true;

  return false;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function testEnhanced() { const sAdmin = await import("@/lib/supabaseAdmin"); supabaseAdmin = sAdmin.supabaseAdmin;
  const parsed = parseNubankCsv(csvText);

  const sortedDates = parsed.items.map((it) => it.date).sort();
  const minDate = sortedDates[0] || new Date().toISOString().slice(0, 10);
  const maxDate = sortedDates[sortedDates.length - 1] || new Date().toISOString().slice(0, 10);

  const startBuffer = new Date(minDate);
  startBuffer.setDate(startBuffer.getDate() - 25);
  const startIso = startBuffer.toISOString();

  const endBuffer = new Date(maxDate);
  endBuffer.setDate(endBuffer.getDate() + 10);
  endBuffer.setHours(23, 59, 59, 999);
  const endIso = endBuffer.toISOString();

  const [{ data: movements }, { data: cards }] = await Promise.all([
    supabaseAdmin
      .from("nubank_movements")
      .select("id, type, amount, balance_after, description, payment_request_id, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("payment_requests")
      .select("id, title, amount, pix_owner, pix_name, notes, category, splits, request_kind, cnpj, status, created_at, updated_at, due_date")
      .or("is_deleted.eq.false,is_deleted.is.null")
      .or(`created_at.gte.${startIso},updated_at.gte.${startIso}`),
  ]);

  const poolMovements = (movements || []).map((m: any) => ({
    ...m,
    amount: Number(m.amount),
    balance_after: Number(m.balance_after),
    used: false,
  }));

  const poolCards = (cards || []).map((c: any) => ({
    ...c,
    amount: Number(c.amount),
    remainingAmount: Number(c.amount),
    used: false,
    splits: (Array.isArray(c.splits) ? c.splits : []).map((s: any) => ({
      ...s,
      amount: Number(s.amount),
      used: false,
    })),
  }));

  const itemsResults: any[] = [];
  let matchedItemsCount = 0;
  let unmatchedItemsCount = 0;

  for (const item of parsed.items) {
    const itemAmtAbs = Math.abs(item.amount);
    const itemDate = item.date;
    const itemBeneficiary = item.beneficiaryOrSender || "";
    const itemFullDesc = `${item.description} ${itemBeneficiary}`;

    // FASE 1: Procura match direto em nubank_movements
    let matchedMov = poolMovements.find((m: any) => {
      if (m.used) return false;
      const movAmtAbs = Math.abs(m.amount);
      if (Math.abs(movAmtAbs - itemAmtAbs) >= 0.01) return false;
      if (item.amount > 0 && m.type === "SAIDA") return false;
      if (item.amount < 0 && m.type === "ENTRADA") return false;

      const mDate = (m.created_at || "").slice(0, 10);
      const daysDiff = Math.abs(new Date(mDate).getTime() - new Date(itemDate).getTime()) / 86400000;
      if (daysDiff > 5) return false;
      if (daysDiff <= 1) return true;
      return checkEntityMatch(itemFullDesc, m.description || "");
    });

    if (!matchedMov) {
      matchedMov = poolMovements.find((m: any) => {
        if (m.used) return false;
        const movAmtAbs = Math.abs(m.amount);
        if (Math.abs(movAmtAbs - itemAmtAbs) >= 0.01) return false;
        if (item.amount > 0 && m.type === "SAIDA") return false;
        if (item.amount < 0 && m.type === "ENTRADA") return false;

        const mDate = (m.created_at || "").slice(0, 10);
        const daysDiff = Math.abs(new Date(mDate).getTime() - new Date(itemDate).getTime()) / 86400000;
        return daysDiff <= 4;
      });
    }

    if (matchedMov) {
      matchedMov.used = true;
      matchedItemsCount++;
      itemsResults.push({
        statementItem: item,
        status: "CONCILIADO",
        matchedMovementId: matchedMov.id,
        matchedMovementDesc: matchedMov.description,
        matchedMovementDate: matchedMov.created_at,
      });
      continue;
    }

    // FASE 2: Procura correspondência inteligente em payment_requests
    let matchedCard: any = null;
    let matchNotes = "";

    // Tentativa 2A: Match exato com splits individuais não usados
    for (const card of poolCards) {
      if (card.used) continue;
      const unusedSplit = card.splits.find(
        (s: any) => !s.used && Math.abs(s.amount - itemAmtAbs) < 0.01
      );
      if (!unusedSplit) continue;

      const cardText = [
        card.title,
        card.pix_owner,
        card.pix_name,
        card.notes,
        card.category,
        card.request_kind,
        unusedSplit.pix_owner,
        unusedSplit.pix_key,
        unusedSplit.boleto_notes,
        unusedSplit.caju_phone,
      ]
        .filter(Boolean)
        .join(" ");

      const entityMatched = checkEntityMatch(itemFullDesc, cardText);
      const cDate = (card.updated_at || card.created_at || card.due_date || "").slice(0, 10);
      const daysDiff = Math.abs(new Date(cDate).getTime() - new Date(itemDate).getTime()) / 86400000;

      if ((entityMatched && daysDiff <= 20) || (daysDiff <= 3 && !entityMatched)) {
        matchedCard = card;
        unusedSplit.used = true;
        card.remainingAmount = round2(card.remainingAmount - itemAmtAbs);
        if (card.splits.every((s: any) => s.used) || card.remainingAmount <= 0.01) {
          card.used = true;
        }
        matchNotes = `Conciliado com split do card: "${card.title}" (${unusedSplit.pix_owner || card.pix_owner || card.pix_name || "Favorecido"}).`;
        break;
      }
    }

    // Tentativa 2B: Match por valor total do cartão
    if (!matchedCard) {
      for (const card of poolCards) {
        if (card.used) continue;
        const cardAmt = Number(card.amount);
        if (Math.abs(cardAmt - itemAmtAbs) >= 0.01) continue;

        const cardText = [
          card.title,
          card.pix_owner,
          card.pix_name,
          card.notes,
          card.category,
          card.request_kind,
        ]
          .filter(Boolean)
          .join(" ");

        const entityMatched = checkEntityMatch(itemFullDesc, cardText);
        const cDate = (card.updated_at || card.created_at || card.due_date || "").slice(0, 10);
        const daysDiff = Math.abs(new Date(cDate).getTime() - new Date(itemDate).getTime()) / 86400000;

        if (entityMatched && daysDiff <= 20) {
          matchedCard = card;
          card.used = true;
          card.remainingAmount = 0;
          matchNotes = `Conciliado com card: "${card.title}" (${card.pix_owner || card.pix_name || "Favorecido"}).`;
          break;
        }

        if (daysDiff <= 3) {
          matchedCard = card;
          card.used = true;
          card.remainingAmount = 0;
          matchNotes = `Vinculado por valor idêntico e data próxima: "${card.title}".`;
          break;
        }
      }
    }

    // Tentativa 2C: Match por lote / saldo restante do cartão (ex: lote de ARTs lançado no valor total de R$ 758,73 ou R$ 975,51)
    if (!matchedCard) {
      for (const card of poolCards) {
        if (card.used || card.remainingAmount < itemAmtAbs - 0.01) continue;

        const cardAmt = Number(card.amount);
        // Verifica se o valor do cartão é um múltiplo aproximado do item (ex: 758.73 = 7 * 108.39)
        const isMultiple = Math.abs((cardAmt / itemAmtAbs) - Math.round(cardAmt / itemAmtAbs)) < 0.02;
        if (!isMultiple && card.remainingAmount < itemAmtAbs) continue;

        const cardText = [
          card.title,
          card.pix_owner,
          card.pix_name,
          card.notes,
          card.category,
          card.request_kind,
        ]
          .filter(Boolean)
          .join(" ");

        const entityMatched = checkEntityMatch(itemFullDesc, cardText);
        const cDate = (card.updated_at || card.created_at || card.due_date || "").slice(0, 10);
        const daysDiff = Math.abs(new Date(cDate).getTime() - new Date(itemDate).getTime()) / 86400000;

        if (entityMatched && daysDiff <= 20) {
          matchedCard = card;
          card.remainingAmount = round2(card.remainingAmount - itemAmtAbs);
          if (card.remainingAmount <= 0.01) {
            card.used = true;
          }
          matchNotes = `Conciliado em lote com card: "${card.title}" (${round2(cardAmt - card.remainingAmount)} de ${cardAmt.toFixed(2)}).`;
          break;
        }
      }
    }

    if (matchedCard) {
      matchedItemsCount++;
      itemsResults.push({
        statementItem: item,
        status: "CONCILIADO",
        matchedPaymentRequestId: matchedCard.id,
        matchedPaymentRequestTitle: matchedCard.title,
        notes: matchNotes,
      });
    } else {
      unmatchedItemsCount++;
      itemsResults.push({
        statementItem: item,
        status: "NAO_ENCONTRADO_NO_SISTEMA",
        notes: "Lançamento bancário presente no extrato, mas não localizado no Conect Pay.",
      });
    }
  }

  console.log("=== ENHANCED RESULTS ===");
  console.log("Total items:", parsed.items.length);
  console.log("Matched count:", matchedItemsCount);
  console.log("Unmatched count:", unmatchedItemsCount);

  const creaItems = itemsResults.filter((r) => r.statementItem.description.includes("ENGENHARIA"));
  console.log("CREA items in statement:", creaItems.length);
  creaItems.forEach((r) => {
    console.log(`[${r.statementItem.date}] ${r.statementItem.amount} | Status: ${r.status} | Match: ${r.matchedPaymentRequestTitle || r.matchedMovementDesc || "NONE"} (${r.notes || ""})`);
  });
}

testEnhanced().catch(console.error);

