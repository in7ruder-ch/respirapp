import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializar Supabase con la service role key (solo en servidor)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ esta key va solo en server, nunca en cliente
);

export async function POST(req) {
  try {
    const { userId, kind, contentType, duration, size } = await req.json();

    if (!userId || !kind || !contentType) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // generar un path único para el archivo
    const ext = contentType.includes("video") ? "mp4" : "webm";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    // 1. crear URL firmada de subida
    const { data, error } = await supabase.storage
      .from("media")
      .createSignedUploadUrl(path);

    if (error) throw error;

    // 2. guardar metadatos en tabla public.media
    const { error: insertError } = await supabase.from("media").insert({
      user_id: userId,
      path,
      kind,
      duration_seconds: duration ?? null,
      size_bytes: size ?? null,
    });

    if (insertError) throw insertError;

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path,
    });
  } catch (err) {
    console.error("Upload URL error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
