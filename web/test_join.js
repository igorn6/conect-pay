require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
  const { data, error } = await supabase
    .from("payment_requests")
    .select("*, requester:profiles!payment_requests_real_requester_id_fkey(name), creator:profiles!payment_requests_created_by_fkey(name)")
    .limit(1);
    
  if (error) {
    console.log("Error joining:", error.message);
    const { data: d2, error: e2 } = await supabase.from("payment_requests").select("*, profiles(name)").limit(1);
    if (e2) console.log("Error joining 2:", e2.message);
    else console.log("Success joining 2", JSON.stringify(d2));
  } else {
    console.log("Success joining", JSON.stringify(data));
  }
}

testJoin();
