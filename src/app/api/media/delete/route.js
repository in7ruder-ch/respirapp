import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente admin (solo servidor)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/media/delete
 * Body: { userId: string, kind: 'audio' | 'video' }
 * - Busca el último media del usuario para ese kind
 * - Borra el objeto en Storage (bucket 'media')
 * - Borra el registro en la tabla public.media
 */
export async function POST(req) {
  try {
    const { userId, kind } = await req.json();
    if (!userId || !kind || !["audio", "video"].includes(kind)) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    // 1) Buscar el (único/último) registro del usuario
    const { data: rows, error: selErr } = await admin
      .from("media")
      .select("id, path")
      .eq("user_id", userId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1);

    if (selErr) throw selErr;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, message: "No media to delete" }, { status: 200 });
    }

    const { id, path } = rows[0];

    // 2) Borrar en Storage
    const { error: rmErr } = await admin.storage.from("media").remove([path]);
    if (rmErr) throw rmErr;

    // 3) Borrar en DB
    const { error: delErr } = await admin.from("media").delete().eq("id", id);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true, deleted: { id, path } });
  } catch (err) {
    console.error("Delete media error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
