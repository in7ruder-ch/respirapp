import './globals.css';

export const metadata = {
  title: 'RESPIRApp',
  description: 'Respuesta Efectiva para Situaciones de Pánico y Reducción de Ansiedad',
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
