// src/app/api/upload-url/route.js
// Endpoint unificado para pedir URL firmada de subida (audio o video)

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getUserPlan } from "@/lib/plan.js";

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

// Admin client (service role) SOLO para Storage (bypassa RLS de storage)
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
function genId() {
  try {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * POST /api/upload-url
 * body: { kind: 'audio' | 'video', contentType?: string }
 * Regla FREE: 1 mensaje TOTAL (audio O video).
 */
export async function POST(req) {
  const userClient = createRouteHandlerClient({ cookies });

  // 1) Auth
  const {
    data: { user },
  } = await userClient.auth.getUser();
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

  // 3) Plan del usuario → define límite
  let tier = "free";
  try {
    const plan = await getUserPlan(user.id); // puede ser 'free' | 'premium' o { tier: '...' }
    tier = typeof plan === 'string' ? plan : (plan?.tier || 'free');
  } catch {
    tier = "free"; // fallback conservador
  }
  const isFree = tier === "free";

  // 4) Límite FREE unificado (1 mensaje total)
  if (isFree) {
    const { data: existing, error: selErr } = await userClient
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
  }

  // 5) Ruta destino
  const ext = extFor(baseCT, kind);
  const key = `${user.id}/${kind}/${genId()}${ext}`;
  const path = `${BUCKET}/${key}`;

  // 6) Reserva en DB (RLS)
  const { data: inserted, error: insErr } = await userClient
    .from("media")
    .insert({ user_id: user.id, kind, path })
    .select("id")
    .single();

  if (insErr) {
    return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  // 7) Firmar URL de subida (service role en Storage)
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
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, info: "POST con {kind, contentType}" });
}
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
