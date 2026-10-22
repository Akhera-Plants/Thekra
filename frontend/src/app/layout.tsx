import type { ReactNode } from 'react';
import './globals.css';

/**
 * Root layout stays minimal so `[locale]/layout.tsx` can own `<html lang dir>`.
 * See frontend-plan.md §5.2–§5.3.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
