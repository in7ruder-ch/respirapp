'use client';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import { useTranslations } from 'next-intl';

export default function ExplorePage() {
  const t = useTranslations('explore');
  const activeNav = 'p1'; // pestaña brújula (se mantiene igual)

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="tab-page">
          <h2>🧭 {t('title')}</h2>
          <p className="muted">{t('soon')}</p>
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
