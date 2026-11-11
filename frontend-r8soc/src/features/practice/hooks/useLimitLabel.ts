import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { resolveLimit, type LimitRef } from '@thekra/practice-core';

/** A limit's text in the page's language: the program's own step, or the generic limit's translation. */
export function useLimitLabel(actions: readonly string[]): (ref: LimitRef) => string | null {
  const t = useTranslations('leaveSin.limits');
  return useCallback(
    (ref: LimitRef) => {
      const resolved = resolveLimit(ref, actions);
      if (!resolved) return null;
      return resolved.kind === 'action' ? resolved.text : t(resolved.key);
    },
    [actions, t],
  );
}
