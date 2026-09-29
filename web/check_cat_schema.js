const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'categories';
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run().catch(console.error);
