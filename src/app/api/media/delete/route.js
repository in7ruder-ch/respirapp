// src/app/api/media/delete/route.js
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

async function handle(req) {
  const userClient = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  // leer kind opcional
  let kind = "any";
  try {
    const json = await req.json().catch(() => ({}));
    if (json && typeof json.kind === "string") {
      const k = json.kind.toLowerCase();
      if (k === "audio" || k === "video" || k === "any") kind = k;
    }
  } catch {}

  // Buscar registro (DB con user client)
  async function findRow(k) {
    let q = userClient
      .from("media")
      .select("id, kind, path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (k === "audio" || k === "video") q = q.eq("kind", k);
    const { data, error } = await q.maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return data || null;
  }

  let row = await findRow(kind);
  if (!row && kind !== "any") row = await findRow("any");
  if (!row) return NextResponse.json({ ok: true, deleted: null });

  // Borrar del Storage con SERVICE ROLE
  const { bucket, key } = parseStoragePath(row.path);
  try {
    await admin.storage.from(bucket).remove([key]);
  } catch {
    // ignoramos errores de storage para no bloquear la eliminación lógica
  }

  // Borrar en DB (user client con RLS)
  const { error: delErr } = await userClient.from("media").delete().eq("id", row.id);
  if (delErr) return NextResponse.json({ ok: false, message: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: { id: row.id, kind: row.kind, path: row.path } });
}

export async function POST(req) {
  try {
    return await handle(req);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || "Error" }, { status: 500 });
  }
}
export async function DELETE(req) {
  try {
    return await handle(req);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || "Error" }, { status: 500 });
  }
}
