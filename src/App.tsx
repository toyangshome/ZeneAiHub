import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useTheme, initTheme } from './hooks/useTheme';
import { useUIStore } from './stores/uiStore';
import { useModelStore } from './stores/modelStore';
import { useChatStore } from './stores/chatStore';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import ChatPage from './pages/Chat';
import SettingsPage from './pages/Settings';
import PromptsPage from './pages/Prompts';
import SkillsPage from './pages/Skills';
import MCPPage from './pages/MCP';

export default function App() {
  const { themeConfig } = useTheme();

  useEffect(() => {
    initTheme();
    useUIStore.getState().loadAvatars();
    useModelStore.getState().loadModels();
    useChatStore.getState().loadStrictPromptMode();
    useChatStore.getState().loadActivePromptMap();
  }, []);

  return (
    <ErrorBoundary>
      <ConfigProvider locale={zhCN} theme={themeConfig} wave={{ showEffect: () => {} }}>
        <AntdApp>
          <BrowserRouter>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/prompts" element={<PromptsPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/mcp" element={<MCPPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppLayout>
          </BrowserRouter>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
