const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const userRes = await client.query(`SELECT id FROM auth.users WHERE email = 'igornaraujo6@gmail.com'`);
  if (userRes.rows.length > 0) {
    const userId = userRes.rows[0].id;
    const res = await client.query(`UPDATE public.profiles SET role = 'MASTER' WHERE id = $1 RETURNING *`, [userId]);
    console.log('Updated profile:', res.rows);
  } else {
    console.log('User not found in auth.users');
  }
  await client.end();
}

run().catch(console.error);