'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import VideoRecorder from '@/components/VideoRecorder';

export const dynamic = 'force-dynamic';

export default function MessageVideoPage() {
  const [saved, setSaved] = useState(false);
  const activeNav = 'home';
  const router = useRouter();

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
              // Redirigimos a Inicio para cerrar cámara y dar feedback claro.
              // Al desmontar, VideoRecorder apaga los tracks.
              setTimeout(() => router.replace('/'), 200);
            }}
            hideTitle
          />
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
