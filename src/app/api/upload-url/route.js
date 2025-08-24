// src/app/api/upload-url/route.js
// Endpoint unificado para pedir URL firmada de subida (audio o video)

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";

/** "audio/webm;codecs=opus" -> "audio/webm" */
function baseContentType(ct) {
  return String(ct || "").toLowerCase().split(";")[0].trim();
}

function isAllowed(base, kind) {
  if (kind === "audio") {
    return (
      base === "audio/webm" ||
      base === "audio/ogg" ||
      base === "audio/mpeg" ||
      base === "audio/mp3"
    );
  }
  if (kind === "video") {
    return base === "video/webm" || base === "video/mp4";
  }
  return false;
}

function extFor(base, kind) {
  if (kind === "audio") {
    if (base === "audio/mpeg" || base === "audio/mp3") return ".mp3";
    if (base === "audio/ogg") return ".ogg";
    return ".webm";
  }
  if (kind === "video") {
    if (base === "video/mp4") return ".mp4";
    return ".webm";
  }
  return ".bin";
}

/**
 * POST /api/upload-url
 * body: { kind: 'audio' | 'video', contentType?: string }
 *
 * Regla FREE (hoy): 1 mensaje TOTAL por usuario (audio O video).
 */
export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  // 2) Body
  let payload = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const kind = (payload?.kind || "audio").toLowerCase();
  if (!["audio", "video"].includes(kind)) {
    return NextResponse.json({ ok: false, message: "kind debe ser 'audio' o 'video'" }, { status: 400 });
  }

  const requestedCT = typeof payload?.contentType === "string" ? payload.contentType : "";
  const baseCT = baseContentType(
    requestedCT || (kind === "video" ? "video/webm" : "audio/webm")
  );

  if (!isAllowed(baseCT, kind)) {
    return NextResponse.json(
      { ok: false, message: `contentType no soportado (${baseCT}) para ${kind}` },
      { status: 400 }
    );
  }

  // 3) Límite FREE unificado: ¿ya tiene algún mensaje (audio o video)?
  const { data: existing, error: selErr } = await supabase
    .from("media")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (selErr && selErr.code !== "PGRST116") {
    return NextResponse.json({ ok: false, message: selErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        code: "LIMIT_REACHED",
        message:
          "Plan Free: ya tenés un mensaje guardado (audio o video). Borrá el actual para grabar otro.",
      },
      { status: 403 }
    );
  }

  // 4) Ruta destino y reserva en DB
  const ext = extFor(baseCT, kind);
  const key = `${user.id}/${kind}/message${ext}`;
  const path = `${BUCKET}/${key}`;

  const { data: inserted, error: insErr } = await supabase
    .from("media")
    .insert({ user_id: user.id, kind, path })
    .select("id")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { ok: false, code: "LIMIT_REACHED", message: "Ya existe un mensaje reservado." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  // 5) URL firmada de subida
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(key);

  if (signErr) {
    await supabase.from("media").delete().eq("id", inserted.id); // rollback
    return NextResponse.json({ ok: false, message: signErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    kind,
    path,
    bucket: BUCKET,
    key,
    signedUrl: signed.signedUrl,
    token: signed.token,
    contentType: baseCT,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "POST con {kind, contentType}" });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
