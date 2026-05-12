import { useEffect } from 'react';
import { useThemeStore, getThemeConfig, type ThemeMode } from '../stores/themeStore';

export type { ThemeMode };

export function useTheme() {
  const mode = useThemeStore((s) => s.mode);
  const systemDark = useThemeStore((s) => s.systemDark);
  const setMode = useThemeStore((s) => s.setMode);
  const setSystemDark = useThemeStore((s) => s.setSystemDark);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);
  const themeConfig = getThemeConfig(mode, systemDark);

  // 在 document 上设置 data-theme 属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return { mode, isDark, themeConfig, switchTheme: setMode };
}

/** 初始化主题：从存储加载 + 监听系统主题 */
let _themeInitialized = false;
export function initTheme() {
  if (_themeInitialized) return;
  _themeInitialized = true;

  // 从 electron-store 加载保存的主题
  window.electronAPI?.store.get<ThemeMode>('theme-mode', 'dark').then((saved) => {
    if (saved) useThemeStore.getState().setMode(saved);
  }).catch((err) => {
    console.error('加载主题配置失败:', err);
  });

  // 使用 Electron nativeTheme 获取系统主题（比 matchMedia 更可靠）
  if (window.electronAPI?.theme) {
    window.electronAPI.theme.getShouldUseDark().then((dark: boolean) => {
      useThemeStore.getState().setSystemDark(dark);
    }).catch(() => {
      // fallback: 使用 matchMedia
      useThemeStore.getState().setSystemDark(
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    });

    // 监听系统主题变化（由主进程 nativeTheme 推送）
    window.electronAPI.theme.onSystemUpdated((dark: boolean) => {
      useThemeStore.getState().setSystemDark(dark);
    });
  } else {
    // 非 Electron 环境 fallback
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      useThemeStore.getState().setSystemDark(e.matches);
    };
    mq.addEventListener('change', handler);
  }
}
