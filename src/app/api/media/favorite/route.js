// src/app/api/media/favorite/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { getUserPlan } from "@/lib/plan.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  // Solo Premium puede marcar favorito
  let tier = "free";
  try { tier = await getUserPlan(user.id); } catch {}
  if (tier !== "premium") {
    return NextResponse.json({ error: "ONLY_PREMIUM" }, { status: 403 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  // Verificar propiedad
  const { data: row, error: getErr } = await supa
    .from("media")
    .select("id")
    .eq("user_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Desmarcar anterior
  const { error: clrErr } = await supa
    .from("media")
    .update({ is_favorite: false })
    .eq("user_id", user.id)
    .eq("is_favorite", true);
  if (clrErr) return NextResponse.json({ error: clrErr.message }, { status: 500 });

  // Marcar este y devolver actualizado
  const { data: updated, error: setErr } = await supa
    .from("media")
    .update({ is_favorite: true })
    .eq("user_id", user.id)
    .eq("id", id)
    .select("id, is_favorite")
    .maybeSingle();
  if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id, updated });
}
