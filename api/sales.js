import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { start, end } = req.query;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    res.status(400).json({ error: '日付の形式が正しくありません' });
    return;
  }

  const { data, error } = await supabase
    .from('daily_sales')
    .select('sale_date, amount')
    .gte('sale_date', start)
    .lte('sale_date', end);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const result = {};
  for (const row of data) result[row.sale_date] = Number(row.amount);
  res.status(200).json(result);
}
