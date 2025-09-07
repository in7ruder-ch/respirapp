'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

import '@/styles/App.css';
import '@/styles/BottomNav.css';
import '@/styles/Settings.css';

import BottomNav from '@/components/BottomNav';
import { apiFetch } from '@lib/apiFetch';
import { debounce } from '@lib/debounce';
import { supabase } from '@lib/supabaseClient';
import { useTranslations } from 'next-intl';

const fetcher = (u) => fetch(u, { cache: 'no-store' }).then(r => r.json());

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations('settings');
  const tNav = useTranslations('nav');

  const [msg, setMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // === SWR: estado de media (audio o video) ===
  const {
    data: mediaData,
    mutate: mutateMedia,
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

  // === SWR: lista de contactos (nuevo flujo) ===
  const { data: contactsRes } = useSWR('/api/contacts/list', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  });
  const contacts = contactsRes?.items || [];
  const contactsCount = contacts.length;
  const fav = contacts.find(c => c.is_favorite);

  // === SWR: plan actual (free/premium) ===
  const { data: planData } = useSWR('/api/me/plan', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  });
  const tier = planData?.tier || 'free';
  const isPremium = tier === 'premium';

  // Coalesce de revalidaciones
  const refreshAllDebounced = useMemo(
    () =>
      debounce(() => {
        mutateMedia();
      }, 250),
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
      setMsg(t('deleteSuccess'));
      await mutateMedia();
    } catch (e) {
      setMsg(e.message || t('deleteError'));
    } finally {
      setIsDeleting(false);
    }
  }

  const activeNav = 'settings';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel settings-panel">
          <h2>⚙️ {t('title')}</h2>

          {/* Plan actual */}
          <section className="settings-section">
            <h3>{t('planTitle')}</h3>
            <p>
              {t('currentPlan')} <strong>{tier.toUpperCase()}</strong>
            </p>
            {isPremium ? (
              <p className="muted">
                {t('premiumNote')}{' '}
                <a className="underline" href="/library">{tNav('library')}</a>.
              </p>
            ) : (
              <p className="muted">
                {t('freeNote')}{' '}
                <a className="underline" href="/premium">{t('premiumLink')}</a>.
              </p>
            )}
          </section>

          {/* Contactos */}
          <section className="settings-section">
            <h3>{t('contactsTitle')}</h3>
            {contactsCount === 0 ? (
              <>
                <p className="muted">{t('noContacts')}</p>
                <button className="primary" onClick={() => router.push('/contacts')}>
                  ➕ {t('addContact')}
                </button>
              </>
            ) : (
              <>
                <p>
                  {t('contactsCount', { count: contactsCount })}{' '}
                  {fav ? (
                    <>
                      {t('favorite')}: <strong>{fav.name}</strong>.
                    </>
                  ) : null}
                </p>
                <div className="settings-actions">
                  <button className="primary" onClick={() => router.push('/contacts')}>
                    {t('manageContacts')}
                  </button>
                </div>
              </>
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
