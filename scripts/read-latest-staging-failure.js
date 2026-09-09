import { assertStagingTarget } from '../lib/staging-guard.js';

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SECRET_KEY?.trim();
assertStagingTarget(supabaseUrl);
if (!supabaseKey) throw new Error('Missing staging Supabase secret key.');

const headers = { apikey: supabaseKey };
if (supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${supabaseKey}`;

const response = await fetch(
  `${supabaseUrl}/rest/v1/analysis_jobs?select=status,failure_code,created_at&order=created_at.desc&limit=1`,
  { headers },
);
if (!response.ok) throw new Error(`Staging diagnostic query failed (${response.status}).`);
const [job] = await response.json();
console.log(JSON.stringify(job || null, null, 2));
