// /lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * En SSR/build no instanciamos el cliente (no hay window).
 * En browser, sí. Así evitamos que el prerender falle si faltan envs.
 */
let supabase = null;

if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseAnonKey) {
    // En browser, avisamos si faltan envs (para no quedarnos sin pistas).
    console.error(
      '[Supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'implicit',     // más robusto para Magic Link abierto en otro contexto
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true, // Supabase procesa el hash de la URL al volver del link
      },
    });
  }
}

export { supabase };
