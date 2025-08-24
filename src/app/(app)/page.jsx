'use client';

import { useEffect, useRef, useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

import { supabase } from '@lib/supabaseClient';
import { loadContact } from '@lib/contactsStore'; // fallback legacy
import { apiFetch } from '@lib/apiFetch';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

export default function Page() {
  // Sesión/estado
  const [user, setUser] = useState(null);
  const [contact, setContact] = useState(null);

  // Media (unificado)
  const [hasMessage, setHasMessage] = useState(false); // audio o video
  const [mediaKind, setMediaKind] = useState(null);    // 'audio' | 'video' | null
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  // Reproductores
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoPanel, setShowVideoPanel] = useState(false);

  // --------- Helpers contacto (cloud) ----------
  const refreshContact = async () => {
    try {
      const res = await fetch('/api/contact', { cache: 'no-store' });
      if (res.status === 401) {
        setContact(null);
        return;
      }
      const j = await res.json();
      if (res.ok) {
        setContact(j?.contact ?? null);
        return;
      }
      try { setContact(loadContact() || null); } catch { setContact(null); }
    } catch {
      try { setContact(loadContact() || null); } catch { setContact(null); }
    }
  };

  // --------- Session & status ----------
  const rehydrate = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      setUser(u);
      return u;
    } catch {
      return null;
    }
  };

  const refreshMediaStatus = async (uidExplicit) => {
    const uid = uidExplicit ?? user?.id;
    if (!uid) {
      setHasMessage(false);
      setMediaKind(null);
      return;
    }
    try {
      const j = await apiFetch('/api/media/status', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind: 'any' }, // 👈 unificado
      });
      setHasMessage(Boolean(j?.has));
      setMediaKind(j?.kind ?? null);
    } catch {
      setHasMessage(false);
      setMediaKind(null);
    }
  };

  const fetchSignedDownload = async () => {
    if (!user?.id) return { url: null, kind: null };
    try {
      const j = await apiFetch('/api/media/sign-download', {
        method: 'POST',
        body: { kind: 'any' }, // devuelve {url, kind}
      });
      return { url: j?.url || null, kind: j?.kind || null };
    } catch (e) {
      console.warn('sign-download error', e);
      return { url: null, kind: null };
    }
  };

  useEffect(() => {
    (async () => {
      await refreshContact();

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await refreshMediaStatus(u?.id);
        await refreshContact();
      });

      const u = await rehydrate();
      await refreshMediaStatus(u?.id);

      try {
        if (sessionStorage.getItem('respirapp_just_signed_in') === '1') {
          sessionStorage.removeItem('respirapp_just_signed_in');
          setTimeout(async () => {
            const u2 = await rehydrate();
            await refreshMediaStatus(u2?.id);
            await refreshContact();
          }, 80);
        }
      } catch {}

      const onVis = async () => {
        if (!document.hidden) {
          const u3 = await rehydrate();
          await refreshMediaStatus(u3?.id);
          await refreshContact();
        }
      };
      document.addEventListener('visibilitychange', onVis);

      const onStorage = async (e) => {
        if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
          const u4 = await rehydrate();
          await refreshMediaStatus(u4?.id);
          await refreshContact();
        }
      };
      window.addEventListener('storage', onStorage);

      return () => {
        sub?.subscription?.unsubscribe?.();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('storage', onStorage);
      };
    })();

    return () => {
      // limpiar players
      try { audioRef.current?.pause?.(); } catch {}
      audioRef.current = null;
      try { if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; } } catch {}
      videoRef.current = null;
    };
  }, []);

  // --------- Handlers ----------
  const handlePlayMessage = async () => {
    if (isPlayLoading) return;
    setIsPlayLoading(true);
    try {
      // Parar lo que esté sonando
      try { audioRef.current?.pause?.(); } catch {}
      try { if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; } } catch {}
      setShowVideoPanel(false);
      setVideoUrl('');

      const { url, kind } = await fetchSignedDownload();
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
        // reproducción se hace en el <video> con autoplay
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

        {/* ⬆️ Panel de reproducción de video AHORA ARRIBA de los tiles */}
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
                onClick={() => (window.location.href = '/settings')}
                title="Ir a configuración"
              >
                <div className="icon-bg bg-breath" aria-hidden="true" />
                <div className="label">Config.</div>
              </button>
            </div>
          </div>
        )}

        <div className="launcher-grid">
          {/* Mensaje: reproducir (si existe) o ir a selector /message */}
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
              onClick={() => (window.location.href = '/message')}
              aria-label="Grabar mensaje"
              title="Grabar mensaje (audio o video)"
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">Grabar mensaje</div>
            </button>
          )}

          {/* Respirar → ruta propia */}
          <button
            className="launcher-item green"
            onClick={() => (window.location.href = '/breathing')}
            aria-label="Respirar juntos"
          >
            <div className="icon-bg bg-breath" aria-hidden="true" />
            <div className="label">Respirar</div>
          </button>

          {/* Contacto: si hay número (cloud), llama; si no, va a /contact */}
          {!contact?.phone ? (
            <button
              className="launcher-item red"
              onClick={() => (window.location.href = '/contact')}
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

          {/* Config → ruta propia */}
          <button
            className="launcher-item yellow"
            onClick={() => (window.location.href = '/settings')}
            aria-label="Configuración"
          >
            <div className="icon-bg bg-config" aria-hidden="true" />
            <div className="label">Config.</div>
          </button>
        </div>
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
