import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const supa = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = body?.id;
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : undefined;

  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  if (name === undefined && phone === undefined) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }
  if (phone !== undefined && phone.trim() === "") {
    return NextResponse.json({ error: "phone no puede quedar vacío" }, { status: 400 });
  }

  const patch = {};
  if (name !== undefined) patch.name = name || null;
  if (phone !== undefined) patch.phone = phone || null;

  const { data, error } = await supa
    .from("emergency_contacts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, phone, is_favorite, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
