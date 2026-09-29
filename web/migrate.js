const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  
  // 1. Create sectors table
  await client.query(`
    CREATE TABLE IF NOT EXISTS sectors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      is_deleted BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  
  // 2. Insert default sectors if empty
  const res = await client.query('SELECT count(*) FROM sectors');
  if (parseInt(res.rows[0].count) === 0) {
    const defaultSectors = [
      'Almoxarifado', 'TI', 'Instalação', 'Marketing', 'Aluguel de Gerador', 'Pós-Vendas', 'Financeiro'
    ];
    for (const s of defaultSectors) {
      await client.query(`INSERT INTO sectors (name) VALUES ($1) ON CONFLICT DO NOTHING`, [s]);
    }
  }

  // 3. Add must_change_password to profiles
  await client.query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
  `);

  console.log("Migration successful!");
  await client.end();
}

run().catch(console.error);
