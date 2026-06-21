import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'shipment-data';
const FOLDER = 'data';

export default async function handler(req, res) {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: '日付の形式が正しくありません' });
    return;
  }

  const { data, error } = await supabase.storage.from(BUCKET).download(`${FOLDER}/${date}.csv`);
  if (error) {
    res.status(404).json({ error: error.message });
    return;
  }

  const buf = await data.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if ((text.match(/�/g) || []).length > 3) {
    text = new TextDecoder('Shift_JIS').decode(buf);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.status(200).send(text);
}
