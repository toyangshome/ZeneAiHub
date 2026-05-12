import { create } from 'zustand';
import type { ThemeConfig } from 'antd';
import { lightTheme, darkTheme } from '../styles/theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  systemDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setSystemDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  systemDark: window.matchMedia('(prefers-color-scheme: dark)').matches, // 同步初始值，后续由 nativeTheme 校正
  setMode: (mode) => {
    set({ mode });
    window.electronAPI?.store.set('theme-mode', mode);
  },
  setSystemDark: (systemDark) => set({ systemDark }),
}));

export function getThemeConfig(mode: ThemeMode, systemDark: boolean): ThemeConfig {
  const isDark = mode === 'dark' || (mode === 'system' && systemDark);
  return isDark ? darkTheme : lightTheme;
}
