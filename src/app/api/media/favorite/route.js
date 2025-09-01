// src/app/api/media/favorite/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req) {
    const supa = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { }
    const id = body?.id;
    if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

    // Verificar que el mensaje pertenece al usuario
    const { data: row, error: getErr } = await supa
        .from("media")
        .select("id")
        .eq("user_id", user.id)
        .eq("id", id)
        .maybeSingle();
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    // Desmarcar anterior (si existe)
    const { error: clrErr } = await supa
        .from("media")
        .update({ is_favorite: false })
        .eq("user_id", user.id)
        .eq("is_favorite", true);
    if (clrErr) return NextResponse.json({ error: clrErr.message }, { status: 500 });

    // Marcar este como favorito

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
