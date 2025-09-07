'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import '@/styles/BottomNav.css';

const NAV_ITEMS = [
  { id: 'home',    label: 'Inicio',     emoji: '🏠', href: '/' },
  { id: 'library', label: 'Biblioteca', emoji: '📚', href: '/library' },
  { id: 'p1',      label: 'Explorar',   emoji: '🧭', href: '/explore' },
  { id: 'p2',      label: 'Perfil',     emoji: '👤', href: '/profile' },
];

export default function BottomNav({ items }) {
  const pathname = usePathname();
  const router   = useRouter();
  const navItems = items?.length ? items : NAV_ITEMS;

  useEffect(() => {
    // Prefetch preventivo (Link ya prefetch-ea en viewport, esto es extra)
    try {
      navItems.forEach(i => router.prefetch?.(i.href));
    } catch {}
  }, [router, navItems]);

  const isActive = (href) => {
    if (href === '/') return pathname === '/' || pathname === '/(app)' || pathname === '/(app)/';
    return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`/(app)${href}`);
  };

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Navegación inferior">
      {navItems.map(({ id, label, emoji, href }) => {
        const active = isActive(href);
        return (
          <Link
            key={id}
            href={href}
            className={`bn-item ${active ? 'is-active' : ''}`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bn-icon" aria-hidden="true">{emoji}</span>
            <span className="bn-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
