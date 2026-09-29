const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Lohan007...@db.mbdsrkicgqkqtlpwozem.supabase.co:5432/postgres' });
client.connect().then(() => client.query("SELECT id, name, role FROM public.profiles WHERE name ILIKE '%rodrigo%'")).then(res => { console.table(res.rows); client.end(); })
