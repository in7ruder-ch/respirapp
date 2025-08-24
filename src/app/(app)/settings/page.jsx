'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import ContactCard from '@/components/contactCard'; // archivo: contactCard.jsx (función: ContactCard)
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';
import { supabase } from '@lib/supabaseClient';

export default function SettingsPage() {
  const router = useRouter();

  const [contact, setContact] = useState(null);
  const [hasMessage, setHasMessage] = useState(false);
  const [mediaKind, setMediaKind] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [msg, setMsg] = useState('');

  const refreshingRef = useRef(false);

  async function refreshMediaStatus() {
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
  }

  async function refreshContact() {
    try {
      const res = await fetch('/api/contact', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setContact(json.contact || null);
      else setContact(null);
    } catch {
      setContact(null);
    }
  }

  // Coalesce de refresh (contact + media en paralelo)
  const refreshAll = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      await Promise.all([refreshContact(), refreshMediaStatus()]);
    } finally {
      refreshingRef.current = false;
    }
  };
  const refreshAllDebounced = useMemo(() => debounce(refreshAll, 250), []);

  useEffect(() => {
    (async () => {
      await refreshAll();

      // Cambios de auth → refrescar coalesced
      const { data: sub } = supabase.auth.onAuthStateChange(() => {
        refreshAllDebounced();
      });

      // Vuelve al foreground
      const onVis = () => { if (!document.hidden) refreshAllDebounced(); };
      document.addEventListener('visibilitychange', onVis);

      // Cambios de sesión en otra pestaña
      const onStorage = (e) => {
        if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
          refreshAllDebounced();
        }
      };
      window.addEventListener('storage', onStorage);

      return () => {
        sub?.subscription?.unsubscribe?.();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('storage', onStorage);
      };
    })();
  }, [refreshAllDebounced]);

  async function handleDelete() {
    setMsg('');
    setIsDeleting(true);
    try {
      await apiFetch('/api/media/delete', {
        method: 'POST',
        body: { kind: 'any' },
      });
      setMsg('Mensaje eliminado.');
      await refreshAll();
    } catch (e) {
      setMsg(e.message || 'No se pudo borrar el mensaje.');
    } finally {
      setIsDeleting(false);
    }
  }

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
        onHome={() => router.push('/')}
        onLibrary={() => router.push('/library')}
        onPlaceholder1={() => router.push('/explore')}
        onPlaceholder2={() => router.push('/profile')}
      />
    </div>
  );
}
