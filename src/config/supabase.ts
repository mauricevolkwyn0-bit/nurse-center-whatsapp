import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './index';

// Lazily initialized so a missing env var doesn't crash the process
// before the webhook verification route can even respond.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required');
    }
    _client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}
