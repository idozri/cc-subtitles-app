import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SubtitlePosition = 'top' | 'middle' | 'bottom';
export type SubtitleBackground = 'none' | 'black' | 'white';
export type SubtitleOutline = 'none' | 'thin' | 'medium' | 'thick' | string;

export interface VideoSettingsState {
  color1: string;
  color2: string;
  fontFamily?: string;
  subtitleScale: number;
  subtitlePosition: SubtitlePosition;
  subtitleBackground: SubtitleBackground;
  subtitleOutline: SubtitleOutline;
  setColor1: (value: string) => void;
  setColor2: (value: string) => void;
  setFontFamily: (value?: string) => void;
  setSubtitleScale: (value: number) => void;
  setSubtitlePosition: (value: SubtitlePosition) => void;
  setSubtitleBackground: (value: SubtitleBackground) => void;
  setSubtitleOutline: (value: SubtitleOutline) => void;
  resetDefaults: () => void;
}

const defaultState: Omit<
  VideoSettingsState,
  | 'setColor1'
  | 'setColor2'
  | 'setFontFamily'
  | 'setSubtitleScale'
  | 'setSubtitlePosition'
  | 'setSubtitleBackground'
  | 'setSubtitleOutline'
  | 'resetDefaults'
> = {
  color1: '#FFFFFF',
  color2: '#FFFFFF',
  fontFamily: 'Roboto',
  subtitleScale: 1,
  subtitlePosition: 'bottom',
  subtitleBackground: 'none',
  subtitleOutline:
    '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 1px 2px 0 #000, -1px -2px 0 #000, 2px 1px 0 #000, -2px -1px 0 #000',
};

export const useVideoSettingsStore = create<VideoSettingsState>()(
  persist(
    (set) => ({
      ...defaultState,
      setColor1: (value) => set({ color1: value }),
      setColor2: (value) => set({ color2: value }),
      setFontFamily: (value) => set({ fontFamily: value }),
      setSubtitleScale: (value) => set({ subtitleScale: value }),
      setSubtitlePosition: (value) => set({ subtitlePosition: value }),
      setSubtitleBackground: (value) => set({ subtitleBackground: value }),
      setSubtitleOutline: (value) => set({ subtitleOutline: value }),
      resetDefaults: () => set({ ...defaultState }),
    }),
    {
      name: 'video-settings',
      partialize: (state) => ({
        color1: state.color1,
        color2: state.color2,
        fontFamily: state.fontFamily,
        subtitleScale: state.subtitleScale,
        subtitlePosition: state.subtitlePosition,
        subtitleBackground: state.subtitleBackground,
        subtitleOutline: state.subtitleOutline,
      }),
    }
  )
);
