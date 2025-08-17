/* AURA SW — cache ligero, sin romper deploys */
const CACHE_NAME = 'Respira-v1';
const OFFLINE_URL = '/offline.html';

/* Archivos “seguros” para precache (NO metas chunks con hash de Next) */
const PRECACHE = [OFFLINE_URL, '/manifest.webmanifest'];

/* En instalación: precache básico y activar rápido */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE);
      self.skipWaiting();
    })()
  );
});

/* Reclamar clientes al activar (evita quedarse esperando) */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // borra caches viejos (si cambiás CACHE_NAME)
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined))
      );
      self.clients.claim();
    })()
  );
});

/* Estrategia:
   - Navegaciones (mode: 'navigate'): network-first con fallback offline.html
   - Assets estáticos: cache-first (light)
*/
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Navegaciones (rutas de la app)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          return fresh;
        } catch (err) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(OFFLINE_URL);
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Activos estáticos GET (imágenes, css, etc.)
  if (request.method === 'GET' && /\.(png|jpg|jpeg|webp|gif|svg|ico|css)$/.test(request.url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return new Response('', { status: 404 });
        }
      })()
    );
  }
});
