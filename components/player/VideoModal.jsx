'use client';
import { useEffect, useRef } from 'react';

export default function VideoModal({ url, onClose }) {
  const backdropRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 12,
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ position: 'relative', paddingTop: '56.25%' /* 16:9 */ }}>
          <video
            src={url}
            controls
            autoPlay
            playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 8, background: '#111' }}>
          <button className="secondary" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            ✕ Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
