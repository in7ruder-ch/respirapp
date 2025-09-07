// middleware.js (root)
import {NextResponse} from 'next/server';
import {createMiddlewareClient} from '@supabase/auth-helpers-nextjs';
import createIntlMiddleware from 'next-intl/middleware';

const intl = createIntlMiddleware({
  locales: ['es', 'en', 'de'],
  defaultLocale: 'es',
  localePrefix: 'as-needed'
});

export async function middleware(req) {
  // 1) i18n primero (puede hacer rewrite/redirect)
  let res = intl(req) ?? NextResponse.next();

  // 2) Inyectar sesión de Supabase sobre la misma Response
  const supabase = createMiddlewareClient({req, res});
  await supabase.auth.getSession();

  return res;
}

export const config = {
  // Matcher recomendado por next-intl (evita api, _next y archivos estáticos)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icons|.*\\..*).*)']
};
