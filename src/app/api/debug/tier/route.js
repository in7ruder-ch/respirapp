import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const PUBLIC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PUBLIC_URL) throw new Error("SUPABASE URL no configurada");
if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");

const admin = createAdminClient(PUBLIC_URL, SERVICE_KEY);

async function resolveTierAdmin(userId) {
  const { data, error } = await admin
    .from("subscriptions")
    .select("tier, valid_until, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { tier: "free", row: null, error: String(error.message || error) };
  if (!data) return { tier: "free", row: null, error: null };

  let tier = "free";
  if (data.tier?.toLowerCase() === "premium") {
    tier = !data.valid_until || new Date(data.valid_until) > new Date() ? "premium" : "free";
  }
  return { tier, row: data, error: null };
}

export async function GET() {
  try {
    const userClient = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Tier vía admin (service role)
    const tierAdmin = await resolveTierAdmin(user.id);

    // Count media del usuario (admin para evitar RLS dudas)
    const { count: mediaCountAdmin, error: mediaCountErr } = await admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Además devolvemos un snapshot de las últimas 3 filas en subscriptions (admin)
    const { data: lastSubs, error: lastSubsErr } = await admin
      .from("subscriptions")
      .select("user_id, tier, valid_until, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3);

    return NextResponse.json({
      ok: true,
      userId: user.id,
      envProjectUrlHash: (PUBLIC_URL || "").slice(0, 20) + "...", // solo para confirmar proyecto
      tierAdmin,                       // { tier, row, error }
      mediaCountAdmin: mediaCountAdmin ?? 0,
      mediaCountError: mediaCountErr ? String(mediaCountErr.message || mediaCountErr) : null,
      lastSubscriptions: lastSubs || [],
      lastSubscriptionsError: lastSubsErr ? String(lastSubsErr.message || lastSubsErr) : null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
