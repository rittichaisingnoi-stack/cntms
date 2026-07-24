import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB calls will fail. Copy .env.example to .env.');
}

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: { persistSession: false }
});
