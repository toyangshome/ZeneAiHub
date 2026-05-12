import { theme, type ThemeConfig } from 'antd';

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    colorBorder: 'rgba(5, 5, 5, 0.06)',
    colorBorderSecondary: 'rgba(5, 5, 5, 0.04)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.02)',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
  },
  algorithm: theme.defaultAlgorithm,
  components: {
    Layout: {
      siderBg: '#f9f9f9',
      headerBg: '#ffffff',
    },
    Button: {
      borderRadius: 10,
      primaryShadow: '0 2px 8px rgba(22, 119, 255, 0.15)',
    },
    Input: {
      borderRadius: 10,
    },
    Dropdown: {
      borderRadiusLG: 16,
      borderRadiusSM: 10,
    },
    Card: {
      borderRadiusLG: 16,
    },
  },
};

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#3b82f6',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontSize: 14,
    colorBorder: 'rgba(255, 255, 255, 0.06)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.04)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    boxShadowSecondary: '0 6px 24px rgba(0, 0, 0, 0.4)',
  },
  components: {
    Layout: {
      siderBg: '#171717',
      headerBg: '#1f1f1f',
    },
    Menu: {
      darkItemBg: '#171717',
      darkSubMenuItemBg: '#0d0d0d',
    },
    Button: {
      borderRadius: 10,
      primaryShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
    },
    Input: {
      borderRadius: 10,
    },
    Dropdown: {
      borderRadiusLG: 16,
      borderRadiusSM: 10,
    },
    Card: {
      borderRadiusLG: 16,
    },
  },
  algorithm: theme.darkAlgorithm,
};
