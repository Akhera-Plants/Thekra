/**
 * Admin layout — the review desk («مكتب التحقيق»): its own product shell, no public chrome.
 * [locale]/layout's SiteChrome skips the site header/footer for the `admin` segment.
 * Client-side guard checks ADMIN/REVIEWER role; the backend enforces it; server sets noindex.
 */
import type { Metadata } from 'next';
import { AdminGuard } from '@/features/curation/components/AdminGuard';
import { AdminShell } from '@/features/curation/components/shell/AdminShell';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}
