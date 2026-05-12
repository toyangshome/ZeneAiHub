import { Tag, Space } from 'antd';

interface StatusBarProps {
  modelName?: string;
  tokenCount?: number;
}

export function StatusBar({ modelName, tokenCount }: StatusBarProps) {
  return (
    <div
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        fontSize: 12,
        opacity: 0.65,
        borderTop: '1px solid var(--ant-color-border)',
      }}
    >
      <Space size="middle">
        {modelName && <Tag color="blue">{modelName}</Tag>}
        {tokenCount !== undefined && <span>{tokenCount.toLocaleString()} tokens</span>}
      </Space>
      <span>v0.1.0</span>
    </div>
  );
}
