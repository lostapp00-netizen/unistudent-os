// Temporary: read the edge function logs for the recent approval emails.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REF = 'llcsezxgcdxkttllguox';
const token = fs.readFileSync(path.join(os.homedir(), '.supabase', 'access-token'), 'utf8').trim();

async function get(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  return { status: r.status, body: t };
}

const start = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
const sql = encodeURIComponent(`select id, timestamp, event_message from function_logs order by timestamp desc limit 40`);
const url = `https://api.supabase.com/v1/projects/${REF}/analytics/endpoints/logs.all?sql=${sql}&iso_timestamp_start=${start}`;
const res = await get(url);
console.log('logs endpoint:', res.status);
console.log(res.body.slice(0, 2500));
