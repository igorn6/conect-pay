const { Client } = require('pg');
const connectionString = "postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`SELECT id, email, created_at FROM auth.users WHERE email LIKE '%rodrigolima%';`);
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
