// src/app/api/media/sign-download/route.js
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
  const id = body?.id || null;

  let row = null;

  if (id) {
    const { data, error } = await supa
      .from("media")
      .select("id, path, kind")
      .eq("user_id", user.id)
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    row = data;
  } else {
    // Si no hay id: favorito o último
    const { data, error } = await supa
      .from("media")
      .select("id, path, kind, is_favorite, created_at")
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    row = data;
  }

  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const key = row.path.replace(`${BUCKET}/`, "");
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(key, 60 * 60); // 1h

  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    id: row.id,
    kind: row.kind,
    url: signed.signedUrl,
  });
}
