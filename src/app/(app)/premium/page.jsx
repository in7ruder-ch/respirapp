'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';
import { useTranslations } from 'next-intl';

const fetcher = (u) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export default function PremiumPage() {
  const router = useRouter();
  const t = useTranslations('premium');

  const { data, error, isLoading, mutate } = useSWR('/api/me/plan', fetcher);
  const tier = data?.tier || 'free';

  const [code, setCode] = useState('');
  const [status, setStatus] = useState(null);

  async function onRedeem(e) {
    e.preventDefault();
    setStatus({ t: 'loading', m: t('redeeming') });
    try {
      const res = await fetch('/api/premium/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'ERROR');

      // éxito → refrescar SWR y redirigir
      await mutate();
      setStatus({ t: 'ok', m: t('okRedirect') });
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      const msg = String(err?.message || 'ERROR');
      const map = {
        UNAUTHENTICATED: t('err.unauth'),
        INVALID_CODE:    t('err.invalid'),
        CODE_EXPIRED:    t('err.expired'),
        CODE_MAXED:      t('err.maxed'),
      };
      setStatus({ t: 'err', m: map[msg] || t('err.generic') });
    }
  }

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ padding: 24 }}>
          <h2>{t('title')}</h2>

          {isLoading ? <p>{t('loadingPlan')}</p> : error ? (
            <p className="text-red-600">{t('loadError')}</p>
          ) : (
            <div className="mb-4">
              <p>
                {
                  t.rich('currentPlan', {
                    strong: (chunks) => <strong>{chunks}</strong>,
                    tier: tier.toUpperCase(),
                  })
                }
              </p>
              {tier === 'free'
                ? <p className="muted">{t('freeHint')}</p>
                : <p className="muted">{t('premiumHint')}</p>}
            </div>
          )}

          <form onSubmit={onRedeem} style={{ marginTop: 16 }}>
            <label className="block text-sm">{t('haveCode')}</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('placeholder')}
            />
            <button
              type="submit"
              className="w-full primary mt-3"
              disabled={!code || status?.t === 'loading'}
            >
              {status?.t === 'loading' ? t('redeeming') : t('redeem')}
            </button>
          </form>

          {status && (
            <p
              className={`mt-3 text-sm ${
                status.t === 'err'
                  ? 'text-red-600'
                  : status.t === 'ok'
                  ? 'text-green-700'
                  : ''
              }`}
            >
              {status.m}
            </p>
          )}
        </div>
      </header>
    </div>
  );
}
