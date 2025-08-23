// src/app/api/media/delete/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client (Service Role) para DB + Storage
const admin = createClient(supabaseUrl, serviceKey);

/**
 * POST /api/media/delete
 * Body: { kind: 'audio' | 'video' }
 * Borra el último (o único) registro del usuario para ese tipo y su archivo en Storage.
 * Respuesta: { ok: boolean, deleted: 0|1 }
 */
export async function POST(req) {
  try {
    const { kind } = await req.json();
    if (!['audio', 'video'].includes(kind)) {
      return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
    }

    // Usuario autenticado desde cookies
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar el último media del usuario para ese tipo
    const { data: rows, error: qErr } = await admin
      .from('media')
      .select('id, path, created_at')
      .eq('user_id', user.id)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1);

    if (qErr) {
      console.error('media/delete query error:', qErr);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      // Idempotente: no hay nada que borrar
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const { id, path } = rows[0];

    // Borrar archivo en Storage (bucket 'media')
    if (path) {
      const { error: remErr } = await admin.storage.from('media').remove([path]);
      if (remErr) {
        console.error('media/delete storage remove error:', remErr);
        // Continuamos para no dejar fila huérfana (opcional: podrías abortar aquí)
      }
    }

    // Borrar fila en DB
    const { error: delErr } = await admin.from('media').delete().eq('id', id);
    if (delErr) {
      console.error('media/delete db delete error:', delErr);
      return NextResponse.json({ error: 'DB delete error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (err) {
    console.error('media/delete fatal error:', err);
    return NextResponse.json(
      { error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
