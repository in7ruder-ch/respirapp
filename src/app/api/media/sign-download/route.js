// src/app/api/media/sign-download/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * POST /api/media/sign-download
 * body?: { kind?: 'audio' | 'video' | 'any' }
 *
 * Respuesta:
 *  { ok:true, url:string, kind:'audio'|'video' }
 *
 * Compatibilidad:
 *  - Si no mandás body o no mandás `kind`, por defecto usa 'audio' (como antes).
 *  - `kind:'any'` devuelve el último mensaje (audio o video) por created_at desc.
 */
export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1) Usuario
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  // 2) Body opcional
  let kind = "audio"; // 👈 default para no romper flujos anteriores
  try {
    const json = await req.json().catch(() => ({}));
    if (json && typeof json.kind === "string") {
      const k = json.kind.toLowerCase();
      if (k === "audio" || k === "video" || k === "any") kind = k;
    }
  } catch {
    // seguimos con 'audio'
  }

  // 3) Buscar el último media (según kind)
  try {
    let q = supabase
      .from("media")
      .select("id, kind, path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (kind === "audio" || kind === "video") {
      q = q.eq("kind", kind);
    }

    const { data: row, error } = await q.maybeSingle();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json(
        { ok: false, message: "No tenés un mensaje guardado." },
        { status: 404 }
      );
    }

    // 4) Firmar URL de descarga desde Storage
    const { bucket, key } = parseStoragePath(row.path);
    const expiresIn = 60; // segundos
    const { data: signed, error: signErr } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(key, expiresIn);

    if (signErr) {
      return NextResponse.json({ ok: false, message: signErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      url: signed.signedUrl,
      kind: row.kind,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || "Error" }, { status: 500 });
  }
}

/**
 * Permite soportar dos formatos de path almacenado:
 *  - "bucket/key/relativo.ext"  -> bucket = primer segmento, key = resto
 *  - "solo-un-key.ext"          -> bucket tomado de env o 'media' por defecto
 */
function parseStoragePath(path) {
  const FALLBACK_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";
  const s = String(path || "");
  const m = s.match(/^([^/]+)\/(.+)$/);
  if (m) {
    return { bucket: m[1], key: m[2] };
  }
  return { bucket: FALLBACK_BUCKET, key: s };
}
