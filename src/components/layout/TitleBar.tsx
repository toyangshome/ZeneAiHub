import { useState, useEffect } from 'react';
import { Button, Space } from 'antd';
import {
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  FullscreenExitOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../../stores/uiStore';

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const siderCollapsed = useUIStore((s) => s.siderCollapsed);
  const toggleSider = useUIStore((s) => s.toggleSider);

  useEffect(() => {
    window.electronAPI?.window.isMaximized().then(setIsMaximized).catch(() => {});
  }, []);

  const handleMinimize = () => window.electronAPI?.window.minimize();
  const handleMaximize = () => {
    window.electronAPI?.window.maximize();
    setIsMaximized((v) => !v);
  };
  const handleClose = () => window.electronAPI?.window.close();

  return (
    <div
      className="titlebar-drag"
      style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 4,
        background: 'transparent',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {siderCollapsed && (
          <Button
            type="text"
            size="small"
            icon={<MenuUnfoldOutlined />}
            onClick={toggleSider}
            className="titlebar-no-drag"
            style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, paddingLeft: 8 }}>
          ZeneAIHub
        </span>
      </div>
      <Space className="titlebar-no-drag" size={0}>
        <Button
          type="text"
          size="small"
          icon={<MinusOutlined />}
          onClick={handleMinimize}
          style={{ width: 46, height: 32, borderRadius: 0 }}
        />
        <Button
          type="text"
          size="small"
          icon={isMaximized ? <FullscreenExitOutlined /> : <BorderOutlined />}
          onClick={handleMaximize}
          style={{ width: 46, height: 32, borderRadius: 0 }}
        />
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleClose}
          style={{ width: 46, height: 32, borderRadius: 0 }}
          danger
        />
      </Space>
    </div>
  );
}
