'use client';
import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const swUrl = '/sw.js';

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(swUrl, { scope: '/' });
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // Nueva versión lista — podrías mostrar un aviso al usuario aquí
              console.log('[SW] Nueva versión disponible');
            }
          });
        });
      } catch (e) {
        console.error('[SW] registro falló', e);
      }
    };

    if (process.env.NODE_ENV === 'production' || location.hostname === 'localhost') {
      register();
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SKIP_WAITING' && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }, []);

  return null;
}
