'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import '@/styles/BottomNav.css';

const NAV_ITEMS = [
  { id: 'home',    label: 'Inicio',     href: '/' },
  { id: 'library', label: 'Biblioteca', href: '/library' },
  { id: 'p1',      label: 'Explorar',   href: '/explore' },
  { id: 'p2',      label: 'Perfil',     href: '/profile' },
];

function Icon({ id }) {
  const common = { className: 'icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' };
  switch (id) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z" strokeWidth="1.8" />
        </svg>
      );
    case 'library':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="6" height="18" rx="1.5" strokeWidth="1.8" />
          <rect x="14" y="3" width="6" height="18" rx="1.5" strokeWidth="1.8" />
        </svg>
      );
    case 'p1': // explorar
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" strokeWidth="1.8" />
          <path d="M21 21l-4.35-4.35" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'p2': // perfil
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" strokeWidth="1.8" />
          <path d="M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

/**
 * BottomNav (Spotify-like)
 * - Si NO se pasan onHome/onLibrary/onPlaceholder1/onPlaceholder2: hace router.push()
 * - Si se pasan: ejecuta el callback y NO navega (el callback decide).
 * - Activo: se detecta por URL; prop `active` es override opcional.
 */
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
      try { router.prefetch?.(i.href); } catch {}
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

  const Item = ({ id, label, href }) => {
    const isActive = resolvedActive === id;
    const onClick = cbMap[id] || (() => router.push(href));
    return (
      <button
        className={`bn-item ${isActive ? 'active' : ''}`}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={onClick}
        type="button"
      >
        <Icon id={id} />
        <span className="label">{label}</span>
      </button>
    );
  };

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación inferior">
      {NAV_ITEMS.map((i) => (
        <Item key={i.id} id={i.id} label={i.label} href={i.href} />
      ))}
    </nav>
  );
}
