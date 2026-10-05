import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  showTranslation: boolean;
  includeWeakHadith: boolean;
  arabicNumerals: boolean;
  fontScale: number; // 1 = default, 1.2 = large, 1.5 = xl
  setShowTranslation: (v: boolean) => void;
  setIncludeWeakHadith: (v: boolean) => void;
  setArabicNumerals: (v: boolean) => void;
  setFontScale: (v: number) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      showTranslation: true,
      includeWeakHadith: false,
      arabicNumerals: true,
      fontScale: 1,
      setShowTranslation: (showTranslation) => set({ showTranslation }),
      setIncludeWeakHadith: (includeWeakHadith) => set({ includeWeakHadith }),
      setArabicNumerals: (arabicNumerals) => set({ arabicNumerals }),
      setFontScale: (fontScale) => set({ fontScale }),
    }),
    { name: 'thekra-preferences' },
  ),
);
