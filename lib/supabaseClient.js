// /lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Para Magic Link vía email en móviles/PWA, implicit flow es más robusto
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',      // <- CLAVE: evita "invalid flow state"
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,  // Supabase procesa la URL al volver del link
  },
});
