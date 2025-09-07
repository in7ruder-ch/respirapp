// src/app/(app)/layout.jsx
import {redirect} from 'next/navigation';
import {createServerComponentClient} from '@supabase/auth-helpers-nextjs';
import {cookies} from 'next/headers';

import '@/styles/App.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';

export default async function AppLayout({children}) {
  // Next 15: cookies() await + pasar como función
  const cookieStore = await cookies();
  const supabase = createServerComponentClient({
    cookies: () => cookieStore
  });

  const {
    data: {session}
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/profile');
  }

  // Ítems serializables (sin handlers). Si luego usamos i18n, acá
  // reemplazamos href/label con withLocale() y traducciones.
  const navItems = [
    { id: 'home',    label: 'Inicio',     emoji: '🏠', href: '/' },
    { id: 'library', label: 'Biblioteca', emoji: '📚', href: '/library' },
    { id: 'p1',      label: 'Explorar',   emoji: '🧭', href: '/explore' },
    { id: 'p2',      label: 'Perfil',     emoji: '👤', href: '/profile' },
  ];

  return (
    <div className="App has-bottom-nav">
      <main className="page">{children}</main>
      <BottomNav items={navItems} />
    </div>
  );
}
