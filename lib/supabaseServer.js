// lib/supabaseServer.js
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Cliente con RLS (contexto de usuario via cookies) para usar en Route Handlers
export function supabaseRLS() {
  return createRouteHandlerClient({ cookies });
}

// Cliente con Service Role (sin RLS) para operaciones de servidor
export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Helper para obtener el userId autenticado en rutas API (app router)
export async function getAuthUserId() {
  const supa = supabaseRLS();
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) throw new Error('UNAUTHENTICATED');
  return data.user.id;
}
