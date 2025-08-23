'use client';

import '@/styles/App.css';
import '@/styles/ContactCard.css';
import '@/styles/BottomNav.css';

import BottomNav from '@/components/BottomNav';
import ContactCard from '@/components/contactCard';
import { useEffect, useState } from 'react';
import { loadContact } from '@lib/contactsStore';

export default function ContactPage() {
  const [contact, setContact] = useState(null);
  const activeNav = 'home'; // mantenemos home como activo para coherencia visual

  useEffect(() => {
    setContact(loadContact());
  }, []);

  return (
    <div className="App has-bottom-nav">
      <header className="App-header">
        <div className="panel" style={{ paddingBottom: 24 }}>
          <h2>📇 Contacto de emergencia</h2>

          <div style={{ marginTop: 12 }}>
            <ContactCard
              onSaved={(c) => setContact(c)}
              showDelete={false}
              showSMS={false}
              showQuickActions={false}
              hideTitle
            />
          </div>
        </div>
      </header>

      <BottomNav
        active={activeNav}
        onHome={() => (window.location.href = '/')}
        onLibrary={() => (window.location.href = '/library')}
        onPlaceholder1={() => (window.location.href = '/explore')}
        onPlaceholder2={() => (window.location.href = '/profile')}
      />
    </div>
  );
}
