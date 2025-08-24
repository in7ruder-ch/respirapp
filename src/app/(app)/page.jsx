'use client';

import { useEffect, useRef, useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import AudioRecorder from '@/components/AudioRecorder';

import { supabase } from '@lib/supabaseClient';
import { loadContact } from '@lib/contactsStore'; // fallback legacy (podemos remover luego)
import { apiFetch } from '@lib/apiFetch';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

export default function Page() {
  // Sesión/estado
  const [user, setUser] = useState(null);
  const [contact, setContact] = useState(null);

  // Media
  const [hasAudio, setHasAudio] = useState(false);
  const [isPlayLoading, setIsPlayLoading] = useState(false);
  const [recorderKey, setRecorderKey] = useState(0);
  const [showInlineRecorder, setShowInlineRecorder] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const audioRef = useRef(null);

  // --------- Helpers contacto (cloud) ----------
  const refreshContact = async () => {
    try {
      // Intento 1: nube
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
      // si la API no ok, caigo a legacy
      try {
        setContact(loadContact() || null);
      } catch {
        setContact(null);
      }
    } catch {
      // Intento 2: legacy local (por compatibilidad)
      try {
        setContact(loadContact() || null);
      } catch {
        setContact(null);
      }
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
      setHasAudio(false);
      return;
    }
    try {
      const j = await apiFetch('/api/media/status', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind: 'audio' },
      });
      setHasAudio(Boolean(j?.has));
    } catch {
      setHasAudio(false);
    }
  };

  const fetchSignedDownloadUrl = async () => {
    if (!user?.id) return null;
    try {
      const { url } = await apiFetch('/api/media/sign-download', {
        method: 'POST',
        body: { kind: 'audio' },
      });
      return url || null;
    } catch (e) {
      console.warn('sign-download error', e);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      // Cargar contacto desde la nube (con fallback legacy)
      await refreshContact();

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await refreshMediaStatus(u?.id);
        await refreshContact(); // <— también refrescamos contacto al cambiar auth
      });

      const u = await rehydrate();
      await refreshMediaStatus(u?.id);

      try {
        if (sessionStorage.getItem('respirapp_just_signed_in') === '1') {
          sessionStorage.removeItem('respirapp_just_signed_in');
          setTimeout(async () => {
            const u2 = await rehydrate();
            await refreshMediaStatus(u2?.id);
            await refreshContact(); // <— refresco contacto post-login
          }, 80);
        }
      } catch {}

      const onVis = async () => {
        if (!document.hidden) {
          const u3 = await rehydrate();
          await refreshMediaStatus(u3?.id);
          await refreshContact(); // <— refresco al volver a la pestaña
        }
      };
      document.addEventListener('visibilitychange', onVis);

      const onStorage = async (e) => {
        // Cambios de token de auth (multi-tab) y/o migración legacy
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
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current = null;
      }
    };
  }, []);

  // --------- Handlers ----------
  const handlePlayAudio = async () => {
    if (isPlayLoading) return;
    setIsPlayLoading(true);
    try {
      const signedUrl = await fetchSignedDownloadUrl();
      if (!signedUrl) {
        alert('No se pudo obtener tu mensaje para reproducirlo. Probá nuevamente más tarde.');
        setIsPlayLoading(false);
        return;
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current.src = '';
        audioRef.current = null;
      }
      const audio = new Audio(signedUrl);
      audioRef.current = audio;
      audio.load();
      await audio.play();
    } catch {
      alert('No se pudo reproducir el audio. Verificá permisos del navegador.');
    } finally {
      setIsPlayLoading(false);
    }
  };

  const handleAudioReady = async () => {
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setShowInlineRecorder(false);
    await refreshMediaStatus(user?.id);
  };

  // --------- Render ----------
  const activeNav = 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <h1>RESPIRA</h1>
        <h2>Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad</h2>

        {showConfirmation && <div className="confirmation-banner">✅ Mensaje guardado</div>}

        <div className="launcher-grid">
          {/* Mensaje: grabar o escuchar desde la nube */}
          {hasAudio ? (
            <button
              className="launcher-item blue"
              onClick={handlePlayAudio}
              aria-label="Escuchar mensaje"
              title="Escuchar tu mensaje guardado"
              disabled={isPlayLoading}
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">
                {isPlayLoading ? 'Cargando…' : 'Escuchar mensaje'}
              </div>
            </button>
          ) : (
            !showInlineRecorder ? (
              <button
                className="launcher-item blue"
                onClick={() => { setShowInlineRecorder(true); setRecorderKey(k => k + 1); }}
                aria-label="Grabar mensaje"
              >
                <div className="icon-bg bg-message" aria-hidden="true" />
                <div className="label">Grabar mensaje</div>
              </button>
            ) : (
              <div className="tile-span-2">
                <AudioRecorder
                  key={recorderKey}
                  onAudioReady={handleAudioReady}
                  hideTitle
                  locked={hasAudio}
                />
              </div>
            )
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
