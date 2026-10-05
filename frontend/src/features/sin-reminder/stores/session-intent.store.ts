import { create } from 'zustand';

interface IntentSessionState {
  pickerOpen: boolean;
  pickerMode: 'sin' | 'good-deed' | null;
  lastViewedSinSlug: string | null;
  lastViewedGoodDeedSlug: string | null;
  varietySeed: string | null;
  open: (mode: 'sin' | 'good-deed') => void;
  close: () => void;
  setSeed: (seed: string) => void;
  setLastViewedSin: (slug: string) => void;
  setLastViewedDeed: (slug: string) => void;
}

export const useIntentSessionStore = create<IntentSessionState>()((set) => ({
  pickerOpen: false,
  pickerMode: null,
  lastViewedSinSlug: null,
  lastViewedGoodDeedSlug: null,
  varietySeed: null,
  open: (mode) => set({ pickerOpen: true, pickerMode: mode }),
  close: () => set({ pickerOpen: false }),
  setSeed: (varietySeed) => set({ varietySeed }),
  setLastViewedSin: (lastViewedSinSlug) => set({ lastViewedSinSlug }),
  setLastViewedDeed: (lastViewedGoodDeedSlug) => set({ lastViewedGoodDeedSlug }),
}));
