import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_KEY;  // service role key
const SITE_URL      = process.env.SITE_URL;
const SITE_ID       = process.env.SITE_ID;
const SITE_PASS     = process.env.SITE_PASS;

const BUCKET = 'shipment-data';
const FOLDER = 'data';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !SITE_URL || !SITE_ID || !SITE_PASS) {
    throw new Error('必要な環境変数が設定されていません');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('スクレイピング開始...');
  const csvBuffer = await scrape();

  // 今日の日付 (JST)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const filePath = `${FOLDER}/${today}.csv`;

  console.log(`アップロード中: ${filePath}`);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, csvBuffer, {
      contentType: 'text/csv; charset=utf-8',
      upsert: true,
    });
  if (uploadError) throw uploadError;
  console.log('アップロード完了');

  await deleteOldFiles(supabase, today);
}

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page    = await context.newPage();

  try {
    // -------------------------------------------------------
    // TODO: 以下のセレクターを実際のサイトに合わせて変更してください
    // -------------------------------------------------------

    // 1. ログインページへ移動
    await page.goto(SITE_URL, { waitUntil: 'networkidle' });

    // 2. IDとパスワードを入力
    await page.fill('#login-id',       SITE_ID);    // TODO: IDフィールドのセレクター
    await page.fill('#login-password', SITE_PASS);  // TODO: パスワードフィールドのセレクター

    // 3. ログインボタンをクリックしてページ遷移を待つ
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('#login-submit'),                  // TODO: ログインボタンのセレクター
    ]);

    // 4. CSVダウンロードボタンをクリック
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#csv-download-btn'),              // TODO: ダウンロードボタンのセレクター
    ]);

    // 5. ダウンロード完了を待ってバッファとして読み込む
    const tmpPath = await download.path();
    if (!tmpPath) throw new Error('ダウンロードに失敗しました');
    return readFileSync(tmpPath);

    // -------------------------------------------------------
  } finally {
    await browser.close();
  }
}

async function deleteOldFiles(supabase, todayStr) {
  // 12ヶ月前の日付を計算
  const cutoff = new Date(`${todayStr}T00:00:00+09:00`);
  cutoff.setMonth(cutoff.getMonth() - 12);
  const cutoffStr = cutoff.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

  if (error) { console.error('ファイル一覧の取得に失敗:', error.message); return; }
  if (!files?.length) return;

  const targets = files
    .filter(f => f.name.endsWith('.csv') && f.name.slice(0, 10) < cutoffStr)
    .map(f => `${FOLDER}/${f.name}`);

  if (!targets.length) { console.log('削除対象の古いファイルなし'); return; }

  const { error: delErr } = await supabase.storage.from(BUCKET).remove(targets);
  if (delErr) console.error('削除エラー:', delErr.message);
  else console.log(`古いファイルを ${targets.length} 件削除しました`);
}

main().catch(err => {
  console.error('エラー:', err.message || err);
  process.exit(1);
});
