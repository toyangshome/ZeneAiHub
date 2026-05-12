import { Layout, Menu, Button } from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  BookOutlined,
  ThunderboltOutlined,
  MenuOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { TitleBar } from './TitleBar';
import { StatusBar } from './StatusBar';
import { useUIStore } from '../../stores/uiStore';

const { Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { key: '/chat', icon: <MessageOutlined />, label: '对话' },
  { key: '/prompts', icon: <BookOutlined />, label: 'Prompt 模板' },
  { key: '/skills', icon: <ThunderboltOutlined />, label: 'Skill' },
  { key: '/mcp', icon: <ApiOutlined />, label: 'MCP' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const siderCollapsed = useUIStore((s) => s.siderCollapsed);
  const toggleSider = useUIStore((s) => s.toggleSider);

  return (
    <Layout style={{ height: '100vh', width: '100vw' }}>
      <TitleBar />
      <Layout hasSider style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width: siderCollapsed ? 0 : 200,
            minWidth: siderCollapsed ? 0 : 200,
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            borderRight: '1px solid var(--ant-color-border)',
            marginRight: 4,
          }}
        >
          <Sider
            width={200}
            theme="light"
            style={{
              height: '100%',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '8px 8px 0 8px',
                height: 40,
              }}
            >
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleSider}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </div>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 0, background: 'transparent' }}
            />
          </Sider>
        </div>
        <Content style={{ overflow: 'auto', flex: 1, minWidth: 0 }}>
          {children}
        </Content>
      </Layout>
      <StatusBar />
    </Layout>
  );
}
