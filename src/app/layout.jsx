// src/app/layout.jsx
import './globals.css';
import RegisterSW from '@/components/RegisterSW';
import { PlayerProvider } from '@/components/player/PlayerProvider';
import GlobalPlayer from '@/components/player/GlobalPlayer';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export const metadata = {
  title: 'RESPIRApp',
  description: 'Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
  },
};

// ✅ Viewport mobile-first + safe areas (iOS) + themeColor aquí
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: 'no',
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PlayerProvider>
            {children}
            <RegisterSW />
            <GlobalPlayer />
          </PlayerProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
