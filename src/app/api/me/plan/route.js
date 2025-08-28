// src/app/api/me/plan/route.js
import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/supabaseServer.js';
import { getUserPlan } from '@/lib/plan.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const tier = await getUserPlan(userId);
    return NextResponse.json({ tier });
  } catch (e) {
    if (e?.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
    }
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 });
  }
}
