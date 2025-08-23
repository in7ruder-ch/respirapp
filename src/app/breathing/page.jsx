'use client';

import '@/styles/App.css';
import '@/styles/Breathing.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import BreathingSelector from '@/components/BreathingSelector';

export default function BreathingPage() {
  // No hay pestaña específica para "Respirar" en la BottomNav,
  // dejamos 'home' para mantener el look coherente.
  const activeNav = 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ paddingBottom: 24 }}>
          <h2>🌬️ Respiración guiada</h2>
          <p className="muted" style={{ marginTop: 6, marginBottom: 12 }}>
            Elegí una técnica para practicar ahora.
          </p>

          <BreathingSelector />
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
