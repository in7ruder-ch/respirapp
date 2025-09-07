// components/LanguageSwitcher.jsx
'use client';

import {useLocale} from 'next-intl';
import {usePathname, useRouter} from 'next/navigation';

const SUPPORTED = ['es', 'en', 'de'];
const DEFAULT_LOCALE = 'es';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  // Quita prefijo de locale si lo hubiera (por si quedó en el history)
  const segments = pathname.split('/');
  const hasLocalePrefix = SUPPORTED.includes(segments[1]);
  const basePath = hasLocalePrefix ? `/${segments.slice(2).join('/')}` || '/' : pathname || '/';

  function setLocale(loc) {
    // 1) fija cookie que next-intl lee en el server
    document.cookie = `NEXT_LOCALE=${loc}; path=/; max-age=31536000`;
    // 2) navega al mismo endpoint SIN prefijo
    router.push(loc === DEFAULT_LOCALE ? basePath : basePath); // siempre mismo path
    router.refresh(); // fuerza recarga de server components con el nuevo locale
  }

  return (
    <div style={{display: 'flex', gap: 8, justifyContent: 'center', margin: '12px 0'}}>
      {SUPPORTED.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          aria-current={loc === locale ? 'page' : undefined}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: loc === locale ? '2px solid #2563eb' : '1px solid #888',
            fontWeight: loc === locale ? 700 : 400,
            textDecoration: 'none',
            background: 'transparent',
            cursor: 'pointer'
          }}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
