'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useTranslations} from 'next-intl';
import '@/styles/BottomNav.css';

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const items = [
    { href: '/', key: 'home', icon: '🏠' },
    { href: '/library', key: 'library', icon: '🎧' },
    { href: '/explore', key: 'explore', icon: '🧭' },
    { href: '/profile', key: 'profile', icon: '👤' },
  ];

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      {items.map(({ href, key, icon }) => {
        const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
        const label = t(key);

        return (
          <Link
            key={href}
            href={href}
            className={`bn-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            title={label}
            prefetch={false}
          >
            <span className="bn-icon" aria-hidden="true">{icon}</span>
            <span className="bn-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
