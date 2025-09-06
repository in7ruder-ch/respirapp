import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createAdminClient(PUBLIC_URL, SERVICE_KEY);

export async function POST(req) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  // Gate premium (Free no necesita favorito porque tiene 1 contacto)
  const tier = await resolveTierAdmin(user.id);
  if (tier !== "premium") {
    return NextResponse.json({ error: "ONLY_PREMIUM" }, { status: 403 });
  }

  // Leer contacto
  const { data: item, error: itemErr } = await supa
    .from("emergency_contacts")
    .select("id, user_id, is_favorite")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (itemErr || !item) {
    return NextResponse.json({ error: itemErr?.message || "NOT_FOUND" }, { status: 404 });
  }

  if (item.is_favorite) {
    // Toggle OFF: limpiar todos
    const unset = await supa
      .from("emergency_contacts")
      .update({ is_favorite: false })
      .eq("user_id", user.id);
    if (unset.error) {
      return NextResponse.json({ error: unset.error.message }, { status: 500 });
    }
    return NextResponse.json({ item: { id, is_favorite: false } });
  }

  // Toggle ON: único favorito
  const unset = await supa
    .from("emergency_contacts")
    .update({ is_favorite: false })
    .eq("user_id", user.id);
  if (unset.error) {
    return NextResponse.json({ error: unset.error.message }, { status: 500 });
  }

  const set = await supa
    .from("emergency_contacts")
    .update({ is_favorite: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, is_favorite")
    .single();

  if (set.error) {
    return NextResponse.json({ error: set.error.message }, { status: 500 });
  }

  return NextResponse.json({ item: set.data });
}

async function resolveTierAdmin(userId) {
  try {
    const { data } = await admin
      .from("subscriptions")
      .select("tier, valid_until, created_at")
      .eq("user_id", userId)
      .eq("tier", "premium")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return "free";
    if (!data.valid_until) return "premium";
    return new Date(data.valid_until) > new Date() ? "premium" : "free";
  } catch {
    return "free";
  }
}
