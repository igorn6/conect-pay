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

async function preview() {
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  const { data: cards } = await supabaseAdmin
    .from("payment_requests")
    .select("id, title, category, pix_owner, pix_name, splits, amount")
    .or("category.ilike.%CREA%,title.ilike.%CREA%,title.ilike.%ART%")
    .order("created_at", { ascending: false });

  const targetCards = (cards || []).filter(c => {
    const isCrea = (c.category || "").toUpperCase().includes("CREA") ||
                   (c.title || "").toUpperCase().includes("CREA") ||
                   (c.title || "").toUpperCase().startsWith("ART");
    // Make sure we dont touch non-crea cards like "REEMBOLSO PARA O CARTÃO" or "Hospedagem"
    return isCrea && (c.category || "").toUpperCase().includes("ART - CREA");
  });

  console.log(`Found ${targetCards.length} cards to update:`);
  targetCards.forEach(c => {
    console.log(`[${c.id}] ${c.title} (R$ ${c.amount}) - current pix_owner: "${c.pix_owner}"`);
  });
}
preview();
