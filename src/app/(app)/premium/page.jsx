'use client';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (u)=>fetch(u,{cache:'no-store'}).then(r=>r.json());

export default function PremiumPage() {
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
      setStatus({ t:'ok', m:'¡Listo! Ya sos Premium.' });
      setCode('');
      mutate();
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
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-3">Premium</h1>

      {isLoading ? <p>Cargando plan…</p> : error ? (
        <p className="text-red-600">Error al cargar el plan.</p>
      ) : (
        <div className="mb-4 p-3 rounded border">
          <p>Tu plan actual: <strong>{tier.toUpperCase()}</strong></p>
          {tier === 'free'
            ? <p className="text-sm text-gray-600 mt-1">Con Free podés guardar 1 mensaje. Con Premium, ilimitados.</p>
            : <p className="text-sm text-green-700 mt-1">Sos Premium: almacenamiento ilimitado.</p>}
        </div>
      )}

      <form onSubmit={onRedeem} className="space-y-3">
        <label className="block text-sm">¿Tenés un código?</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={code}
          onChange={(e)=>setCode(e.target.value)}
          placeholder="Ej: VIP-2025-XX"
        />
        <button
          type="submit"
          className="w-full rounded px-4 py-2 bg-black text-white disabled:opacity-50"
          disabled={!code || status?.t === 'loading'}
        >
          Canjear
        </button>
      </form>

      {status && (
        <p className={`mt-3 text-sm ${
          status.t==='err' ? 'text-red-600' : status.t==='ok' ? 'text-green-700' : ''}`}>
          {status.m}
        </p>
      )}

      <div className="mt-6">
        <a href="/" className="underline">Volver al inicio</a>
      </div>
    </main>
  );
}
