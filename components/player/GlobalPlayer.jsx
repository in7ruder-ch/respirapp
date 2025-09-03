'use client';
import { useEffect, useRef } from 'react';
import { usePlayer } from './PlayerProvider';
import VideoModal from './VideoModal';

/**
 * Barra global tipo Spotify.
 * - Audio: reproduce en background sin cambiar de ruta.
 * - Video: permite "Ver video" en un modal (audio puede seguir sonando en la barra).
 */
export default function GlobalPlayer() {
  const { current, status, errorMsg, pause, resume, stop, openVideo, videoOpen, closeVideo } = usePlayer();
  const audioRef = useRef(null);

  // Sincronizar <audio> con el estado global
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (!current || !current.url) {
      el.removeAttribute('src');
      return;
    }
    // Para audio y también para el audio del video (si se quisiera escuchar sin modal)
    el.src = current.url;

    const run = async () => {
      try {
        await el.play();
      } catch {
        // autoplay puede necesitar interacción; ignoramos aquí
      }
    };
    run();
  }, [current]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    if (status === 'playing') {
      el.play().catch(() => {});
    } else if (status === 'paused') {
      el.pause();
    } else if (status === 'idle' || status === 'error') {
      el.pause();
      el.currentTime = 0;
    }
  }, [status]);

  if (!current) return null;

  // Estilos simples para no chocar con tu BottomNav (que está fijo abajo)
  // Dejamos esta barra por encima del contenido y por encima del BottomNav con un offset.
  const bottomNavHeight = 56; // aprox. alto de tu BottomNav
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
        {/* hidden audio element */}
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
            {current.title || (current.kind === 'video' ? 'Reproduciendo video' : 'Reproduciendo audio')}
          </div>
          {errorMsg && <div style={{ color: '#ff6b6b', fontSize: 12 }}>· {errorMsg}</div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status !== 'playing' ? (
            <button className="secondary" onClick={resume} aria-label="Reproducir" title="Reproducir">
              ▶
            </button>
          ) : (
            <button className="secondary" onClick={pause} aria-label="Pausar" title="Pausar">
              ⏸
            </button>
          )}

          {current.kind === 'video' && (
            <button className="secondary" onClick={openVideo} aria-label="Ver video" title="Ver video">
              🎞️ Ver
            </button>
          )}

          <button className="secondary" onClick={stop} aria-label="Detener" title="Detener">
            ⏹
          </button>
        </div>
      </div>

      {/* Modal de video */}
      {current.kind === 'video' && videoOpen && (
        <VideoModal
          url={current.url}
          onClose={closeVideo}
          // si querés pausar el audio al abrir el modal, puedes controlar via onOpen/onClose con pause/resume
        />
      )}
    </>
  );
}
