import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body = {};
    try {
      body = await req.json();
    } catch (_) {
      // no body
    }

    const { id, title } = body || {};
    if (!id || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const { error } = await supabase
      .from('media')
      .update({ title: title.trim() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
