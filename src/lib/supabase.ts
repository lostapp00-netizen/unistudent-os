import { createClient } from '@supabase/supabase-js';
import { createQuotaSafeStorage } from './sessionPersistence';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The session shares one localStorage bucket with the app's own caches, and
    // localStorage rejects every further write once it is full. That made the
    // hourly refresh-token rotation fail to save, leaving a revoked token on the
    // device — the student was then signed out the next time they opened the
    // browser. This adapter frees rebuildable caches and retries instead.
    storage: createQuotaSafeStorage()
  }
});
