import './globals.css';

export const metadata = {
  title: 'AURA',
  description: 'Acompañamiento Universal para Regular la Ansiedad',
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
