// src/app/api/media/delete/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

/**
 * POST /api/media/delete
 * body?: { kind?: 'audio' | 'video' | 'any' }
 *
 * También disponible:
 * DELETE /api/media/delete  (mismo comportamiento; body opcional)
 *
 * Respuesta OK:
 *  { ok:true, deleted: { id, kind, path } | null }
 */

const FALLBACK_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";

function parseStoragePath(path) {
  const s = String(path || "");
  const m = s.match(/^([^/]+)\/(.+)$/);
  if (m) return { bucket: m[1], key: m[2] };
  return { bucket: FALLBACK_BUCKET, key: s };
}

async function handleDelete(req) {
  const supabase = createRouteHandlerClient({ cookies });

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  // 2) Body opcional
  let kind = "any";
  try {
    const json = await req.json().catch(() => ({}));
    if (json && typeof json.kind === "string") {
      const k = json.kind.toLowerCase();
      if (k === "audio" || k === "video" || k === "any") kind = k;
    }
  } catch {
    // sin body: usamos "any"
  }

  // 3) Buscar el registro a borrar (último por fecha). Si no hay del kind pedido, caemos a any.
  async function findRow(k) {
    let q = supabase
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
  if (!row && kind !== "any") {
    // fallback amistoso si pidieron 'audio' o 'video' pero no existe
    row = await findRow("any");
  }

  if (!row) {
    // Nada para borrar
    return NextResponse.json({ ok: true, deleted: null });
  }

  // 4) Borrar en Storage (ignoramos 404 del storage por robustez)
  const { bucket, key } = parseStoragePath(row.path);
  try {
    await supabase.storage.from(bucket).remove([key]);
  } catch {
    // seguimos aunque la key no exista físicamente; mantenemos consistencia en DB
  }

  // 5) Borrar en DB
  const { error: delErr } = await supabase.from("media").delete().eq("id", row.id);
  if (delErr) {
    return NextResponse.json({ ok: false, message: delErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: { id: row.id, kind: row.kind, path: row.path },
  });
}

export async function POST(req) {
  try {
    return await handleDelete(req);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    return await handleDelete(req);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message || "Error" }, { status: 500 });
  }
}
