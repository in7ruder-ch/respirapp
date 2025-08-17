// src/app/page.jsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import '@/styles/App.css';
import BreathingSelector from '@/components/BreathingSelector';
import AudioRecorder from '@/components/AudioRecorder';
import ContactCard from '@/components/contactCard';
import { saveAudioBlob, getAudioBlob, deleteAudioBlob } from '@/lib/audioDB';
import { loadContact } from '@/lib/contactsStore';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

function App() {
  // modes: 'options' | 'breathing' | 'contact' | 'settings'
  const [mode, setMode] = useState('options');

  const [customUrl, setCustomUrl] = useState(null);
  const [contact, setContact] = useState(null);
  const [showInlineRecorder, setShowInlineRecorder] = useState(false);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const urlRef = useRef(null);
  const audioRef = useRef(null);

  // cargar audio/contacto al montar
  useEffect(() => {
    (async () => {
      try {
        const blob = await getAudioBlob();
        if (blob instanceof Blob) {
          const url = URL.createObjectURL(blob);
          urlRef.current = url;
          setCustomUrl(url);
        } else {
          setCustomUrl(null);
        }
      } catch (e) {
        console.error('IndexedDB get error:', e);
      }
    })();

    setContact(loadContact());

    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, []);

  // Respiración
  const handleBreathing = () => setMode('breathing');
  const handleBackToOptions = (e) => {
    e?.preventDefault?.();
    setMode('options');
  };

  // Audio
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
    } catch (err) {
      console.error('No se pudo reproducir el audio:', err);
      alert('No se pudo reproducir el audio. Verificá permisos del navegador.');
    }
  };

  const handleAudioReady = async (blob) => {
    try {
      await saveAudioBlob(blob);

      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setCustomUrl(url);

      setShowConfirmation(true);
      setTimeout(() => setShowConfirmation(false), 2000);
    } catch (e) {
      console.error('IndexedDB save error:', e);
      alert('No se pudo guardar el audio personalizado.');
    }
    setShowInlineRecorder(false); // ocultar el grabador inline
  };

  const handleDeleteAudio = async () => {
    try {
      await deleteAudioBlob();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setCustomUrl(null);

      setShowDeleteConfirmation(true);
      setTimeout(() => setShowDeleteConfirmation(false), 2000);
    } catch (e) {
      console.error('IndexedDB delete error:', e);
      alert('No se pudo eliminar el audio personalizado.');
    }
  };

  // Contacto
  const hasContact = !!(contact?.phone);
  const callHref = hasContact ? telHref(contact.phone) : '#';
  const openRegisterContact = () => setMode('contact');
  const handleContactSaved = (saved) => {
    setContact(saved || null);
    if (mode === 'contact') setMode('options');
  };

  // Render según modo
  let content = null;

  if (mode === 'breathing') {
    content = (
      <div className="panel">
        <h2>Elegí una técnica de respiración</h2>
        <BreathingSelector onBack={handleBackToOptions} setAppTitle={() => {}} />
      </div>
    );
  } else if (mode === 'contact') {
    content = (
      <div className="panel">
        <h2>Registrar contacto de emergencia</h2>
        {/* En panel de registro: solo guardar contacto */}
        <ContactCard
          onSaved={handleContactSaved}
          showDelete={false}
          showSMS={false}
          showQuickActions={false}
          hideTitle
        />
        <a href="#" className="back-link" onClick={handleBackToOptions}>
          ← Volver
        </a>
      </div>
    );
  } else if (mode === 'settings') {
    content = (
      <div className="panel">
        <h2>⚙️ Configuración</h2>

        <section className="settings-section">
          <h3>Mensaje personal</h3>
          {!customUrl ? (
            <p className="muted">No tenés un mensaje guardado.</p>
          ) : (
            <div className="settings-actions">
              <button className="delete-button" onClick={handleDeleteAudio}>
                🗑️ Borrar mensaje
              </button>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h3>Contacto de emergencia</h3>
          {hasContact ? (
            <ContactCard onSaved={handleContactSaved} showQuickActions={false} showSMS={false} />
          ) : (
            <p className="muted">No tenés un contacto de emergencia guardado.</p>
          )}
        </section>

        <a href="#" className="back-link" onClick={handleBackToOptions}>
          ← Volver
        </a>
      </div>
    );
  } else {
    // mode === 'options' (home limpia)
    content = (
      <div className="options">
        <h2>¿Querés ayuda ahora?</h2>

        {/* Audio: si no hay => Grabar inline y autoStart; si hay => Escuchar */}
        {!customUrl ? (
          <>
            {!showInlineRecorder ? (
              <button onClick={() => setShowInlineRecorder(true)}>🎤 Grabar mensaje</button>
            ) : (
              <AudioRecorder onAudioReady={handleAudioReady} hideTitle autoStart />
            )}
          </>
        ) : (
          <button onClick={handlePlayAudio}>🔊 Escuchar mensaje personal</button>
        )}

        {/* Respiración */}
        <button onClick={handleBreathing}>💨 Respirar juntos</button>

        {/* Contacto: si no hay => Registrar; si hay => Llamar */}
        {!hasContact ? (
          <button onClick={openRegisterContact}>
            🧑‍🤝‍🧑 Registrar contacto de emergencia
          </button>
        ) : (
          <button
            onClick={() => (window.location.href = callHref)}
            title={`Llamar a ${contact?.name || 'contacto'}`}
          >
            📞 Llamar contacto de emergencia
          </button>
        )}
      </div>
    );
  }

  const showHeader = mode === 'options'; // solo en home
  return (
    <div className="App">
      <header className="App-header">
        {/* ⚙️ Configuración solo visible en la home */}
        {mode === 'options' && (
          <div className="header-actions">
            <button
              type="button"
              aria-label="Abrir configuración"
              onClick={() => setMode('settings')}
              title="Configuración"
              className="icon-button"
            >
              ⚙️
            </button>
          </div>
        )}

        {showHeader && (
          <>
            <h1>AURA</h1>
            <h2>Acompañamiento Universal para Regular la Ansiedad</h2>
          </>
        )}

        {showConfirmation && (
          <div className="confirmation-banner">✅ Mensaje guardado</div>
        )}
        {showDeleteConfirmation && (
          <div className="confirmation-banner deleted">🗑️ Mensaje eliminado</div>
        )}

        {content}
      </header>
    </div>
  );
}

export default App;
