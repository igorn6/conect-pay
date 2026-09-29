const fs = require("fs");
const path = require("path");
const envContent = fs.readFileSync(path.join(__dirname, ".env.local"), "utf8");
const envObj = {};
envContent.split("\n").forEach(line => {
  const [key, ...val] = line.split("=");
  if (key && val.length) {
    envObj[key.trim()] = val.join("=").trim().replace(/"/g, '');
  }
});

const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  envObj.NEXT_PUBLIC_SUPABASE_URL,
  envObj.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from("categories")
    .insert([{ name: "TesteCatCLI", color: "bg-gray-500" }]);
  console.log("Categories Error:", error);
}
run();
