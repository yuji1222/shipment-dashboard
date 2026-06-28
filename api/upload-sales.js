import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { verifyToken } from './_adminAuth.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { token, filename, dataBase64 } = req.body || {};
  if (!verifyToken(token)) {
    res.status(401).json({ error: '認証が必要です。再ログインしてください' });
    return;
  }
  if (!dataBase64) {
    res.status(400).json({ error: 'ファイルが指定されていません' });
    return;
  }

  let workbook;
  try {
    workbook = XLSX.read(Buffer.from(dataBase64, 'base64'), { type: 'buffer' });
  } catch {
    res.status(400).json({ error: 'xlsxファイルの読み込みに失敗しました' });
    return;
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (!rows.length) {
    res.status(400).json({ error: 'シートにデータがありません' });
    return;
  }

  const header = rows[0];
  const idxDate = header.indexOf('売上日');
  const idxAmount = header.indexOf('金額');
  if (idxDate === -1 || idxAmount === -1) {
    res.status(400).json({ error: '「売上日」または「金額」列が見つかりません' });
    return;
  }

  const totals = {};
  for (const row of rows.slice(1)) {
    const rawDate = row?.[idxDate];
    const amount = row?.[idxAmount];
    if (typeof rawDate !== 'number' || typeof amount !== 'number') continue;

    const s = String(rawDate);
    if (!/^\d{8}$/.test(s)) continue;
    const saleDate = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    totals[saleDate] = (totals[saleDate] || 0) + amount;
  }

  const entries = Object.entries(totals);
  if (!entries.length) {
    res.status(400).json({ error: '有効な売上日のデータが見つかりませんでした' });
    return;
  }

  const uploadedAt = new Date().toISOString();
  const records = entries.map(([sale_date, amount]) => ({
    sale_date,
    amount,
    source_filename: filename || null,
    uploaded_at: uploadedAt,
  }));

  const { error } = await supabase.from('daily_sales').upsert(records, { onConflict: 'sale_date' });
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ dates: entries.map(([date, amount]) => ({ date, amount })) });
}
