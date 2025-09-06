'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

import { loadContact } from '@lib/contactsStore';
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';
import { supabase } from '@lib/supabaseClient';
import { usePlayer } from '@/components/player/PlayerProvider';

function telHref(phone) {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '#';
}

const fetcher = (u) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export default function Page() {
  const router = useRouter();
  const { playByItem } = usePlayer();

  // === SWR: MEDIA STATUS (conservamos para tu copy/UI, aunque no lo usamos para reproducir) ===
  const { data: mediaData, mutate: mutateMedia } = useSWR(
    ['/api/media/status', 'any'],
    async ([url, kind]) =>
      apiFetch(url, {
        method: 'POST',
        headers: { 'Cache-Control': 'no-store' },
        body: { kind },
      }),
    {
      revalidateOnFocus: true,
      dedupingInterval: 1500,
    }
  );
  const hasMessage = Boolean(mediaData?.has);
  const mediaKind = mediaData?.kind ?? null;

  // === SWR: PLAN ===
  const { data: planData } = useSWR('/api/me/plan', fetcher, { revalidateOnFocus: true, dedupingInterval: 1500 });
  const tier = planData?.tier || 'free';
  const isPremium = tier === 'premium';

  // === SWR: LISTA DE CONTACTOS (nuevo flujo) ===
  const { data: contactsRes, mutate: mutateContacts } = useSWR('/api/contacts/list', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  });
  const contacts = contactsRes?.items || [];
  const contactsCount = contacts.length;
  const favoriteContact = contacts.find(c => c.is_favorite) || null;

  // === SWR: LISTA DE MEDIA (para favorito/último) ===
  const { data: listData } = useSWR('/api/media/list', fetcher, { revalidateOnFocus: true, dedupingInterval: 1500 });
  const items = useMemo(() => (listData?.items || []).slice().sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)), [listData]);
  const count = items.length;

  // favorito > último
  const favorite = items.find(i => i.is_favorite);
  const latest   = items[0];
  const playable = favorite || latest;

  // === Coalesce de revalidaciones (un solo pulso) ===
  const refreshAllDebounced = useMemo(
    () =>
      debounce(() => {
        mutateMedia();
        mutateContacts();
      }, 250),
    [mutateMedia, mutateContacts]
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAllDebounced();
    });

    const onVis = () => {
      if (!document.hidden) refreshAllDebounced();
    };
    document.addEventListener('visibilitychange', onVis);

    const onStorage = (e) => {
      if (e.key && e.key.includes('sb-') && e.key.includes('-auth-token')) {
        refreshAllDebounced();
      }
    };
    window.addEventListener('storage', onStorage);

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
  }, [refreshAllDebounced]);

  // --------- Reproducir mensaje (usa Global Player) ----------
  const handlePlayMessage = async () => {
    if (!playable) {
      router.push('/library');
      return;
    }
    await playByItem({ id: playable.id, kind: playable.kind });
  };

  // --------- Llamar contacto (según plan) ----------
  const handleContact = () => {
    if (contactsCount === 0) {
      router.push('/contacts');
      return;
    }
    if (isPremium) {
      // Premium: si hay favorito → llamar; si no → ir a la lista
      if (favoriteContact?.phone) {
        window.location.href = telHref(favoriteContact.phone);
      } else {
        router.push('/contacts');
      }
      return;
    }
    // Free: un único contacto → llamar directo
    const first = contacts[0];
    if (first?.phone) {
      window.location.href = telHref(first.phone);
    } else {
      router.push('/contacts');
    }
  };

  const activeNav = 'home';

  // ---------- UI helpers ----------
  const hasAny = count > 0;

  // ✅ etiqueta según si hay favorito o no
  const playLabel = favorite ? 'Reproducir favorito' : 'Reproducir mensaje';

  // Etiqueta del tile de contacto (llamar vs gestionar)
  const contactLabel = contactsCount === 0 ? 'Contacto' : (isPremium ? (favoriteContact ? 'Llamar' : 'Contactos') : 'Llamar');

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <h1>RESPIRA</h1>
        <h2>Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad</h2>

        <div className="launcher-grid">
          {/* Mensaje */}
          {hasMessage ? (
            <button
              className="launcher-item blue"
              onClick={handlePlayMessage}
              aria-label="Reproducir mensaje"
              title={mediaKind ? `Reproducir ${mediaKind}` : 'Reproducir mensaje'}
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">{playLabel}</div>
            </button>
          ) : (
            <button
              className="launcher-item blue"
              onClick={() => router.push('/library')}
              aria-label="Ir a Biblioteca"
              title="Ir a Biblioteca para grabar tu primer mensaje"
            >
              <div className="icon-bg bg-message" aria-hidden="true" />
              <div className="label">Ir a Biblioteca</div>
            </button>
          )}

          {/* Respirar */}
          <button
            className="launcher-item green"
            onClick={() => router.push('/breathing')}
            aria-label="Respirar juntos"
          >
            <div className="icon-bg bg-breath" aria-hidden="true" />
            <div className="label">Respirar</div>
          </button>

          {/* Contacto */}
          <button
            className="launcher-item red"
            onClick={handleContact}
            aria-label="Contacto de emergencia"
            title={contactsCount === 0 ? 'Registrar contacto' : (isPremium ? (favoriteContact ? `Llamar a ${favoriteContact.name || 'contacto'}` : 'Abrir contactos') : `Llamar a ${contacts[0]?.name || 'contacto'}`)}
          >
            <div className="icon-bg bg-contact" aria-hidden="true" />
            <div className="label">{contactLabel}</div>
          </button>

          {/* Config */}
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
