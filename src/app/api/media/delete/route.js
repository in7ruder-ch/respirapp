// src/app/api/media/delete/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || "media";
const admin = createAdminClient(PUBLIC_URL, SERVICE_KEY);

export const dynamic = "force-dynamic";

export async function POST(req) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = body?.id || null;     // nuevo (preferido)
  const kind = body?.kind || null; // compat: 'audio'|'video'|'any'

  // Resolver target(s)
  let rows = [];
  if (id) {
    const { data, error } = await supa
      .from("media")
      .select("id, path")
      .eq("user_id", user.id)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = data || [];
  } else if (kind) {
    const q = supa.from("media").select("id, path").eq("user_id", user.id);
    if (kind !== "any") q.eq("kind", kind);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    rows = data || [];
  } else {
    return NextResponse.json({ error: "MISSING_ID_OR_KIND" }, { status: 400 });
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  // Borrar de storage
  const keys = rows.map(r => r.path.replace(`${BUCKET}/`, ""));
  const { error: stErr } = await admin.storage.from(BUCKET).remove(keys);
  if (stErr) return NextResponse.json({ error: stErr.message }, { status: 500 });

  // Borrar de DB
  const ids = rows.map(r => r.id);
  const { error: dbErr } = await supa.from("media").delete().in("id", ids);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: ids.length, ids });
}
