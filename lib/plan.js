// lib/plan.js
import { supabaseService } from './supabaseServer.js';

export async function getUserPlan(userId) {
  const svc = supabaseService();

  const { data, error } = await svc
    .from('subscriptions')
    .select('tier, valid_until, created_at')
    .eq('user_id', userId)
    .eq('tier', 'premium')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return 'free';
  if (!data.valid_until) return 'premium';
  return new Date(data.valid_until) > new Date() ? 'premium' : 'free';
}

export async function redeemPremiumCode(userId, code) {
  const svc = supabaseService();

  // 1) Traer el código
  const { data: row, error: codeErr } = await svc
    .from('premium_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (codeErr) throw codeErr;
  if (!row) throw new Error('INVALID_CODE');

  // 2) Validaciones
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    throw new Error('CODE_EXPIRED');
  }
  if (row.uses >= row.max_uses) {
    throw new Error('CODE_MAXED');
  }

  // 3) Upsert de suscripción premium (sin vencimiento por defecto)
  const { error: subErr } = await svc
    .from('subscriptions')
    .upsert(
      { user_id: userId, tier: 'premium', valid_until: null },
      { onConflict: 'user_id,tier' }
    );
  if (subErr) throw subErr;

  // 4) Incrementar contador del código
  const { error: updErr } = await svc
    .from('premium_codes')
    .update({
      uses: row.uses + 1,
      last_used_by: userId,
      last_used_at: new Date().toISOString(),
    })
    .eq('code', code);

  if (updErr) throw updErr;

  return { tier: 'premium' };
}
