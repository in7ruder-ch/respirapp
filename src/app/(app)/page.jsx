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

  // Fallback local (no se usa para el click, pero lo mantenemos por compat)
  const localContactRef = useRef(loadContact() || null);

  // === SWR: MEDIA STATUS ===
  const { data: mediaData, mutate: mutateMedia } = useSWR(
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

  // === SWR: PLAN ===
  const { data: planData } = useSWR('/api/me/plan', fetcher, {
    revalidateOnFocus: true, dedupingInterval: 1500
  });
  const tier = planData?.tier || 'free';
  const isPremium = tier === 'premium';

  // === SWR: LISTA DE MEDIA (para reproducir) ===
  const { data: listData } = useSWR('/api/media/list', fetcher, {
    revalidateOnFocus: true, dedupingInterval: 1500
  });
  const items = useMemo(
    () => (listData?.items || []).slice().sort((a,b)=> new Date(b.created_at)-new Date(a.created_at)),
    [listData]
  );
  const count = items.length;
  const favorite = items.find(i => i.is_favorite);
  const latest   = items[0];
  const playable = favorite || latest;

  // === SWR: LISTA DE CONTACTOS (NUEVO: base para label + click) ===
  const { data: contactsData } = useSWR('/api/contacts/list', fetcher, {
    revalidateOnFocus: true, dedupingInterval: 1500
  });
  const contacts = useMemo(() => contactsData?.items || [], [contactsData]);
  const contactsCount = contacts.length;
  const favoriteContact = contacts.find(c => c.is_favorite) || null;

  // Para compatibilidad con el viejo contacto único:
  const deprecatedSingleContact = localContactRef.current;

  // === Coalesce revalidations ===
  const refreshAllDebounced = useMemo(
    () => debounce(() => { mutateMedia(); }, 250),
    [mutateMedia]
  );

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshAllDebounced();
    });

    const onVis = () => { if (!document.hidden) refreshAllDebounced(); };
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

  // --------- Reproducir mensaje ----------
  const handlePlayMessage = async () => {
    if (!playable) { router.push('/library'); return; }
    await playByItem({ id: playable.id, kind: playable.kind });
  };

  // --------- Click de contacto (NUEVO) ----------
  const handleContactClick = () => {
    // Sin contactos → ir a gestionar
    if (contactsCount === 0) {
      // compat: si existiera el legacy local, llamar. Si no, ir a /contacts
      if (deprecatedSingleContact?.phone && !isPremium) {
        window.location.href = telHref(deprecatedSingleContact.phone);
        return;
      }
      router.push('/contacts');
      return;
    }

    // Free: solo puede haber 1 → llamar directo
    if (!isPremium) {
      const first = contacts[0];
      if (first?.phone) window.location.href = telHref(first.phone);
      else router.push('/contacts');
      return;
    }

    // Premium:
    if (contactsCount === 1) {
      const only = contacts[0];
      if (only?.phone) window.location.href = telHref(only.phone);
      else router.push('/contacts');
      return;
    }

    // Hay varios → si hay favorito, llamar; si no, ir a la lista
    if (favoriteContact?.phone) {
      window.location.href = telHref(favoriteContact.phone);
    } else {
      router.push('/contacts');
    }
  };

  const activeNav = 'home';

  // ---------- UI helpers ----------
  const hasAny = count > 0;

  const playLabel = favorite ? 'Reproducir favorito' : 'Reproducir mensaje';

  // Etiqueta del tile de contacto
  let contactLabel = 'Contacto';
  if (contactsCount === 0) {
    contactLabel = 'Contacto';
  } else if (!isPremium) {
    contactLabel = `Llamar a ${contacts[0]?.name || 'contacto'}`;
  } else {
    if (contactsCount === 1) {
      contactLabel = `Llamar a ${contacts[0]?.name || 'contacto'}`;
    } else if (favoriteContact) {
      contactLabel = `Llamar a ${favoriteContact.name || 'contacto'}`;
    } else {
      contactLabel = 'Contactos';
    }
  }

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

          {/* Contacto (NUEVO handler + label) */}
          <button
            className="launcher-item red"
            onClick={handleContactClick}
            aria-label={contactLabel}
            title={contactLabel}
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
