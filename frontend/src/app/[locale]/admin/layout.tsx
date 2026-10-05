/**
 * Admin layout — noindex, admin shell with sidebar navigation.
 * Client-side guard checks ADMIN role; server handles noindex.
 */
import type { Metadata } from 'next';
import { AdminGuard } from '@/features/curation/components/AdminGuard';
import { AdminSideNav } from '@/features/curation/components/AdminSideNav';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminGuard>
      <div className="flex flex-1">
        <AdminSideNav />
        <main className="flex flex-1 flex-col gap-0 overflow-x-auto p-6">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
