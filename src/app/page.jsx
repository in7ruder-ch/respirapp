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
import { getAudioBlob } from '../../lib/audioDB'; // dejamos solo lectura por si hubiera algo local previo
import { loadContact } from '../../lib/contactsStore';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

/** Flag local usado por el AudioRecorder para el límite del plan Free */
const FREE_AUDIO_FLAG = 'respirapp_free_audio_uploaded_v1';

export default function Page() {
  const [mode, setMode] = useState('options');
  const [customUrl, setCustomUrl] = useState(null);
  const [contact, setContact] = useState(null);
  const [showInlineRecorder, setShowInlineRecorder] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Estado de media en nube para pintar Configuración correctamente
  const [hasAudio, setHasAudio] = useState(false);
  const [audioCount, setAudioCount] = useState(0);

  // 🔄 Forzar remount del AudioRecorder tras logout
  const [recorderKey, setRecorderKey] = useState(0);

  const urlRef = useRef(null);
  const audioRef = useRef(null);

  const rehydrate = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
    } catch {
    } finally {
      setInitializing(false);
    }
  };

  const refreshMediaStatus = async () => {
    try {
      const res = await fetch('/api/media/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'audio' }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j) {
        setHasAudio(Boolean(j.has));
        setAudioCount(Number(j.count || 0));
      } else {
        setHasAudio(false);
        setAudioCount(0);
      }
    } catch {
      setHasAudio(false);
      setAudioCount(0);
    }
  };

  useEffect(() => {
    (async () => {
      // Si hay un audio local viejo, lo dejamos reproducible
      try {
        const blob = await getAudioBlob();
        if (blob instanceof Blob) {
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          setCustomUrl(url);
        }
      } catch {}

      setContact(loadContact());

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        // Cambia sesión => refresco estado de media
        refreshMediaStatus();
      });

      await rehydrate();
      await refreshMediaStatus();

      try {
        if (sessionStorage.getItem('respirapp_just_signed_in') === '1') {
          sessionStorage.removeItem('respirapp_just_signed_in');
          setTimeout(() => rehydrate(), 80);
        }
      } catch {}

      const onVis = () => { if (!document.hidden) { rehydrate(); refreshMediaStatus(); } };
      document.addEventListener('visibilitychange', onVis);

      const onStorage = (e) => {
        if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
          rehydrate();
          refreshMediaStatus();
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
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  // ✅ Importante: en cualquier cambio de mode, ocultar inline recorder para evitar autograbados
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
    if (!customUrl) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      const audio = new Audio(customUrl);
      audioRef.current = audio;
      audio.load();
      await audio.play();
    } catch {
      alert('No se pudo reproducir el audio. Verificá permisos del navegador.');
    }
  };

  // Al terminar de grabar: banner + cerrar grabadora inline + refrescar estado de media
  const handleAudioReady = async (_blob) => {
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 2000);
    setShowInlineRecorder(false);
    refreshMediaStatus();
  };

  // Borrar en nube + DB (solo borra, no regraba ni abre grabadora en Configuración)
  const handleDeleteInSettings = async () => {
    if (!user?.id) {
      alert('Tenés que iniciar sesión para borrar tu mensaje.');
      return;
    }
    try {
      const res = await fetch('/api/media/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, kind: 'audio' }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'No se pudo eliminar el audio.');

      try { localStorage.removeItem(FREE_AUDIO_FLAG); } catch {}
      setShowDeleteConfirmation(true);
      setTimeout(() => setShowDeleteConfirmation(false), 1500);
      await refreshMediaStatus();
      setRecorderKey((k) => k + 1); // por si el usuario vuelve a grabar desde Home
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
    // 🧹 limpieza de estado local para que no aparezca “alcanzaste tu límite”
    try {
      localStorage.removeItem(FREE_AUDIO_FLAG);
      sessionStorage.clear();
    } catch (e) {
      console.warn('storage clear warn', e);
    }
    setRecorderKey((k) => k + 1);
    setMode('options');
    setShowConfirmation(false);
    setShowDeleteConfirmation(false);
    await rehydrate();
    await refreshMediaStatus();
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
        {/* Launcher Mensaje: ya NO navega a settings; abre grabadora inline sin autoStart */}
        {!customUrl ? (
          !showInlineRecorder ? (
            <button
              className="launcher-item blue"
              onClick={() => { setShowInlineRecorder(true); setRecorderKey(k => k + 1); }}
              aria-label="Grabar mensaje"
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">Mensaje</div>
            </button>
          ) : (
            <div className="tile-span-2">
              <AudioRecorder
                key={recorderKey}
                onAudioReady={handleAudioReady}
                hideTitle
              />
            </div>
          )
        ) : (
          <button className="launcher-item blue" onClick={handlePlayAudio} aria-label="Escuchar mensaje">
            <div className="icon-bg bg-message" aria-hidden="true" />
            <div className="label">Mensaje</div>
          </button>
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
