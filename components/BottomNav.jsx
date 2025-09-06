'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '@/styles/App.css'
import '@/styles/BottomNav.css';

const NAV_ITEMS = [
  { id: 'home',    label: 'Inicio',     emoji: '🏠', href: '/' },
  { id: 'library', label: 'Biblioteca', emoji: '📚', href: '/library' },
  { id: 'p1',      label: 'Explorar',   emoji: '🧭', href: '/explore' },
  { id: 'p2',      label: 'Perfil',     emoji: '👤', href: '/profile' },
];

export default function BottomNav({
  active,              // 'home' | 'library' | 'p1' | 'p2' (opcional, override)
  onHome,
  onLibrary,
  onPlaceholder1,
  onPlaceholder2,
}) {
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    NAV_ITEMS.forEach((i) => {
      try {
        router.prefetch?.(i.href);
      } catch {}
    });
  }, [router]);

  const autoActiveId = (() => {
    if (pathname === '/' || pathname === '/(app)' || pathname === '/(app)/') return 'home';
    if (pathname.startsWith('/library') || pathname.startsWith('/(app)/library')) return 'library';
    if (pathname.startsWith('/explore') || pathname.startsWith('/(app)/explore')) return 'p1';
    if (pathname.startsWith('/profile')) return 'p2';
    return 'home';
  })();

  const resolvedActive = active || autoActiveId;

  const cbMap = {
    home: onHome,
    library: onLibrary,
    p1: onPlaceholder1,
    p2: onPlaceholder2,
  };

  const Item = ({ id, label, emoji, href }) => {
    const isActive = resolvedActive === id;
    const onClick = cbMap[id] || (() => router.push(href));
    return (
      <button
        className={`bn-item ${isActive ? 'is-active' : ''}`}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={onClick}
        type="button"
      >
        <span className="bn-icon" aria-hidden="true">{emoji}</span>
        <span className="bn-label">{label}</span>
      </button>
    );
  };

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación inferior">
      {NAV_ITEMS.map((i) => (
        <Item key={i.id} id={i.id} label={i.label} emoji={i.emoji} href={i.href} />
      ))}
    </nav>
  );
}
