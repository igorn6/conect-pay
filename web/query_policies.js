const { Client } = require('pg');

const connectionString = "postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'profiles';
  `);
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
