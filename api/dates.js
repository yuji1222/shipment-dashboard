import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'shipment-data';
const FOLDER = 'data';

export default async function handler(req, res) {
  const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, {
    limit: 400,
    sortBy: { column: 'name', order: 'desc' },
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const dates = data
    .filter(f => f.name.endsWith('.csv'))
    .map(f => f.name.replace('.csv', ''))
    .sort()
    .reverse();

  res.status(200).json(dates);
}
