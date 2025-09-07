// src/app/profile/page.jsx
'use client';

import { useEffect, useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import LoginOTP from '@/components/LoginOTP';
import { supabase } from '@lib/supabaseClient';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const t = useTranslations('profile');
  const tc = useTranslations('common'); // ← mover hook fuera del JSX

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setLoggingOut(false);
    }
  }

  const activeNav = 'p2';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="tab-page">
          <h2>👤 {t('title')}</h2>
          <LanguageSwitcher />

          {loading ? (
            <p className="muted">{tc('loading')}</p>
          ) : user ? (
            <>
              <p className="muted">
                {t('loggedInAs')} <strong>{user.email}</strong>
              </p>
              <div>
                <button
                  className="help-button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? t('loggingOut') : t('logout')}
                </button>
              </div>
            </>
          ) : (
            <div>
              <LoginOTP onSuccess={() => (window.location.href = '/')} />
            </div>
          )}
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
