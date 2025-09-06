// src/app/layout.jsx
import './globals.css';
import RegisterSW from '@/components/RegisterSW';
import { PlayerProvider } from '@/components/player/PlayerProvider';
import GlobalPlayer from '@/components/player/GlobalPlayer';

export const metadata = {
  title: 'RESPIRApp',
  description: 'Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad',
  themeColor: '#2563eb',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
  // Opcional pero recomendable para PWA en iOS
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default', // 'black' | 'black-translucent' | 'default'
  },
};

// ✅ Viewport mobile-first + safe areas (iOS)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // habilita env(safe-area-inset-*)
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <PlayerProvider>
          {children}
          <RegisterSW />
          <GlobalPlayer />
        </PlayerProvider>
      </body>
    </html>
  );
}
