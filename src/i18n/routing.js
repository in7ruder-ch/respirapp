import {createRouting} from 'next-intl/routing';

export const routing = createRouting({
  locales: ['es', 'en', 'de'],
  defaultLocale: 'es',
  localePrefix: 'as-needed' // sin prefijo cuando es el default
});

// (helpers opcionales para próximos pasos)
export const {Link, redirect, usePathname, useRouter} = routing;
