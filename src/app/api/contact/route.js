// src/app/api/contact/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// Normaliza y valida teléfono (acepta +, espacios, guiones, paréntesis)
function normalizePhone(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}
function isValidPhone(p) {
  return /^[+\d][\d\s()-]{5,}$/.test(p || "");
}

// GET: { ok, contact|null }
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,phone,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // PGRST116 = no rows (PostgREST). Si viene, lo tratamos como null.
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contact: data ?? null });
}

// POST: upsert del contacto { name, phone }
export async function POST(req) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const name = (payload.name || "").trim();
  const phone = normalizePhone(payload.phone || "");

  if (!name || !phone) {
    return NextResponse.json({ ok: false, message: "Faltan name o phone" }, { status: 400 });
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ ok: false, message: "Teléfono inválido" }, { status: 400 });
  }

  // ¿Ya existe contacto para este user?
  const { data: existing, error: selErr } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr && selErr.code !== "PGRST116") {
    return NextResponse.json({ ok: false, message: selErr.message }, { status: 500 });
  }

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("contacts")
      .update({ name, phone })
      .eq("id", existing.id)
      .select("id,name,phone,created_at,updated_at")
      .single();

    if (updErr) {
      return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, contact: updated });
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, name, phone })
      .select("id,name,phone,created_at,updated_at")
      .single();

    if (insErr) {
      return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, contact: inserted });
  }
}

// DELETE: elimina el contacto del usuario (si existe)
export async function DELETE() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("contacts").delete().eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
