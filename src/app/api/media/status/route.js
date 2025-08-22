import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/media/status
 * Body: { userId: string, kind: 'audio' | 'video' }
 * Respuesta: { has: boolean, count: number }
 */
export async function POST(req) {
  try {
    const { userId, kind } = await req.json();
    if (!userId || !["audio", "video"].includes(kind)) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { count, error } = await admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", kind);

    if (error) throw error;

    return NextResponse.json({ has: (count ?? 0) > 0, count: count ?? 0 });
  } catch (err) {
    console.error("Media status error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
