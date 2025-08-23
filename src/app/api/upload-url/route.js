// src/app/api/upload-url/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client con Service Role (para insertar en tabla + storage)
const admin = createClient(supabaseUrl, serviceKey);

/**
 * POST /api/upload-url
 * Body: { kind: 'audio' | 'video', contentType: string, duration?: number, size?: number }
 * Respuesta: { signedUrl }
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const { kind, contentType, duration, size } = body || {};

    if (!['audio', 'video'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    // 🔑 Obtenemos el usuario autenticado desde la cookie de Supabase
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Plan check (opcional: free = máximo 1 audio/video)
    const { count } = await admin
      .from('media')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('kind', kind);

    if (kind === 'audio' && count > 0) {
      return NextResponse.json(
        { error: 'Plan Free: ya guardaste tu único audio.' },
        { status: 403 }
      );
    }

    // Generar path único
    const fileExt = contentType.includes('mpeg') ? 'mp3' : 'webm';
    const path = `${userId}/${kind}/${Date.now()}.${fileExt}`;

    // Insertar metadata
    const { error: insErr } = await admin.from('media').insert({
      user_id: userId,
      path,
      kind,
      duration_seconds: duration ?? null,
      size_bytes: size ?? null,
    });

    if (insErr) {
      console.error('insert error', insErr);
      return NextResponse.json(
        { error: 'Error guardando metadatos' },
        { status: 500 }
      );
    }

    // Crear Signed Upload URL válido 60s
    const { data: signed, error: sErr } = await admin.storage
      .from('media')
      .createSignedUploadUrl(path);

    if (sErr || !signed?.signedUrl) {
      console.error('signed url error', sErr);
      return NextResponse.json(
        { error: 'No se pudo generar URL firmada' },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: signed.signedUrl });
  } catch (err) {
    console.error('upload-url fatal error:', err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
