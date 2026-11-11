import { usePathname } from '@/i18n/navigation';

/** Sign-in and sign-up links that come back to the current practice page (`?next=` is read by the auth forms). */
export function useSignInHrefs() {
  const pathname = usePathname();
  return {
    login: { pathname: '/login', query: { next: pathname } },
    register: { pathname: '/register', query: { next: pathname } },
  } as const;
}
