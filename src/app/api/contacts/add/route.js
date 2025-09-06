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
  const name = (body?.name || "").trim();
  const phone = (body?.phone || "").trim();
  const email = (body?.email || "").trim();

  if (!name || !phone) {
    return NextResponse.json({ error: "Faltan campos obligatorios (name, phone)" }, { status: 400 });
  }

  // Límite por plan
  const tier = await resolveTierAdmin(user.id);
  const isFree = tier !== "premium";
  if (isFree) {
    const { count, error: cntErr } = await supa
      .from("emergency_contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (cntErr) return NextResponse.json({ error: cntErr.message }, { status: 500 });
    if ((count ?? 0) >= 1) {
      return NextResponse.json({ error: "LIMIT_REACHED_FREE" }, { status: 403 });
    }
  }

  const { data, error } = await supa
    .from("emergency_contacts")
    .insert({
      user_id: user.id,
      name,
      phone,
      email: email || null,
      // is_favorite: false  // Free no usa favorito, Premium decidirá luego
    })
    .select("id, name, phone, email, is_favorite, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, tier });
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
