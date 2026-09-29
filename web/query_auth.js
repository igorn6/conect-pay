const { Client } = require('pg');

const connectionString = "postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`
    SELECT id, email FROM auth.users WHERE id = 'ad695c05-0bee-4ed7-8296-528485bd94a3';
  `);
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
