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
              // Cerrar cámara y volver a Inicio (client-side)
              setTimeout(() => router.replace('/'), 200);
            }}
            hideTitle
          />
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
