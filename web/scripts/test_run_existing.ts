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

async function test() {
  const { parseNubankCsv } = await import("@/utils/nubankStatementParser");
  const { reconcileStatement } = await import("@/lib/nubankReconciliation");

  const parsed = parseNubankCsv(csvText);
  console.log("Parsed items:", parsed.items.length);
  const report = await reconcileStatement(parsed);
  console.log("Total items:", report.totalItems);
  console.log("Matched:", report.matchedItemsCount);
  console.log("Unmatched:", report.unmatchedItemsCount);

  const creaItems = report.itemsResults.filter(r => r.statementItem.description.includes("ENGENHARIA"));
  console.log("CREA items in statement:", creaItems.length);
  creaItems.forEach((r, idx) => {
    console.log(`[${r.statementItem.date}] ${r.statementItem.amount} | Status: ${r.status} | Match: ${r.matchedPaymentRequestTitle || r.matchedMovementDesc || "NONE"}`);
  });
}
test().catch(e => console.error(e));
