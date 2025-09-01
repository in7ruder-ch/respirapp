'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import ContactCard from '@/components/contactCard'; // archivo: contactCard.jsx (función: ContactCard)
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';
import { supabase } from '@lib/supabaseClient';

const fetcher = (u) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export default function SettingsPage() {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // === SWR: estado de media (audio o video) ===
  const {
    data: mediaData,
    mutate: mutateMedia,
    isLoading: mediaLoading,
  } = useSWR(
    ['/api/media/status', 'any'],
    async ([url, kind]) =>
      apiFetch(url, {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind },
      }),
    { revalidateOnFocus: true, dedupingInterval: 1500 }
  );
  const hasMessage = Boolean(mediaData?.has);
  const mediaKind = mediaData?.kind ?? null;

  // === SWR: contacto en cloud ===
  const {
    data: contactRes,
    mutate: mutateContact,
  } = useSWR(
    '/api/contact',
    async (url) => {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('contact fetch failed');
      return r.json();
    },
    { revalidateOnFocus: true, dedupingInterval: 1500 }
  );
  const contact = contactRes?.contact ?? null;

  // === SWR: plan actual (free/premium) ===
  const { data: planData } = useSWR('/api/me/plan', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  });
  const tier = planData?.tier || 'free';
  const isPremium = tier === 'premium';

  // Coalesce de revalidaciones (un solo pulso)
  const refreshAllDebounced = useMemo(
    () =>
      debounce(() => {
        mutateMedia();
        mutateContact();
      }, 250),
    [mutateMedia, mutateContact]
  );

  useEffect(() => {
    // Cambios de auth → revalidar
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAllDebounced();
    });

    // Volver al foreground → revalidar
    const onVis = () => { if (!document.hidden) refreshAllDebounced(); };
    document.addEventListener('visibilitychange', onVis);

    // Cambios de sesión en otra pestaña → revalidar
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
  }, [refreshAllDebounced]);

  // Borrar mensaje (audio o video)
  async function handleDelete() {
    setMsg('');
    setIsDeleting(true);
    try {
      await apiFetch('/api/media/delete', { method: 'POST', body: { kind: 'any' } });
      setMsg('Mensaje eliminado.');
      await mutateMedia(); // refresca estado de media
    } catch (e) {
      setMsg(e.message || 'No se pudo borrar el mensaje.');
    } finally {
      setIsDeleting(false);
    }
  }

  const activeNav = 'settings';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ paddingBottom: 24 }}>
          <h2>⚙️ Configuración</h2>

          {/* === Plan actual === */}
          <section className="settings-section" style={{ marginTop: 12 }}>
            <h3>Tu plan</h3>
            <p>
              Plan actual: <strong>{tier.toUpperCase()}</strong>
            </p>
            {isPremium ? (
              <p className="muted" style={{ marginTop: 6 }}>
                Sos Premium: almacenamiento de mensajes <strong>ilimitado</strong>. Gestioná tus mensajes en{' '}
                <a className="underline" href="/library">Biblioteca</a>.
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 6 }}>
                Plan Free: <strong>1 mensaje</strong> permitido (audio <em>o</em> video). Para ilimitados, canjeá tu código en{' '}
                <a className="underline" href="/premium">Premium</a>.
              </p>
            )}
          </section>

          {/* === Mensajes (derivado a Biblioteca) === */}
          <section className="settings-section" style={{ marginTop: 12 }}>
            <h3>Mensajes</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              {hasMessage ? 'Tenés mensajes guardados.' : 'Aún no tenés mensajes.'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <a className="underline" href="/library">Ir a Biblioteca</a>
            </div>


          </section>

          {/* === Contacto de emergencia === */}
          <section className="settings-section" style={{ marginTop: 16 }}>
            <h3>Contacto de emergencia</h3>
            {contact?.phone ? (
              <ContactCard
                onSaved={() => mutateContact()}   // refresca SWR al guardar/borrar
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
