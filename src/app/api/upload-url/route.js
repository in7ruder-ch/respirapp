// src/app/api/upload-url/route.js
// Endpoint unificado para pedir URL firmada de subida (audio o video)

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const PUBLIC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";

if (!PUBLIC_URL) {
  throw new Error("SUPABASE URL no configurada");
}
if (!SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
}

// Admin client (service role) — DB + Storage con bypass de RLS
const admin = createAdminClient(PUBLIC_URL, SERVICE_KEY);

// Helpers de content-type
function baseContentType(ct) {
  return String(ct || "").toLowerCase().split(";")[0].trim();
}
function isAllowed(base, kind) {
  if (kind === "audio") {
    return (
      base === "audio/webm" ||
      base === "audio/ogg" ||
      base === "audio/mpeg" ||
      base === "audio/mp3" ||
      base === "audio/mp4" // ✅ iOS/Safari (MediaRecorder) suele emitir esto
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
    if (base === "audio/mp4") return ".m4a"; // ✅ contenedor mp4 → .m4a
    return ".webm";
  }
  if (kind === "video") {
    if (base === "video/mp4") return ".mp4";
    return ".webm";
  }
  return ".bin";
}
function genId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function defaultTitle(kind) {
  const now = new Date();
  const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const prefix = kind === "audio" ? "Audio" : kind === "video" ? "Video" : "Media";
  return `${prefix} ${isoLocal}`;
}

// 🔎 Tier directo desde subscriptions con service role (sin depender de lib/plan.js)
async function resolveTierAdmin(userId) {
  const { data, error } = await admin
    .from("subscriptions")
    .select("tier, valid_until, created_at")
    .eq("user_id", userId)
    .eq("tier", "premium")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return "free";
  if (!data) return "free";
  if (!data.valid_until) return "premium";
  return new Date(data.valid_until) > new Date() ? "premium" : "free";
}

/**
 * POST /api/upload-url
 * body: { kind: 'audio' | 'video', contentType?: string, title?: string }
 * Regla FREE: 1 mensaje TOTAL (audio O video).
 */
export async function POST(req) {
  const userClient = createRouteHandlerClient({ cookies });

  // 1) Auth
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
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
    return NextResponse.json(
      { ok: false, message: "kind debe ser 'audio' o 'video'" },
      { status: 400 }
    );
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

  // 3) Plan del usuario (admin, sin RLS) → define límite
  const tier = await resolveTierAdmin(user.id);
  const isFree = tier === "free";

  // 4) Límite FREE unificado (1 mensaje total) — conteo robusto
  if (isFree) {
    const { count, error: countErr } = await userClient
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countErr) {
      return NextResponse.json({ ok: false, message: countErr.message }, { status: 500 });
    }
    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        {
          ok: false,
          code: "LIMIT_REACHED",
          message:
            "Plan Free: ya tenés un mensaje guardado (audio o video). Borrá el actual para grabar otro.",
          tierDetectado: tier,
        },
        { status: 403 }
      );
    }
  }

  // 5) Ruta destino (Storage)
  const ext = extFor(baseCT, kind);
  const key = `${user.id}/${kind}/${genId()}${ext}`;
  const path = `${BUCKET}/${key}`;

  // 6) Título visible (opcional desde el cliente)
  const rawTitle = typeof payload?.title === "string" ? payload.title : "";
  const title = rawTitle.trim() || defaultTitle(kind);

  // 7) Reserva en DB (RLS) — guardamos title
  const { data: inserted, error: insErr } = await userClient
    .from("media")
    .insert({ user_id: user.id, kind, path, title })
    .select("id")
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  // 8) Firmar URL de subida (service role en Storage)
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(key);

  if (signErr) {
    await userClient.from("media").delete().eq("id", inserted.id); // rollback
    return NextResponse.json({ ok: false, message: signErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    kind,
    plan: tier,
    path,
    bucket: BUCKET,
    key,
    signedUrl: signed.signedUrl,
    token: signed.token,
    contentType: baseCT,
    title, // eco para debug/UX si querés usarlo del lado del cliente
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "POST con {kind, contentType, title?}" });
}
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
