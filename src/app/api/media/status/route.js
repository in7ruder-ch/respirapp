// src/app/api/media/status/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * POST /api/media/status
 * body?: { kind?: 'audio' | 'video' | 'any' }
 *
 * Respuesta:
 *  { ok:true, has:boolean, kind: 'audio'|'video'|null, count:number }
 *
 * Compatibilidad:
 *  - {kind:'audio'} => revisa solo audio.
 *  - {kind:'video'} => revisa solo video.
 *  - {kind:'any'} o vacío => revisa cualquier mensaje y usa el último (o favorito si tu lógica lo requiere en el futuro).
 */
export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  // Usuario
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  // Leer body opcional
  let kind = "any";
  try {
    const json = await req.json().catch(() => ({}));
    if (json && typeof json.kind === "string") {
      const k = json.kind.toLowerCase();
      if (k === "audio" || k === "video" || k === "any") kind = k;
    }
  } catch {
    // ignoramos body inválido y seguimos con "any"
  }

  try {
    // Conteo exacto del usuario (debug y lógica futura)
    const { count, error: countErr } = await supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countErr) {
      return NextResponse.json({ ok: false, message: countErr.message }, { status: 500 });
    }

    // Si no hay nada, devolvemos estado vacío
    if (!count || count === 0) {
      return NextResponse.json({
        ok: true,
        has: false,
        kind: null,
        count: 0,
      });
    }

    // Query del último registro por usuario (opcionalmente filtrado por kind)
    let q = supabase
      .from("media")
      .select("id, kind, path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (kind === "audio" || kind === "video") {
      q = q.eq("kind", kind);
    }

    const { data, error } = await q.maybeSingle();
    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const row = data || null;
    return NextResponse.json({
      ok: true,
      has: !!row,
      kind: row ? row.kind : null,
      count: count ?? 0,
    });
  } catch (e) {
    // fallback ultra conservador
    return NextResponse.json({ ok: true, has: false, kind: null, count: 0 });
  }
}
