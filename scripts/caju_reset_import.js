/**
 * caju_reset_import.js
 * 
 * Limpa todas as tabelas Caju e reimporta:
 *  - CSV: extrato-geral-de-despesas (7).csv  → COMPRAs (saídas)
 *  - XLSX: extrato_20261028141304.xlsx       → Depósito de Créditos (entradas/recargas)
 * 
 * Saldo âncora: R$ 11.348,75 em 27/10/2026
 * Lógica: COMPRA subtrai, RECARGA (Depósito de Créditos) soma. 
 * Fim de semana → próxima segunda-feira.
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../web/.env.local') });

const { createClient } = require(path.join(__dirname, '../web/node_modules/@supabase/supabase-js'));
const XLSX = require(path.join(__dirname, '../web/node_modules/xlsx'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variáveis de ambiente não encontradas. Verifique web/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Constantes ──────────────────────────────────────────────────────────────

const ANCHOR_DATE = '2026-10-27';
const ANCHOR_TOTAL = 11348.75;

const CSV_PATH = 'C:/Users/Conectsol/Downloads/extrato-geral-de-despesas (7).csv';
const XLSX_PATH = 'C:/Users/Conectsol/Downloads/extrato_20261028141304.xlsx';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNextBusinessDay(dateStr) {
  // dateStr formato: YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay(); // 0=Dom, 6=Sab
  if (dow === 0) dt.setDate(dt.getDate() + 1); // Dom → Seg
  if (dow === 6) dt.setDate(dt.getDate() + 2); // Sab → Seg
  return dt.toISOString().slice(0, 10);
}

function parseBrDate(dateStr) {
  // Suporta "28-09-2026 07:46:53" ou "27/10/2026 15:29"
  let day, month, year;
  if (dateStr.includes('-') && dateStr.indexOf('-') === 2) {
    // dd-mm-yyyy HH:MM:SS
    [day, month, year] = dateStr.slice(0, 10).split('-').map(Number);
  } else {
    // dd/mm/yyyy HH:MM
    [day, month, year] = dateStr.slice(0, 10).split('/').map(Number);
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function parseAmount(val) {
  if (typeof val === 'number') return Math.abs(val);
  // "R$ 9,00" → 9.00
  return parseFloat(
    String(val).replace(/R\$\s?Â?\s?/g, '').replace(/\./g, '').replace(',', '.').trim()
  );
}

// ─── Leitura do CSV (COMPRAS) ────────────────────────────────────────────────

function parseCsv() {
  const content = fs.readFileSync(CSV_PATH, { encoding: 'latin1' });
  const lines = content.split('\n').filter(l => l.trim());
  const header = lines[0].split(';');
  
  // Encontrar índices das colunas
  const normalize = s => s.replace(/[^a-zA-Z ]/g, '').toLowerCase().trim();
  const idx = {};
  header.forEach((h, i) => {
    const n = normalize(h);
    if (n.includes('nome do colabor')) idx.collaborator = i;
    if (n.includes('cpf')) idx.cpf = i;
    if (n.includes('tipo de transa')) idx.tipo = i;
    if (n.includes('nome do estabele')) idx.merchant = i;
    if (n.includes('valor')) idx.value = i;
    if (n.includes('data')) idx.date = i;
    if (n.includes('status da transa')) idx.status = i;
    if (n.includes('categoria')) idx.category = i;
    if (n.includes('nome do adiantamento')) idx.advance = i;
  });

  console.log('CSV column indices:', idx);

  const transactions = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const status = (cols[idx.status] || '').trim();
    const tipo = (cols[idx.tipo] || '').trim();

    // Só processar Compras Completas
    if (tipo !== 'Compra') { skipped++; continue; }
    if (status !== 'Completa') { skipped++; continue; }

    const rawDate = parseBrDate((cols[idx.date] || '').trim());
    const effectiveDate = getNextBusinessDay(rawDate);
    const amount = parseAmount(cols[idx.value]);

    if (!amount || isNaN(amount)) { skipped++; continue; }

    transactions.push({
      tx_type: 'COMPRA',
      raw_date: rawDate,
      effective_date: effectiveDate,
      amount: amount,
      collaborator_name: (cols[idx.collaborator] || '').trim(),
      collaborator_cpf: (cols[idx.cpf] || '').replace(/[^0-9]/g, '').trim(),
      merchant_name: (cols[idx.merchant] || '').trim(),
      category: (cols[idx.category] || '').trim(),
      advance_name: (cols[idx.advance] || '').trim(),
      status: 'Completa',
      source: 'CSV',
    });
  }

  console.log(`CSV: ${transactions.length} compras importadas, ${skipped} ignoradas`);
  return transactions;
}

// ─── Leitura do XLSX (RECARGAS) ──────────────────────────────────────────────

function parseXlsx() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Header is row index 3, data starts at row index 4
  const rows = data.slice(4).filter(r => r[0] && typeof r[0] === 'string' && r[0].includes('/'));

  const transactions = [];

  for (const row of rows) {
    const [dateStr, tipoAcao, idPedido, acao, formaPag, nomeColab, , cpfCnpj, , valor] = row;

    // Só importar "Depósito de Créditos" (as recargas que fazemos via Pix)
    if (!acao || acao !== 'Depósito de Créditos') continue;

    const rawDate = parseBrDate(String(dateStr).trim());
    const effectiveDate = getNextBusinessDay(rawDate);
    const amount = Math.abs(Number(valor));

    if (!amount || isNaN(amount)) continue;

    transactions.push({
      tx_type: 'RECARGA',
      raw_date: rawDate,
      effective_date: effectiveDate,
      amount: amount,
      collaborator_name: '-',
      collaborator_cpf: '',
      merchant_name: 'Depósito de Créditos Caju',
      category: 'Recarga',
      advance_name: '',
      status: 'Completa',
      source: 'XLSX',
    });
  }

  console.log(`XLSX: ${transactions.length} recargas importadas`);
  return transactions;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🗑️  STEP 1: Limpando tabelas Caju...');

  // Limpar em ordem (respeitar FK constraints)
  const tables = [
    'caju_daily_closings',
    'caju_movements',
    'caju_transactions',
    'caju_collaborators',
    'caju_import_batches',
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log(`  ⚠️  Tabela ${table} não existe — pulando`);
      } else {
        console.error(`  ❌ Erro ao limpar ${table}:`, error.message);
      }
    } else {
      console.log(`  ✅ ${table} limpa`);
    }
  }

  // Resetar wallet
  console.log('\n💰 STEP 2: Resetando caju_wallet...');
  const { data: walletRows } = await supabase.from('caju_wallet').select('id').limit(1);
  
  if (walletRows && walletRows.length > 0) {
    const { error: wErr } = await supabase.from('caju_wallet').update({
      free_balance: ANCHOR_TOTAL,
      card_balance: 0,
      cutoff_at: `${ANCHOR_DATE}T12:00:00-03:00`,
      updated_at: new Date().toISOString(),
    }).eq('id', walletRows[0].id);
    if (wErr) console.error('  ❌ Erro wallet update:', wErr.message);
    else console.log(`  ✅ Wallet resetada: R$ ${ANCHOR_TOTAL} em ${ANCHOR_DATE}`);
  } else {
    const { error: wErr } = await supabase.from('caju_wallet').insert({
      free_balance: ANCHOR_TOTAL,
      card_balance: 0,
      cutoff_at: `${ANCHOR_DATE}T12:00:00-03:00`,
    });
    if (wErr) console.error('  ❌ Erro wallet insert:', wErr.message);
    else console.log(`  ✅ Wallet criada: R$ ${ANCHOR_TOTAL} em ${ANCHOR_DATE}`);
  }

  // Parsear arquivos
  console.log('\n📂 STEP 3: Parseando arquivos...');
  const csvTxs = parseCsv();
  const xlsxTxs = parseXlsx();
  const allTxs = [...csvTxs, ...xlsxTxs];
  console.log(`Total combinado: ${allTxs.length} transações`);

  // Criar batch de importação
  console.log('\n📦 STEP 4: Criando batch de importação...');
  const { data: batchData, error: batchErr } = await supabase
    .from('caju_import_batches')
    .insert({
      filename: 'reimport_2026_10_28',
      rows_imported: allTxs.length,
      status: 'processing',
    })
    .select()
    .single();

  if (batchErr) {
    console.error('❌ Erro ao criar batch:', batchErr.message);
    return;
  }
  const batchId = batchData.id;
  console.log(`  ✅ Batch criado: ${batchId}`);

  // Inserir transações em lotes de 200
  console.log('\n📥 STEP 5: Inserindo transações...');
  const CHUNK = 200;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < allTxs.length; i += CHUNK) {
    const chunk = allTxs.slice(i, i + CHUNK).map(tx => ({
      ...tx,
      import_batch_id: batchId,
    }));

    const { error: insErr } = await supabase.from('caju_transactions').insert(chunk);
    if (insErr) {
      console.error(`  ❌ Erro no chunk ${i}-${i + chunk.length}:`, insErr.message);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
      process.stdout.write(`  ✅ ${inserted}/${allTxs.length} inseridas...\r`);
    }
  }
  console.log(`\n  Total inseridas: ${inserted}, erros: ${errors}`);

  // Atualizar batch status
  await supabase.from('caju_import_batches').update({ 
    status: errors === 0 ? 'success' : 'partial',
    rows_imported: inserted,
  }).eq('id', batchId);

  // Verificar resultado
  console.log('\n🔍 STEP 6: Verificando resultado...');
  const { count: totalCount } = await supabase
    .from('caju_transactions')
    .select('*', { count: 'exact', head: true });

  const { count: compraCount } = await supabase
    .from('caju_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('tx_type', 'COMPRA');

  const { count: recargaCount } = await supabase
    .from('caju_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('tx_type', 'RECARGA');

  console.log(`  Total na base: ${totalCount}`);
  console.log(`  COMPRAs: ${compraCount}`);
  console.log(`  RECARGAs: ${recargaCount}`);

  console.log('\n✨ Importação concluída! Acesse localhost:3000/caju para verificar.');
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
