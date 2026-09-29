const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres'
});
async function run() {
  await client.connect();
  
  await client.query(`UPDATE sectors SET name = 'Instalação' WHERE name LIKE 'Instala%'`);
  await client.query(`UPDATE sectors SET name = 'Pós-Vendas' WHERE name LIKE 'P%s-Vendas'`);
  
  const res = await client.query('SELECT * FROM sectors');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
run().catch(console.error);
