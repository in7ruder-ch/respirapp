'use client';

import { useState } from 'react';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import VideoRecorder from '@/components/VideoRecorder';

export const dynamic = 'force-dynamic';

export default function MessageVideoPage() {
  const [saved, setSaved] = useState(false);
  const activeNav = 'home';

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <h1>MENSAJE</h1>
        <h2>Grabar video</h2>

        {saved && <div className="confirmation-banner">✅ Video guardado</div>}

        <div className="panel" style={{ marginTop: 12 }}>
          <VideoRecorder
            onVideoReady={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 1800);
            }}
            hideTitle
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="launcher-item blue"
              onClick={() => (window.location.href = '/')}
              aria-label="Volver al inicio"
              title="Volver al inicio"
            >
              <div className="icon-bg bg-breath" aria-hidden="true" />
              <div className="label">Inicio</div>
            </button>
            <button
              className="launcher-item yellow"
              onClick={() => (window.location.href = '/settings')}
              aria-label="Configuración"
              title="Configuración"
            >
              <div className="icon-bg bg-config" aria-hidden="true" />
              <div className="label">Config.</div>
            </button>
          </div>
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
