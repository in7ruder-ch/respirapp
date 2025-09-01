'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

const fetcher = (u)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function PremiumPage() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR('/api/me/plan', fetcher);
  const tier = data?.tier || 'free';

  const [code, setCode] = useState('');
  const [status, setStatus] = useState(null);

  async function onRedeem(e) {
    e.preventDefault();
    setStatus({ t:'loading', m:'Canjeando…' });
    try {
      const res = await fetch('/api/premium/redeem', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ code: code.trim() })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'ERROR');

      // éxito → refrescar SWR y redirigir
      await mutate();
      setStatus({ t:'ok', m:'¡Listo! Redirigiendo…' });
      setTimeout(()=>router.push('/'), 1500);
    } catch (err) {
      const msg = String(err?.message||'ERROR');
      const map = {
        UNAUTHENTICATED:'Iniciá sesión para canjear.',
        INVALID_CODE:'Código inválido.',
        CODE_EXPIRED:'El código está vencido.',
        CODE_MAXED:'El código alcanzó el máximo de usos.',
      };
      setStatus({ t:'err', m: map[msg] || 'No se pudo canjear.' });
    }
  }

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ padding: 24 }}>
          <h2>Premium</h2>

          {isLoading ? <p>Cargando plan…</p> : error ? (
            <p className="text-red-600">Error al cargar el plan.</p>
          ) : (
            <div className="mb-4">
              <p>Tu plan actual: <strong>{tier.toUpperCase()}</strong></p>
              {tier === 'free'
                ? <p className="muted">Con Free podés guardar 1 mensaje. Con Premium, ilimitados.</p>
                : <p className="muted">Sos Premium: almacenamiento ilimitado.</p>}
            </div>
          )}

          <form onSubmit={onRedeem} style={{ marginTop: 16 }}>
            <label className="block text-sm">¿Tenés un código?</label>
            <input
              className="w-full border rounded px-3 py-2 mt-1"
              value={code}
              onChange={(e)=>setCode(e.target.value)}
              placeholder="Ej: VIP-2025-XX"
            />
            <button
              type="submit"
              className="w-full primary mt-3"
              disabled={!code || status?.t === 'loading'}
            >
              {status?.t === 'loading' ? 'Canjeando…' : 'Canjear'}
            </button>
          </form>

          {status && (
            <p className={`mt-3 text-sm ${
              status.t==='err' ? 'text-red-600' : status.t==='ok' ? 'text-green-700' : ''
            }`}>
              {status.m}
            </p>
          )}
        </div>
      </header>
    </div>
  );
}
