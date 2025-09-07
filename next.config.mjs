// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

// 👇 Pasamos la ruta explícita a tu request config
const withNextIntl = createNextIntlPlugin('./src/i18n/request.js');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack estable (sin experimental)
  turbopack: {}
};

export default withNextIntl(nextConfig);
