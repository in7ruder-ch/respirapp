// src/app/api/media/upload-url/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * POST /api/media/upload-url
 * body: { kind: 'audio' | 'video', contentType?: string }
 *
 * Respuesta OK:
 *  {
 *    ok: true,
 *    kind: 'audio'|'video',
 *    path: 'bucket/userId/kind/message.ext', // ruta completa (incluye bucket)
 *    bucket: 'media',
 *    key: 'userId/kind/message.ext',        // clave relativa dentro del bucket
 *    signedUrl,                             // URL firmada de subida (PUT)
 *    token,                                 // token para supabase.storage.uploadToSignedUrl
 *    contentType                            // echo del contentType
 *  }
 *
 * Reglas:
 *  - Plan FREE (por ahora): 1 mensaje TOTAL por usuario (audio O video).
 *    Si ya existe un registro en `media`, responde 403 LIMIT_REACHED.
 *  - Acepta contentTypes comunes (webm/mp4 para video; webm/mp3 para audio).
 *  - Genera una única ruta "message.ext" por usuario y tipo.
 */

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";

const ALLOWED = {
  audio: ["audio/webm", "audio/mpeg", "audio/mp3"],
  video: ["video/webm", "video/mp4"],
};

function extFor(contentType, kind) {
  const ct = String(contentType || "").toLowerCase();
  if (kind === "audio") {
    if (ct.includes("mpeg") || ct.endsWith("/mp3")) return ".mp3";
    return ".webm"; // default audio
  }
  if (kind === "video") {
    if (ct.endsWith("/mp4")) return ".mp4";
    return ".webm"; // default video
  }
  return ".bin";
}

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
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  const kind = (payload?.kind || "audio").toLowerCase();
  const contentType =
    typeof payload?.contentType === "string" && payload.contentType.trim()
      ? payload.contentType.trim()
      : kind === "video"
      ? "video/webm"
      : "audio/webm";

  if (!["audio", "video"].includes(kind)) {
    return NextResponse.json({ ok: false, message: "kind debe ser 'audio' o 'video'" }, { status: 400 });
  }
  if (!ALLOWED[kind].includes(contentType)) {
    return NextResponse.json(
      { ok: false, message: `contentType no soportado para ${kind}` },
      { status: 400 }
    );
  }

  // 3) Límite FREE unificado: ¿ya tiene algún mensaje (audio o video)?
  //    Nota: cuando implementemos Premium, acá leeremos /subscriptions.
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

  // 4) Construir ruta de objeto
  const ext = extFor(contentType, kind);
  const key = `${user.id}/${kind}/message${ext}`; // clave dentro del bucket
  const path = `${BUCKET}/${key}`; // guardamos bucket+key en DB para ser explícitos

  // 5) Insertar registro en DB (reserva); si falla la firma, hacemos rollback
  const { data: inserted, error: insErr } = await supabase
    .from("media")
    .insert({ user_id: user.id, kind, path })
    .select("id")
    .single();

  if (insErr) {
    // Si hay unique(user_id) o similar, devolvemos límite alcanzado de forma amigable
    if (insErr.code === "23505") {
      return NextResponse.json(
        {
          ok: false,
          code: "LIMIT_REACHED",
          message:
            "Ya existe un mensaje reservado para este usuario. Borrá el actual para grabar otro.",
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  // 6) Crear URL firmada de subida
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(key);

  if (signErr) {
    // rollback del registro para no dejar huérfanos si no podemos subir
    await supabase.from("media").delete().eq("id", inserted.id);
    return NextResponse.json({ ok: false, message: signErr.message }, { status: 500 });
  }

  // 7) Responder datos para que el cliente suba el archivo
  //    Opción A: fetch( signedUrl, { method:'PUT', body:file, headers:{ 'content-type': contentType } })
  //    Opción B: supabase.storage.from(BUCKET).uploadToSignedUrl(key, token, file, { contentType })
  return NextResponse.json({
    ok: true,
    kind,
    path,
    bucket: BUCKET,
    key,
    signedUrl: signed.signedUrl,
    token: signed.token, // por si usás uploadToSignedUrl
    contentType,
  });
}
