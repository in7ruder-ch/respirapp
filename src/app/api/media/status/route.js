// src/app/api/media/status/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * POST /api/media/status
 * body?: { kind?: 'audio' | 'video' | 'any' }
 *
 * Respuesta:
 *  { ok:true, has:boolean, kind: 'audio'|'video'|null }
 *
 * Compatibilidad:
 *  - Si envías {kind:'audio'} funciona como antes (revisa solo audio).
 *  - Si envías {kind:'video'} revisa solo video.
 *  - Si envías {kind:'any'} o nada, revisa si hay *cualquier* mensaje
 *    y devuelve `kind` con el último guardado.
 */
export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  // Usuario
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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
    // Construimos query
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
      // error real de PostgREST (no "no rows")
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    const row = data || null;
    return NextResponse.json({
      ok: true,
      has: !!row,
      kind: row ? row.kind : null,
    });
  } catch (e) {
    // Si la tabla no existe o hay otro problema, no rompemos el flujo
    return NextResponse.json({ ok: true, has: false, kind: null });
  }
}
