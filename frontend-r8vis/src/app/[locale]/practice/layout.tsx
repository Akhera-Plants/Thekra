import { MembersOnly } from '@/features/auth/components/MembersOnly';
import { VaultAutosave } from '@/features/practice/components/VaultAutosave';

/**
 * Every practice page («ورد اليوم», «عاداتي», periodic acts, «تخفَّف»…) asks a guest to sign in first. «تخفَّف» changes
 * made on any of them (a check-in, «لحظة مجاهدة», «صلّحها») are sealed and saved to the account by one autosave.
 */
export default function PracticeLayout({ children }: LayoutProps<'/[locale]/practice'>) {
  return (
    <MembersOnly>
      <VaultAutosave />
      {children}
    </MembersOnly>
  );
}
