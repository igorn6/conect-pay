const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres' });
client.connect().then(() => client.query("SELECT id, email, raw_user_meta_data FROM auth.users")).then(res => { 
  const rodigos = res.rows.filter(r => JSON.stringify(r.raw_user_meta_data).toLowerCase().includes('rodrigo'));
  console.table(rodigos); 
  client.end(); 
})
