'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

import { loadContact } from '@lib/contactsStore';
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';
import { supabase } from '@lib/supabaseClient';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

export default function Page() {
  const router = useRouter();

  // Reproductores
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  // Fallback local para contacto
  const localContactRef = useRef(loadContact() || null);

  // === SWR: MEDIA STATUS (audio o video) ===
  const {
    data: mediaData,
    mutate: mutateMedia,
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
  const hasMessage = Boolean(mediaData?.has);
  const mediaKind = mediaData?.kind ?? null;

  // === SWR: CONTACTO (cloud, con fallback local si falla) ===
  const {
    data: contactRes,
    error: contactErr,
    mutate: mutateContact,
  } = useSWR(
    '/api/contact',
    async (url) => {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('contact fetch failed');
      return r.json();
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 1500,
    }
  );
  const contact = contactRes?.contact ?? localContactRef.current;

  // === Coalesce de revalidaciones (un solo pulso) ===
  const refreshAllDebounced = useMemo(
    () =>
      debounce(() => {
        mutateMedia();
        mutateContact();
      }, 250),
    [mutateMedia, mutateContact]
  );

  useEffect(() => {
    // Primer fetch inicial (deja SWR hacer lo suyo) + subs a eventos
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAllDebounced();
    });

    const onVis = () => {
      if (!document.hidden) refreshAllDebounced();
    };
    document.addEventListener('visibilitychange', onVis);

    const onStorage = (e) => {
      if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
        refreshAllDebounced();
      }
    };
    window.addEventListener('storage', onStorage);

    // post-login flag
    try {
      if (sessionStorage.getItem('respirapp_just_signed_in') === '1') {
        sessionStorage.removeItem('respirapp_just_signed_in');
        refreshAllDebounced();
      }
    } catch {}

    return () => {
      sub?.subscription?.unsubscribe?.();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
      try { audioRef.current?.pause?.(); } catch {}
      audioRef.current = null;
      try { if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; } } catch {}
      videoRef.current = null;
    };
  }, [refreshAllDebounced]);

  // --------- Reproducir mensaje ----------
  const handlePlayMessage = async () => {
    if (isPlayLoading) return;
    setIsPlayLoading(true);
    try {
      try { audioRef.current?.pause?.(); } catch {}
      try { if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; } } catch {}
      setShowVideoPanel(false);
      setVideoUrl('');

      const j = await apiFetch('/api/media/sign-download', {
        method: 'POST',
        body: { kind: 'any' },
      });
      const url = j?.url || null;
      const kind = j?.kind || null;
      if (!url || !kind) {
        alert('No se pudo obtener tu mensaje para reproducirlo. Probá nuevamente más tarde.');
        setIsPlayLoading(false);
        return;
      }

      if (kind === 'audio') {
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.load();
        await audio.play();
      } else {
        setVideoUrl(url);
        setShowVideoPanel(true);
      }
    } catch {
      alert('No se pudo reproducir el mensaje. Verificá permisos del navegador.');
    } finally {
      setIsPlayLoading(false);
    }
  };

  const activeNav = 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <h1>RESPIRA</h1>
        <h2>Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad</h2>

        {/* Panel de video arriba de los tiles */}
        {showVideoPanel && videoUrl && (
          <div className="panel" style={{ marginTop: 16 }}>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', borderRadius: 12, background: '#000' }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                className="launcher-item yellow"
                onClick={() => {
                  try { videoRef.current?.pause?.(); } catch {}
                  setShowVideoPanel(false);
                  setVideoUrl('');
                }}
                title="Cerrar video"
              >
                <div className="icon-bg bg-config" aria-hidden="true" />
                <div className="label">Cerrar</div>
              </button>
              <button
                className="launcher-item blue"
                onClick={() => router.push('/settings')}
                title="Ir a configuración"
              >
                <div className="icon-bg bg-breath" aria-hidden="true" />
                <div className="label">Config.</div>
              </button>
            </div>
          </div>
        )}

        <div className="launcher-grid">
          {/* Mensaje */}
          {hasMessage ? (
            <button
              className="launcher-item blue"
              onClick={handlePlayMessage}
              aria-label="Reproducir mensaje"
              title={mediaKind ? `Reproducir ${mediaKind}` : 'Reproducir mensaje'}
              disabled={isPlayLoading}
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">
                {isPlayLoading ? 'Cargando…' : 'Reproducir mensaje'}
              </div>
            </button>
          ) : (
            <button
              className="launcher-item blue"
              onClick={() => router.push('/message')}
              aria-label="Grabar mensaje"
              title="Grabar mensaje (audio o video)"
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">Grabar mensaje</div>
            </button>
          )}

          {/* Respirar */}
          <button
            className="launcher-item green"
            onClick={() => router.push('/breathing')}
            aria-label="Respirar juntos"
          >
            <div className="icon-bg bg-breath" aria-hidden="true" />
            <div className="label">Respirar</div>
          </button>

          {/* Contacto */}
          {!contact?.phone ? (
            <button
              className="launcher-item red"
              onClick={() => router.push('/contact')}
              aria-label="Registrar contacto"
            >
              <div className="icon-bg bg-contact" aria-hidden="true" />
              <div className="label">Contacto</div>
            </button>
          ) : (
            <button
              className="launcher-item red"
              onClick={() => (window.location.href = telHref(contact.phone))}
              title={`Llamar a ${contact?.name || 'contacto'}`}
              aria-label="Llamar contacto"
            >
              <div className="icon-bg bg-contact" aria-hidden="true" />
              <div className="label">Llamar</div>
            </button>
          )}

          {/* Config */}
          <button
            className="launcher-item yellow"
            onClick={() => router.push('/settings')}
            aria-label="Configuración"
          >
            <div className="icon-bg bg-config" aria-hidden="true" />
            <div className="label">Config.</div>
          </button>
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
