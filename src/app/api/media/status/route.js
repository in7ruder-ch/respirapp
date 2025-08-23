// src/app/api/media/status/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client (Service Role) para consultar tabla/storage
const admin = createClient(supabaseUrl, serviceKey);

function noStoreJson(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Cache-Control', 'no-store');
  return NextResponse.json(body, { ...init, headers });
}

async function getStatus(kind) {
  // Leer usuario autenticado desde cookies (Auth Helpers)
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: 'Unauthorized' }, { status: 401 });
  }

  // Contar registros del usuario por tipo
  const { count, error } = await admin
    .from('media')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', kind);

  if (error) {
    console.error('media/status query error:', error);
    return noStoreJson({ error: 'DB error' }, { status: 500 });
  }

  return noStoreJson({ has: (count ?? 0) > 0, count: count ?? 0 });
}

/**
 * GET /api/media/status?kind=audio|video
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get('kind');
    if (!['audio', 'video'].includes(kind)) {
      return noStoreJson({ error: 'Invalid kind' }, { status: 400 });
    }
    return await getStatus(kind);
  } catch (err) {
    console.error('Media status GET fatal error:', err);
    return noStoreJson({ error: String(err?.message || err) }, { status: 500 });
  }
}

/**
 * POST /api/media/status
 * Body: { kind: 'audio' | 'video' }
 * Mantenido por compatibilidad
 */
export async function POST(req) {
  try {
    const { kind } = await req.json();
    if (!['audio', 'video'].includes(kind)) {
      return noStoreJson({ error: 'Invalid kind' }, { status: 400 });
    }
    return await getStatus(kind);
  } catch (err) {
    console.error('Media status POST fatal error:', err);
    return noStoreJson({ error: String(err?.message || err) }, { status: 500 });
  }
}
