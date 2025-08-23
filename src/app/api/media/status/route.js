// src/app/api/media/status/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client (Service Role) para consultar tabla/storage
const admin = createClient(supabaseUrl, serviceKey);

/**
 * POST /api/media/status
 * Body: { kind: 'audio' | 'video' }
 * Respuesta: { has: boolean, count: number }
 */
export async function POST(req) {
  try {
    const { kind } = await req.json();
    if (!['audio', 'video'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    // Leer usuario autenticado desde cookies (Auth Helpers)
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Contar registros del usuario por tipo
    const { count, error } = await admin
      .from('media')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('kind', kind);

    if (error) {
      console.error('media/status query error:', error);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    return NextResponse.json({ has: (count ?? 0) > 0, count: count ?? 0 });
  } catch (err) {
    console.error('Media status fatal error:', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
