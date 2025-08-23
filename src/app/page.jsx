'use client';

import { useEffect, useRef, useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import BreathingSelector from '@/components/BreathingSelector';
import AudioRecorder from '@/components/AudioRecorder';
import LoginOTP from '@/components/LoginOTP';
import ContactCard from '@/components/contactCard';

import { supabase } from '../../lib/supabaseClient';
import { loadContact } from '../../lib/contactsStore';
import { apiFetch } from '@lib/apiFetch'; // ⬅️ NUEVO: helper unificado

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

export default function Page() {
  const [mode, setMode] = useState('options');
  const [contact, setContact] = useState(null);
  const [showInlineRecorder, setShowInlineRecorder] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Estado de media en nube
  const [hasAudio, setHasAudio] = useState(false);
  const [audioCount, setAudioCount] = useState(0);

  // Loader/lock para "Escuchar mensaje"
  const [isPlayLoading, setIsPlayLoading] = useState(false);

  // 🔄 Forzar remount del AudioRecorder tras borrar / logout
  const [recorderKey, setRecorderKey] = useState(0);

  const audioRef = useRef(null);

  // 👉 rehydrate ahora devuelve el usuario para encadenar refresh con uid correcto
  const rehydrate = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      setUser(u);
      return u;
    } catch {
      return null;
    } finally {
      setInitializing(false);
    }
  };

  // Acepta uid explícito para no depender de cuándo se setea el estado `user`
  const refreshMediaStatus = async (uidExplicit) => {
    const uid = uidExplicit ?? user?.id;
    if (!uid) {
      setHasAudio(false);
      setAudioCount(0);
      return;
    }
    try {
      const j = await apiFetch('/api/media/status', {
        method: 'POST', // mantenemos tu POST actual
        headers: { 'Cache-Control': 'no-store' },
        body: { kind: 'audio' },
      });
      setHasAudio(Boolean(j?.has));
      setAudioCount(Number(j?.count || 0));
    } catch {
      setHasAudio(false);
      setAudioCount(0);
    }
  };

  const fetchSignedDownloadUrl = async () => {
    if (!user?.id) return null;
    try {
      const { url } = await apiFetch('/api/media/sign-download', {
        method: 'POST',
        body: { kind: 'audio' },
      });
      if (!url) throw new Error('No se pudo obtener URL de descarga');
      return url;
    } catch (e) {
      console.warn('sign-download error', e);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      setContact(loadContact());

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await refreshMediaStatus(u?.id); // ✅ usar el uid del evento
      });

      // ✅ encadenar refresh con el uid real retornado por rehydrate()
      const u = await rehydrate();
      await refreshMediaStatus(u?.id);

      try {
        if (sessionStorage.getItem('respirapp_just_signed_in') === '1') {
          sessionStorage.removeItem('respirapp_just_signed_in');
          setTimeout(async () => {
            const u2 = await rehydrate();
            await refreshMediaStatus(u2?.id); // ✅ pasar uid explícito
          }, 80);
        }
      } catch {}

      const onVis = async () => {
        if (!document.hidden) {
          const u3 = await rehydrate();
          await refreshMediaStatus(u3?.id);
        }
      };
      document.addEventListener('visibilitychange', onVis);

      const onStorage = async (e) => {
        if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
          const u4 = await rehydrate();
          await refreshMediaStatus(u4?.id);
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

  // ✅ En cualquier cambio de mode, ocultar inline recorder para evitar autograbados
  useEffect(() => {
    setShowInlineRecorder(false);
  }, [mode]);

  const handleBreathing = () => setMode('breathing');
  const openRegisterContact = () => setMode('contact');
  const handleContactSaved = (saved) => {
    setContact(saved || null);
    if (mode === 'contact') setMode('options');
  };

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
        audioRef.current.pause();
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

  const handleAudioReady = async (_blob) => {
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setShowInlineRecorder(false);
    await refreshMediaStatus(user?.id);
  };

  const handleDeleteInSettings = async () => {
    if (!user?.id) {
      alert('Tenés que iniciar sesión para borrar tu mensaje.');
      return;
    }
    try {
      await apiFetch('/api/media/delete', {
        method: 'POST',
        body: { kind: 'audio' },
      });

      setShowDeleteConfirmation(true);
      setTimeout(() => setShowDeleteConfirmation(false), 1500);
      await refreshMediaStatus(user?.id);
      setRecorderKey((k) => k + 1);
    } catch (e) {
      alert(e.message || 'No se pudo eliminar el audio.');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('signOut error', e);
    }

    // 🧹 Limpiar TODO el estado de la app (estado cero)
    try { sessionStorage.clear(); } catch {}
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
    setRecorderKey((k) => k + 1);
    setMode('options');
    setShowConfirmation(false);
    setShowDeleteConfirmation(false);
    setUser(null);
    setHasAudio(false);
    setAudioCount(0);
  };

  let content = null;

  if (mode === 'breathing') {
    content = (
      <div className="panel">
        <h2>Elegí una técnica de respiración</h2>
        <BreathingSelector onBack={() => setMode('options')} setAppTitle={() => {}} />
      </div>
    );
  } else if (mode === 'contact') {
    content = (
      <div className="panel">
        <h2>Registrar contacto de emergencia</h2>
        <ContactCard onSaved={handleContactSaved} showDelete={false} showSMS={false} showQuickActions={false} hideTitle />
      </div>
    );
  } else if (mode === 'settings') {
    content = (
      <div className="panel">
        <h2>⚙️ Configuración</h2>

        {/* === Mensaje personal === */}
        <section className="settings-section">
          <h3>Mensaje personal</h3>

          {hasAudio ? (
            <div className="settings-actions" style={{ gap: 8 }}>
              <button className="delete-button" onClick={handleDeleteInSettings}>
                🗑️ Borrar mensaje
              </button>
            </div>
          ) : (
            <p className="muted">No tenés un mensaje guardado.</p>
          )}

          <p className="muted" style={{ marginTop: 8 }}>
            Plan Free: 1 audio permitido. Para ilimitados, pasá a Premium.
          </p>
        </section>

        {/* === Contacto de emergencia === */}
        <section className="settings-section">
          <h3>Contacto de emergencia</h3>
          {contact?.phone ? (
            <ContactCard onSaved={handleContactSaved} showQuickActions={false} showSMS={false} />
          ) : (
            <p className="muted">No tenés un contacto de emergencia guardado.</p>
          )}
        </section>
      </div>
    );
  } else if (mode === 'library') {
    content = (
      <div className="panel">
        <h2>📚 Biblioteca</h2>
        <p className="muted">Próximamente: tus audios, videos y técnicas favoritas.</p>
      </div>
    );
  } else if (mode === 'explore') {
    content = (
      <div className="panel">
        <h2>🧭 Explorar</h2>
        <p className="muted">Próximamente: recursos y contenido recomendado.</p>
      </div>
    );
  } else if (mode === 'profile') {
    content = (
      <div className="panel">
        {initializing ? (
          <p className="muted">Cargando...</p>
        ) : user ? (
          <>
            <p className="muted">
              Sesión iniciada como <strong>{user.email}</strong>
            </p>
            <div className="settings-actions" style={{ marginTop: 12 }}>
              <button className="help-button" onClick={handleLogout}>Cerrar sesión</button>
            </div>
          </>
        ) : (
          <>
            <LoginOTP onSuccess={() => {}} />
          </>
        )}
      </div>
    );
  } else {
    // HOME (launchers)
    content = (
      <div className="launcher-grid">
        {/* Launcher Mensaje dinámico, siempre nube */}
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

        <button className="launcher-item green" onClick={handleBreathing} aria-label="Respirar juntos">
          <div className="icon-bg bg-breath" aria-hidden="true" />
          <div className="label">Respirar</div>
        </button>

        {!contact?.phone ? (
          <button className="launcher-item red" onClick={openRegisterContact} aria-label="Registrar contacto">
            <div className="icon-bg bg-contact" aria-hidden="true" />
            <div className="label">Contacto</div>
          </button>
        ) : (
          <button
            className="launcher-item orange"
            onClick={() => (window.location.href = telHref(contact.phone))}
            title={`Llamar a ${contact?.name || 'contacto'}`}
            aria-label="Llamar contacto"
          >
            <div className="icon-bg bg-contact" aria-hidden="true" />
            <div className="label">Contacto</div>
          </button>
        )}

        <button className="launcher-item yellow" onClick={() => setMode('settings')} aria-label="Configuración">
          <div className="icon-bg bg-config" aria-hidden="true" />
          <div className="label">Config.</div>
        </button>
      </div>
    );
  }

  const showHeader = mode === 'options';
  const activeNav =
    mode === 'options' ? 'home'
    : mode === 'library' ? 'library'
    : mode === 'explore' ? 'p1'
    : mode === 'profile' ? 'p2'
    : 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        {showHeader && (
          <>
            <h1>RESPIRA</h1>
            <h2>Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad</h2>
          </>
        )}
        {showConfirmation && <div className="confirmation-banner">✅ Mensaje guardado</div>}
        {showDeleteConfirmation && <div className="confirmation-banner deleted">🗑️ Mensaje eliminado</div>}
        {content}
      </header>
      <BottomNav
        active={activeNav}
        onHome={() => setMode('options')}
        onLibrary={() => setMode('library')}
        onPlaceholder1={() => setMode('explore')}
        onPlaceholder2={() => setMode('profile')}
      />
    </div>
  );
}
