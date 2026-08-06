import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

/**
 * Cria o client do Supabase usando a service_role key.
 * So deve ser chamada quando env.supabase.enabled === true
 * (env.ts ja valida que url/serviceKey existem nesse caso).
 */
export function createSupabaseClient(): SupabaseClient {
  if (!env.supabase.url || !env.supabase.serviceKey) {
    throw new Error(
      'Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env com ENABLE_SUPABASE_SYNC=true.',
    );
  }
  return createClient(env.supabase.url, env.supabase.serviceKey, {
    auth: { persistSession: false },
  });
}
