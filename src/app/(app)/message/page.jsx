'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import AudioRecorder from '@/components/AudioRecorder';
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';
import { supabase } from '@lib/supabaseClient';

export const dynamic = 'force-dynamic';

// --- fetcher SOLO para el plan: con credenciales y manejo de !ok ---
const fetcherPlan = async (u) => {
  const r = await fetch(u, { cache: 'no-store', credentials: 'include' });
  const txt = await r.text();
  const isJson = r.headers.get('content-type')?.includes('application/json');
  const data = isJson && txt ? JSON.parse(txt) : (txt || null);
  if (!r.ok) {
    // si el plan falla, tratamos como free (pero evitamos petes raros)
    return 'free';
  }
  return data;
};

// Soporta: "premium" | {tier:'premium'} | {ok:true, tier:'premium'} | {plan:'premium'}
function resolveTier(planData) {
  if (typeof planData === 'string') return planData;
  if (planData && typeof planData === 'object') {
    if (typeof planData.tier === 'string') return planData.tier;
    if (typeof planData.plan === 'string') return planData.plan;
  }
  return 'free';
}

export default function MessagePage() {
  const router = useRouter();

  // === PLAN (para gating Free vs Premium) ===
  const {
    data: planData,
  } = useSWR(`/api/me/plan?ts=${Date.now()}`, fetcherPlan, {
    revalidateOnFocus: true,
    dedupingInterval: 1000,
  });
  const tier = resolveTier(planData);
  const isPremium = tier === 'premium';

  // === SWR: estado de media (audio o video) ===
  const {
    data: mediaData,
    isLoading,
    mutate,
  } = useSWR(
    ['/api/media/status', 'any'],
    async ([url, kind]) =>
      apiFetch(url, {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind },
      }),
    {
        revalidateOnFocus: true,
        dedupingInterval: 1500,
    }
  );

  const existingKind = mediaData?.kind ?? null;
  const loading = isLoading;

  // UI local
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Coalesce de revalidaciones
  const mutateDebounced = useMemo(() => debounce(() => mutate(), 250), [mutate]);

  useEffect(() => {
    // Cambios de auth → revalidar
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      mutateDebounced();
    });

    // Volver al foreground → revalidar
    const onVis = () => { if (!document.hidden) mutateDebounced(); };
    document.addEventListener('visibilitychange', onVis);

    // Cambios de sesión en otra pestaña → revalidar
    const onStorage = (e) => {
      if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
        mutateDebounced();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      sub?.subscription?.unsubscribe?.();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
    };
  }, [mutateDebounced]);

  const onAudioReady = async () => {
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setShowAudioRecorder(false);
    await mutate(); // refresca estado (ya hay mensaje)
  };

  const activeNav = 'home';

  // 🔒 Gating: SOLO FREE con mensaje existente está bloqueado.
  const isBlockedByFreeLimit = !isPremium && !!existingKind && !loading;

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <h1>MENSAJE</h1>
        {!showAudioRecorder && <h2>Elegí cómo querés guardar tu mensaje</h2>}

        {showConfirmation && <div className="confirmation-banner">✅ Mensaje guardado</div>}

        {isBlockedByFreeLimit && !showAudioRecorder ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>
              Ya tenés un mensaje guardado (<strong>{existingKind}</strong>).
            </p>
            <p className="muted" style={{ marginTop: 6 }}>
              En plan Free podés tener 1 (audio <em>o</em> video). Para grabar uno nuevo, primero borrá el actual en Configuración.
            </p>
          </div>
        ) : (
          <>
            {!showAudioRecorder ? (
              <div className="launcher-grid" style={{ marginTop: 12 }}>
                {/* Grabar AUDIO */}
                <button
                  className="launcher-item blue"
                  onClick={() => { setShowAudioRecorder(true); setRecorderKey(k => k + 1); }}
                  aria-label="Grabar audio"
                  title="Grabar audio"
                  disabled={loading} // deshabilitamos solo si aún carga el status
                >
                  <div className="icon-bg bg-message" aria-hidden="true" />
                  <div className="label">Grabar audio</div>
                </button>

                {/* Grabar VIDEO — subruta */}
                <button
                  className="launcher-item red"
                  onClick={() => router.push('/message/video')}
                  aria-label="Grabar video"
                  title="Grabar video"
                  disabled={loading}
                >
                  <div className="icon-bg bg-message" aria-hidden="true" />
                  <div className="label">Grabar video</div>
                </button>
              </div>
            ) : (
              // Modo AUDIO elegido
              <div className="panel" style={{ marginTop: 12 }}>
                <AudioRecorder
                  key={recorderKey}
                  onAudioReady={onAudioReady}
                  hideTitle
                />
                {/* Texto de límite solo para Free */}
                {!isPremium && (
                  <p className="muted" style={{ marginTop: 8 }}>
                    Plan Free: <strong>1 mensaje total</strong> (audio <em>o</em> video).
                    Para grabar otro, primero borrá el actual en Configuración.
                  </p>
                )}
              </div>
            )}
          </>
        )}
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
