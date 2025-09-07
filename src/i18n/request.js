// src/i18n/request.js
import 'server-only';
import {getRequestConfig} from 'next-intl/server';
import {cookies} from 'next/headers';

export default getRequestConfig(async () => {
  const supported = ['es', 'en', 'de'];

  // 👇 Next 15: cookies() es async
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  const locale = supported.includes(cookieLocale) ? cookieLocale : 'es';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
