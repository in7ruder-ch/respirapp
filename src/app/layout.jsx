import './globals.css';
import RegisterSW from '../components/RegisterSW';

export const metadata = {
  title: 'RESPIRApp',
  description: 'Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad',
  themeColor: '#2563eb',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.ico',            // tu favicon clásico (Next lo busca en /public, ahora lo movemos)
    shortcut: '/favicon.ico',
    apple: '/icons/icon-192.png',   // icono PWA para iOS
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
