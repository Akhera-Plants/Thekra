import { MembersOnly } from '@/features/auth/components/MembersOnly';

/** Every practice page («ورد اليوم», «السجل», habits, periodic acts, «تخفَّف»…) asks a guest to sign in first. */
export default function PracticeLayout({ children }: LayoutProps<'/[locale]/practice'>) {
  return <MembersOnly>{children}</MembersOnly>;
}
