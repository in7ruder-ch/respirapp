// src/app/api/premium/redeem/route.js
import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabaseServer.js';
import { redeemPremiumCode } from '@/lib/plan.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const userId = await getAuthUserId();

    let body = {};
    try { body = await req.json(); } catch {}
    const code = (body?.code || '').trim();
    if (!code) {
      return NextResponse.json({ error: 'MISSING_CODE' }, { status: 400 });
    }

    const result = await redeemPremiumCode(userId, code);
    return NextResponse.json({ ok: true, tier: result.tier });
  } catch (e) {
    const msg = e?.message || 'INTERNAL';
    const map = {
      UNAUTHENTICATED: 401,
      INVALID_CODE: 404,
      CODE_EXPIRED: 400,
      CODE_MAXED: 400,
    };
    return NextResponse.json({ error: msg }, { status: map[msg] ?? 500 });
  }
}
