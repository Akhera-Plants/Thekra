'use client';

import { usePracticeStore } from '../hooks/usePracticeStore';
import { useVaultAutosave } from '../hooks/useVaultAutosave';

/** Saves every «تخفَّف» change to the account, encrypted, wherever it was made (mounted once per page). Renders nothing. */
export function VaultAutosave() {
  const snapshot = usePracticeStore();
  return snapshot ? <Saver programs={snapshot.store.programs} /> : null;
}

function Saver({ programs }: { programs: Parameters<typeof useVaultAutosave>[0] }) {
  useVaultAutosave(programs);
  return null;
}
