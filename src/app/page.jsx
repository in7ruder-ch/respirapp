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

  // navegación simple
  const handleBackToOptions = (e) => {
    e?.preventDefault?.();
    setMode('options');
  };

  // Respiración
  const handleBreathing = () => setMode('breathing');

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
    // mode === 'options' (home estilo launcher con 4 tiles)
    content = (
      <div className="launcher-grid">
        {/* AUDIO */}
        {!customUrl ? (
          !showInlineRecorder ? (
            <button
              className="launcher-item blue"
              onClick={() => setShowInlineRecorder(true)}
              aria-label="Grabar mensaje"
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">Mensaje</div>
            </button>
          ) : (
            <div className="tile-span-2">
              <AudioRecorder onAudioReady={handleAudioReady} hideTitle autoStart />
            </div>
          )
        ) : (
          <button
            className="launcher-item blue"
            onClick={handlePlayAudio}
            aria-label="Escuchar mensaje"
          >
            <div className="icon-bg bg-message" aria-hidden="true" />
            <div className="label">Mensaje</div>
          </button>
        )}

        {/* RESPIRACIÓN */}
        <button
          className="launcher-item green"
          onClick={handleBreathing}
          aria-label="Respirar juntos"
        >
          <div className="icon-bg bg-breath" aria-hidden="true" />
          <div className="label">Respirar</div>
        </button>

        {/* CONTACTO */}
        {!hasContact ? (
          <button
            className="launcher-item red"
            onClick={openRegisterContact}
            aria-label="Registrar contacto"
          >
            <div className="icon-bg bg-contact" aria-hidden="true" />
            <div className="label">Contacto</div>
          </button>
        ) : (
          <button
            className="launcher-item orange"
            onClick={() => (window.location.href = callHref)}
            title={`Llamar a ${contact?.name || 'contacto'}`}
            aria-label="Llamar contacto"
          >
            <div className="icon-bg bg-contact" aria-hidden="true" />
            <div className="label">Contacto</div>
          </button>
        )}

        {/* CONFIGURACIÓN (cuarto tile) */}
        <button
          className="launcher-item yellow"
          onClick={() => setMode('settings')}
          aria-label="Configuración"
        >
          <div className="icon-bg bg-config" aria-hidden="true" />
          <div className="label">Config.</div>
        </button>
      </div>
    );
  }

  const showHeader = mode === 'options'; // solo en home
  return (
    <div className="App">
      <header className="App-header">
        {showHeader && (
          <>
            <h1>RESPIRA</h1>
            <h2>Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad</h2>
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
