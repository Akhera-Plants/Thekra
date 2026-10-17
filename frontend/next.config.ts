import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Playwright and local tooling hit 127.0.0.1; without this, Next 16 blocks
  // /_next/* (and HMR) as cross-origin from that host vs localhost.
  allowedDevOrigins: ['127.0.0.1'],
};

export default withNextIntl(nextConfig);
