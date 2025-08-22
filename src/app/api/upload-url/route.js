import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Cliente admin con service role (solo servidor)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Config de límites
const LIMITS = {
  free: { audio: 1, video: 1 },
  premium: { audio: Infinity, video: Infinity },
};

export async function POST(req) {
  try {
    const { userId, kind, contentType, duration, size } = await req.json();
    if (!userId || !kind || !contentType) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!["audio", "video"].includes(kind)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    // 1) Obtener plan (si no hay registro => 'free')
    let plan = "free";
    const { data: planRow, error: planErr } = await admin
      .from("user_plans")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    if (planErr) {
      console.error("Plan fetch error:", planErr);
    } else if (planRow?.plan) {
      plan = planRow.plan;
    }

    // 2) Validar cupo según plan
    const limit = LIMITS[plan][kind];
    if (Number.isFinite(limit)) {
      const { count, error: countErr } = await admin
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", kind);

      if (countErr) throw countErr;

      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          {
            error:
              plan === "free"
                ? `Plan Free: alcanzaste tu límite de ${limit} ${kind === "audio" ? "audio" : "video"}.`
                : "Límite alcanzado.",
          },
          { status: 403 }
        );
      }
    }

    // 3) Generar path y signed upload URL
    const ext = contentType.includes("video") ? "mp4" : "webm";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { data: signed, error: signedErr } = await admin.storage
      .from("media")
      .createSignedUploadUrl(path);
    if (signedErr) throw signedErr;

    // 4) Guardar metadatos (reserva el slot)
    const { error: insertErr } = await admin.from("media").insert({
      user_id: userId,
      path,
      kind,
      duration_seconds: duration ?? null,
      size_bytes: size ?? null,
    });
    if (insertErr) throw insertErr;

    return NextResponse.json({ signedUrl: signed.signedUrl, path });
  } catch (err) {
    console.error("Upload URL error:", err);
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
