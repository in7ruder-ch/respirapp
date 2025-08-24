'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

import { supabase } from '@lib/supabaseClient';
import { loadContact } from '@lib/contactsStore';
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

export default function Page() {
  const router = useRouter();

  // Sesión/estado
  const [user, setUser] = useState(null);
  const [contact, setContact] = useState(null);

  // Media (unificado)
  const [hasMessage, setHasMessage] = useState(false);
  const [mediaKind, setMediaKind] = useState(null);
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  // Reproductores
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [showVideoPanel, setShowVideoPanel] = useState(false);

  // Flag para evitar refrescos concurrentes
  const refreshingRef = useRef(false);

  // --------- Helpers contacto ----------
  const refreshContact = async () => {
    try {
      const res = await fetch('/api/contact', { cache: 'no-store' });
      if (res.status === 401) {
        setContact(null);
        return;
      }
      const j = await res.json();
      if (res.ok) setContact(j?.contact ?? null);
      else setContact(loadContact() || null);
    } catch {
      setContact(loadContact() || null);
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
        body: { kind: 'any' },
      });
      setHasMessage(Boolean(j?.has));
      setMediaKind(j?.kind ?? null);
    } catch {
      setHasMessage(false);
      setMediaKind(null);
    }
  };

  // 👉 Refresco coalesced (rehidrata y luego actualiza media+contact en paralelo)
  const refreshAll = async () => {
    if (refreshingRef.current) return;        // evita overlap
    refreshingRef.current = true;
    try {
      const u = await rehydrate();
      await Promise.all([refreshMediaStatus(u?.id), refreshContact()]);
    } finally {
      refreshingRef.current = false;
    }
  };

  // Debounce para eventos ruidosos (focus/visibilidad/storage/auth)
  const refreshAllDebounced = useMemo(() => debounce(refreshAll, 250), []);

  useEffect(() => {
    (async () => {
      // Primer render: refresh directo (sin debounce)
      await refreshAll();

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        // actualizamos user rápido y coalescemos el refresh
        setUser(session?.user ?? null);
        refreshAllDebounced();
      });

      // Volver al app / pestaña
      const onVis = () => {
        if (!document.hidden) refreshAllDebounced();
      };
      document.addEventListener('visibilitychange', onVis);

      // Cambios de sesión en otra pestaña
      const onStorage = (e) => {
        if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
          refreshAllDebounced();
        }
      };
      window.addEventListener('storage', onStorage);

      // Post-login flag
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
      };
    })();

    return () => {
      // limpiar players
      try { audioRef.current?.pause?.(); } catch {}
      audioRef.current = null;
      try { if (videoRef.current) { videoRef.current.pause(); videoRef.current.src = ''; } } catch {}
      videoRef.current = null;
    };
  }, [refreshAllDebounced]); // estable por useMemo

  // --------- Handlers ----------
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

        {/* Panel de reproducción de video arriba de los tiles */}
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

          <button
            className="launcher-item green"
            onClick={() => router.push('/breathing')}
            aria-label="Respirar juntos"
          >
            <div className="icon-bg bg-breath" aria-hidden="true" />
            <div className="label">Respirar</div>
          </button>

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
