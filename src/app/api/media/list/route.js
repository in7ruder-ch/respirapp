// src/app/api/media/list/route.js
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const supa = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { data, error } = await supa
    .from("media")
    .select("id, kind, created_at, is_favorite, title") // 👈 agregado title
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // fallback si title está vacío/null
  const items = (data || []).map((it) => {
    if (it?.title && it.title.trim()) return it;

    const created = it?.created_at ? new Date(it.created_at) : null;
    const when = created
      ? created.toLocaleString("es-AR", { hour12: false })
      : "";
    const kindNice =
      it?.kind === "audio"
        ? "Audio"
        : it?.kind === "video"
        ? "Video"
        : "Media";

    return {
      ...it,
      title: `${kindNice}${when ? " " + when : ""}`,
    };
  });

  return NextResponse.json({ items });
}
