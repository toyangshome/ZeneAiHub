import { Typography, Radio, Space } from 'antd';
import { useTheme, type ThemeMode } from '../../hooks/useTheme';

export function GeneralSettings() {
  const { mode, switchTheme } = useTheme();

  return (
    <div>
      <Typography.Title level={5}>通用设置</Typography.Title>
      <Space direction="vertical" size="middle">
        <div>
          <Typography.Text>主题模式</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <Radio.Group
              value={mode}
              onChange={(e) => switchTheme(e.target.value as ThemeMode)}
            >
              <Radio.Button value="light">亮色</Radio.Button>
              <Radio.Button value="dark">暗色</Radio.Button>
              <Radio.Button value="system">跟随系统</Radio.Button>
            </Radio.Group>
          </div>
        </div>
      </Space>
    </div>
  );
}
