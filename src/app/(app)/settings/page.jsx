'use client';

import { useEffect, useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import ContactCard from '@/components/contactCard'; // archivo: contactCard.jsx (función: ContactCard)
import { apiFetch } from '@lib/apiFetch';

export default function SettingsPage() {
  const [contact, setContact] = useState(null);
  const [hasMessage, setHasMessage] = useState(false);  // audio o video
  const [mediaKind, setMediaKind] = useState(null);     // 'audio' | 'video' | null
  const [isDeleting, setIsDeleting] = useState(false);
  const [msg, setMsg] = useState('');

  async function refreshMediaStatus() {
    try {
      const j = await apiFetch('/api/media/status', {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind: 'any' }, // ✅ unificado
      });
      setHasMessage(Boolean(j?.has));
      setMediaKind(j?.kind ?? null);
    } catch {
      setHasMessage(false);
      setMediaKind(null);
    }
  }

  async function refreshContact() {
    try {
      const res = await fetch('/api/contact', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) {
        setContact(json.contact || null);
      } else {
        setContact(null);
      }
    } catch {
      setContact(null);
    }
  }

  useEffect(() => {
    refreshContact();
    refreshMediaStatus();
  }, []);

  async function handleDelete() {
    setMsg('');
    setIsDeleting(true);
    try {
      await apiFetch('/api/media/delete', {
        method: 'POST',
        body: { kind: 'any' }, // ✅ borra audio o video (el que exista)
      });
      setMsg('Mensaje eliminado.');
      await refreshMediaStatus();
    } catch (e) {
      setMsg(e.message || 'No se pudo borrar el mensaje.');
    } finally {
      setIsDeleting(false);
    }
  }

  // En BottomNav no existe la pestaña "settings",
  // usamos 'home' como activo para mantener el look coherente.
  const activeNav = 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ paddingBottom: 24 }}>
          <h2>⚙️ Configuración</h2>

          {/* === Mensaje personal === */}
          <section className="settings-section" style={{ marginTop: 12 }}>
            <h3>Mensaje personal</h3>

            {hasMessage ? (
              <>
                <p className="muted" style={{ marginTop: 8 }}>
                  Guardado: <strong>{mediaKind}</strong>.
                </p>

                <button
                  className="delete-button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{ marginTop: 8 }}
                >
                  {isDeleting ? 'Borrando…' : '🗑️ Borrar mensaje'}
                </button>
              </>
            ) : (
              <p className="muted">No tenés un mensaje guardado.</p>
            )}

            {msg && <p style={{ marginTop: 8 }}>{msg}</p>}

            <p className="muted" style={{ marginTop: 8 }}>
              Plan Free: <strong>1 mensaje</strong> permitido (audio <em>o</em> video).
              Para ilimitados, pasá a Premium.
            </p>
          </section>

          {/* === Contacto de emergencia === */}
          <section className="settings-section" style={{ marginTop: 16 }}>
            <h3>Contacto de emergencia</h3>
            {contact?.phone ? (
              <ContactCard
                onSaved={(c) => setContact(c)}
                showQuickActions={false}
                showSMS={false}
              />
            ) : (
              <p className="muted">No tenés un contacto de emergencia guardado.</p>
            )}
          </section>
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
