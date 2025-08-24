'use client';

import { useEffect, useRef, useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import AudioRecorder from '@/components/AudioRecorder';
import { apiFetch } from '@lib/apiFetch';

export const dynamic = 'force-dynamic';

export default function MessagePage() {
  // Estado de existencia: null | 'audio' | 'video'
  const [existingKind, setExistingKind] = useState(null);
  const [loading, setLoading] = useState(true);

  // UI local
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const audioRef = useRef(null);

  async function refreshStatus() {
    try {
      setLoading(true);
      const j = await apiFetch('/api/media/status', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind: 'any' }, // 👈 unificado: audio o video
      });
      setExistingKind(j?.kind ?? null);
    } catch {
      setExistingKind(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();

    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current = null;
      }
    };
  }, []);

  const onAudioReady = async () => {
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setShowAudioRecorder(false);
    await refreshStatus();
  };

  const activeNav = 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <h1>MENSAJE</h1>
        <h2>Elegí cómo querés guardar tu mensaje</h2>

        {showConfirmation && <div className="confirmation-banner">✅ Mensaje guardado</div>}

        {/* Si ya hay un mensaje (audio o video), avisamos y sugerimos gestionar en Config */}
        {!loading && existingKind && !showAudioRecorder ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <p style={{ margin: 0 }}>
              Ya tenés un mensaje guardado (<strong>{existingKind}</strong>).
            </p>
            <p className="muted" style={{ marginTop: 6 }}>
              En plan Free podés tener 1 (audio <em>o</em> video). Para grabar uno nuevo, primero borrá el actual en Configuración.
            </p>
          </div>
        ) : (
          // Si NO hay mensaje, mostramos launcher con dos opciones
          <div className="launcher-grid" style={{ marginTop: 12 }}>
            {!showAudioRecorder ? (
              <>
                {/* Grabar AUDIO */}
                <button
                  className="launcher-item blue"
                  onClick={() => { setShowAudioRecorder(true); setRecorderKey(k => k + 1); }}
                  aria-label="Grabar audio"
                  title="Grabar audio"
                >
                  <div className="icon-bg bg-message" aria-hidden="true" />
                  <div className="label">Grabar audio</div>
                </button>

                {/* Grabar VIDEO — navegamos a subruta (la creamos en el paso C) */}
                <button
                  className="launcher-item red"
                  onClick={() => (window.location.href = '/message/video')}
                  aria-label="Grabar video"
                  title="Grabar video"
                >
                  <div className="icon-bg bg-message" aria-hidden="true" />
                  <div className="label">Grabar video</div>
                </button>
              </>
            ) : (
              // Inline recorder (misma estética que ya usabas en Home)
              <div className="tile-span-2">
                <AudioRecorder
                  key={recorderKey}
                  onAudioReady={onAudioReady}
                  hideTitle
                />
              </div>
            )}
          </div>
        )}
      </header>

      <BottomNav
        active={activeNav}
        onHome={() => (window.location.href = '/')}
        onLibrary={() => (window.location.href = '/library')}
        onPlaceholder1={() => (window.location.href = '/explore')}
        onPlaceholder2={() => (window.location.href = '/profile')}
      />
    </div>
  );
}
