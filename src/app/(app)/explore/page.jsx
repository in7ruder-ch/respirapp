'use client';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

export default function ExplorePage() {
  const activeNav = 'p1'; // pestaña brújula

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="tab-page">
          <h2>🧭 Explorar</h2>
          <p className="muted">Próximamente: recursos, artículos y contenido recomendado.</p>
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
