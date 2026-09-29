require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from("categories")
    .insert([{ name: "TesteCat", color: "bg-gray-500" }]);
  console.log("Categories Error:", error);

  const { data: sData, error: sError } = await supabase
    .from("sectors")
    .insert([{ name: "TesteSec" }]);
  console.log("Sectors Error:", sError);
}
run();
