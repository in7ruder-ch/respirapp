import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/contact  (DEPRECATED)
 * Devuelve 1 contacto “resuelto” desde emergency_contacts:
 * - favorito si existe
 * - sino, el más reciente
 * - sino, null
 */
export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return withDeprecated(NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }));
  }

  // favorito primero, luego el más reciente
  const { data, error } = await supa
    .from("emergency_contacts")
    .select("id, name, phone, email, is_favorite, created_at")
    .eq("user_id", user.id)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return withDeprecated(NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const item = (data && data.length > 0) ? data[0] : null;
  return withDeprecated(NextResponse.json({ contact: item }));
}

/**
 * POST /api/contact  (DEPRECATED)
 * Mantiene compatibilidad “contacto único”:
 * - Si hay alguno → actualiza el más reciente
 * - Sino → crea uno nuevo
 * Body: { name, phone, email? }
 */
export async function POST(req) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    return withDeprecated(NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }));
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const name = (body?.name || "").trim();
  const phone = (body?.phone || "").trim();
  const email = (body?.email || "").trim();
  if (!name || !phone) {
    return withDeprecated(NextResponse.json({ error: "Faltan campos (name, phone)" }, { status: 400 }));
  }

  // Obtener el más reciente (si existe)
  const { data: existing, error: listErr } = await supa
    .from("emergency_contacts")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (listErr) {
    return withDeprecated(NextResponse.json({ error: listErr.message }, { status: 500 }));
  }

  if (existing && existing.length > 0) {
    // Actualizar el más reciente
    const id = existing[0].id;
    const { data: upd, error: updErr } = await supa
      .from("emergency_contacts")
      .update({ name, phone, email: email || null })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, phone, email, is_favorite, created_at")
      .single();

    if (updErr) {
      return withDeprecated(NextResponse.json({ error: updErr.message }, { status: 500 }));
    }
    return withDeprecated(NextResponse.json({ contact: upd }));
  } else {
    // Crear uno nuevo
    const { data: ins, error: insErr } = await supa
      .from("emergency_contacts")
      .insert({
        user_id: user.id,
        name,
        phone,
        email: email || null,
      })
      .select("id, name, phone, email, is_favorite, created_at")
      .single();

    if (insErr) {
      return withDeprecated(NextResponse.json({ error: insErr.message }, { status: 500 }));
    }
    return withDeprecated(NextResponse.json({ contact: ins }));
  }
}

function withDeprecated(resp) {
  // Añadimos un header deprecado para ayudarte a detectar usos residuales
  try {
    resp.headers.set("X-Deprecated-Route", "/api/contact is deprecated. Use /api/contacts/*");
  } catch {}
  return resp;
}
