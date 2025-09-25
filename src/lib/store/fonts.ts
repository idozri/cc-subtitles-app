import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FontsState {
  recent: string[]; // font family names (max 5)
  addRecent: (family: string) => void;
  clearRecent: () => void;
}

export const useFontsStore = create<FontsState>()(
  persist(
    (set, get) => ({
      recent: [],
      addRecent: (family: string) => {
        const current = get().recent;
        const next = [
          family,
          ...current.filter((f) => f.toLowerCase() !== family.toLowerCase()),
        ].slice(0, 5);
        set({ recent: next });
      },
      clearRecent: () => set({ recent: [] }),
    }),
    { name: 'recent-fonts' }
  )
);
