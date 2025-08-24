// src/app/api/media/sign-download/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const PUBLIC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FALLBACK_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";

const admin = createAdminClient(PUBLIC_URL, SERVICE_KEY);

function parseStoragePath(path) {
  const s = String(path || "");
  const m = s.match(/^([^/]+)\/(.+)$/);
  if (m) return { bucket: m[1], key: m[2] };
  return { bucket: FALLBACK_BUCKET, key: s };
}

/**
 * POST /api/media/sign-download
 * body?: { kind?: 'audio' | 'video' | 'any' }
 * Respuesta: { ok:true, url, kind }
 */
export async function POST(req) {
  const userClient = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let kind = "audio"; // compat por defecto
  try {
    const json = await req.json().catch(() => ({}));
    if (json && typeof json.kind === "string") {
      const k = json.kind.toLowerCase();
      if (k === "audio" || k === "video" || k === "any") kind = k;
    }
  } catch {}

  // Buscar último media (DB con user client)
  let q = userClient
    .from("media")
    .select("id, kind, path, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (kind === "audio" || kind === "video") q = q.eq("kind", kind);

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

  // Firmar descarga con SERVICE ROLE (bypassa RLS de Storage)
  const { bucket, key } = parseStoragePath(row.path);
  const expiresIn = 60;
  const { data: signed, error: signErr } = await admin
    .storage
    .from(bucket)
    .createSignedUrl(key, expiresIn);

  if (signErr) {
    return NextResponse.json({ ok: false, message: signErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: signed.signedUrl, kind: row.kind });
}
