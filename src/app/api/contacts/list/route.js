import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createAdminClient(PUBLIC_URL, SERVICE_KEY);

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data, error } = await supa
    .from("emergency_contacts")
    .select("id, name, phone, email, is_favorite, created_at")
    .eq("user_id", user.id)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Derivar plan (útil para la UI)
  const tier = await resolveTierAdmin(user.id);
  return NextResponse.json({ items: data || [], tier });
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
