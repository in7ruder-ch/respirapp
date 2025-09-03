'use client';
import { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerProvider';
import VideoModal from './VideoModal';

/**
 * Barra global:
 * - Audio: reproduce aquí con <audio>.
 * - Video: NO reproduce audio aquí; abre Modal.
 */
export default function GlobalPlayer() {
  const { current, status, errorMsg, pause, resume, stop, videoOpen, closeVideo } = usePlayer();
  const audioRef = useRef(null);

  // Sincronizar <audio> sólo para AUDIO
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!current || current.kind !== 'audio' || !current.url) {
      el.pause();
      el.removeAttribute('src');
      return;
    }
    el.src = current.url;

    const run = async () => {
      if (status === 'playing') {
        try { await el.play(); } catch {}
      }
    };
    run();
  }, [current, status]);

  if (!current) return null;

  const bottomNavHeight = 56;
  const barHeight = 56;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: bottomNavHeight,
          height: barHeight,
          background: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          zIndex: 50,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
        }}
      >
        {/* hidden audio element (solo audio) */}
        <audio ref={audioRef} preload="metadata" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div
            aria-label={current.kind?.toUpperCase() || 'AUDIO'}
            title={current.kind?.toUpperCase() || 'AUDIO'}
            style={{
              fontSize: 12,
              background: '#333',
              padding: '2px 6px',
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            {current.kind?.toUpperCase() || 'AUDIO'}
          </div>
          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {current.title || (current.kind === 'video' ? 'Video listo para ver' : (status === 'playing' ? 'Reproduciendo audio' : 'Audio listo'))}
          </div>
          {errorMsg && <div style={{ color: '#ff6b6b', fontSize: 12 }}>· {errorMsg}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {current.kind === 'audio' && (
            <>
              {status !== 'playing' ? (
                <button className="secondary" onClick={resume} aria-label="Reproducir" title="Reproducir">▶</button>
              ) : (
                <button className="secondary" onClick={pause} aria-label="Pausar" title="Pausar">⏸</button>
              )}
            </>
          )}
          <button className="secondary" onClick={stop} aria-label="Detener" title="Detener">⏹</button>
        </div>
      </div>

      {/* Modal de video si corresponde */}
      {current.kind === 'video' && videoOpen && (
        <VideoModal url={current.url} onClose={closeVideo} />
      )}
    </>
  );
}
