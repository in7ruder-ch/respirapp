// src/app/api/media/sign-download/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client (server-side only)
const admin = createClient(supabaseUrl, serviceKey);

/**
 * POST /api/media/sign-download
 * Body: { kind: 'audio' | 'video' }
 * Respuesta OK: { url: string }
 */
export async function POST(req) {
  try {
    const { kind } = await req.json();

    if (!['audio', 'video'].includes(kind)) {
      return NextResponse.json(
        { error: 'Invalid kind' },
        { status: 400 }
      );
    }

    // Usuario desde sesión (cookies)
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1) Buscar el último archivo del usuario para ese tipo
    const { data: rows, error: qErr } = await admin
      .from('media')
      .select('id, path, created_at')
      .eq('user_id', user.id)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1);

    if (qErr) {
      console.error('sign-download query error:', qErr);
      return NextResponse.json(
        { error: 'DB error' },
        { status: 500 }
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No tenés un mensaje guardado.' },
        { status: 404 }
      );
    }

    const { path } = rows[0];
    if (!path) {
      return NextResponse.json(
        { error: 'El registro no tiene ruta de archivo.' },
        { status: 500 }
      );
    }

    // 2) Crear Signed URL desde el bucket privado 'media'
    const { data: signed, error: sErr } = await admin.storage
      .from('media')
      .createSignedUrl(path, 300); // 5 minutos

    if (sErr || !signed?.signedUrl) {
      console.error('sign-download signed url error:', sErr);
      return NextResponse.json(
        { error: 'No se pudo generar la URL firmada.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (err) {
    console.error('sign-download fatal error:', err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
