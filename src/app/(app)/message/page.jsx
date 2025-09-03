'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import { apiFetch } from '@lib/apiFetch';

const fetcher = (u) => fetch(u, { cache: 'no-store', credentials: 'include' }).then(async (r) => {
  const txt = await r.text();
  const isJson = r.headers.get('content-type')?.includes('application/json');
  const data = isJson && txt ? JSON.parse(txt) : (txt || null);
  if (!r.ok) {
    const msg = isJson ? (data?.error || JSON.stringify(data)) : (txt || 'HTTP_ERROR');
    throw new Error(msg);
  }
  return data;
});

export default function MessagePage() {
  const router = useRouter();

  // PLAN — forzamos frescura para evitar el caché post-redeem
  const { data: planData, isLoading: planLoading, error: planError, mutate: revalidatePlan } = useSWR(
    // clave única con ts para no agarrar respuestas viejas de algún proxy
    `/api/me/plan?ts=${Date.now()}`,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 1000 }
  );
  const tier = planData?.tier || 'free';
  const isPremium = tier === 'premium';

  // STATUS — solo para saber si ya existe algún mensaje (audio o video)
  const { data: statusData, isLoading: statusLoading } = useSWR(
    ['/api/media/status', 'any'],
    async ([url, kind]) =>
      apiFetch(url, {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind },
      }),
    { revalidateOnFocus: true, dedupingInterval: 1000 }
  );

  const hasAny = Boolean(statusData?.has);
  const existingKind = statusData?.kind || null;

  // Gating: SOLO Free con ≥1 mensaje ve el bloqueo.
  const isBlockedByFreeLimit = useMemo(() => !isPremium && hasAny, [isPremium, hasAny]);

  const activeNav = 'library'; // o 'home' si preferís

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ padding: 16 }}>
          <h2>MENSAJE</h2>
          <p className="muted" style={{ marginTop: 4 }}>Elegí cómo querés guardar tu mensaje</p>

          {/* BLOQUEO SOLO EN FREE */}
          {isBlockedByFreeLimit ? (
            <div className="panel" style={{ marginTop: 12, border: '1px solid #f0c', background: '#fff6fd' }}>
              <p style={{ margin: '8px 0' }}>
                Ya tenés un mensaje guardado ({existingKind || 'audio/video'}).
                <br />
                En plan Free podés tener 1. Borrá el actual para grabar otro o canjeá tu código Premium.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => router.push('/library')}>
                  Ir a Biblioteca
                </button>
                <button className="secondary" onClick={() => router.push('/premium')}>
                  Canjear código
                </button>
              </div>
            </div>
          ) : null}

          {/* ACCIONES (si Premium, siempre habilitadas; si Free + 0 mensajes, habilitadas) */}
          <div className="launcher-grid" style={{ marginTop: 16 }}>
            <button
              className={`launcher-item blue ${isBlockedByFreeLimit ? 'disabled' : ''}`}
              disabled={isBlockedByFreeLimit}
              onClick={() => router.push('/message')}
              aria-label="Grabar audio"
              title={isBlockedByFreeLimit ? 'Disponible con Premium o si no tenés mensajes' : 'Grabar audio'}
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">Grabar audio</div>
            </button>

            <button
              className={`launcher-item green ${isBlockedByFreeLimit ? 'disabled' : ''}`}
              disabled={isBlockedByFreeLimit}
              onClick={() => router.push('/message/video')}
              aria-label="Grabar video"
              title={isBlockedByFreeLimit ? 'Disponible con Premium o si no tenés mensajes' : 'Grabar video'}
            >
              <div className="icon-bg bg-breath" aria-hidden="true" />
              <div className="label">Grabar video</div>
            </button>

            {/* Accesos útiles */}
            <button
              className="launcher-item yellow"
              onClick={() => router.push('/library')}
              aria-label="Ir a Biblioteca"
            >
              <div className="icon-bg bg-config" aria-hidden="true" />
              <div className="label">Biblioteca</div>
            </button>

            {!isPremium && (
              <button
                className="launcher-item red"
                onClick={() => router.push('/premium')}
                aria-label="Canjear Premium"
              >
                <div className="icon-bg bg-contact" aria-hidden="true" />
                <div className="label">Premium</div>
              </button>
            )}
          </div>
        </div>
      </header>

      <BottomNav
        active={activeNav}
        onHome={() => router.push('/')}
        onLibrary={() => router.push('/library')}
        onPlaceholder1={() => router.push('/explore')}
        onPlaceholder2={() => router.push('/profile')}
      />
    </div>
  );
}
