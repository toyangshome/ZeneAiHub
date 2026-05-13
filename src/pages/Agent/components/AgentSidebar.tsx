import { Typography, Button, Space, Tag, theme } from 'antd';
import { ClearOutlined, ApiOutlined, StopOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';

export function AgentSidebar() {
  const { token } = theme.useToken();
  const status = useAgentStore((s) => s.status);
  const model = useAgentStore((s) => s.model);
  const currentCost = useAgentStore((s) => s.currentCost);
  const currentDuration = useAgentStore((s) => s.currentDuration);
  const cwd = useAgentStore((s) => s.cwd);
  const cliVersion = useAgentStore((s) => s.cliVersion);
  const stopSession = useAgentStore((s) => s.stopSession);
  const clearMessages = useAgentStore((s) => s.clearMessages);

  const statusMap: Record<string, { color: string; label: string }> = {
    idle: { color: 'default', label: '空闲' },
    running: { color: 'processing', label: '运行中' },
    waiting_input: { color: 'success', label: '等待输入' },
    error: { color: 'error', label: '错误' },
  };
  const st = statusMap[status] || statusMap.idle;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <Typography.Title level={5} style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ApiOutlined />
        Agent
      </Typography.Title>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InfoItem label="状态">
          <Tag color={st.color === 'processing' ? 'processing' : undefined} style={{ margin: 0 }}>
            {st.label}
          </Tag>
        </InfoItem>

        {cwd && (
          <InfoItem label="项目">
            <Typography.Text ellipsis={{ tooltip: cwd }} style={{ fontSize: 13 }}>
              {cwd.split(/[/\\]/).pop()}
            </Typography.Text>
          </InfoItem>
        )}

        {model && (
          <InfoItem label="模型">
            <Typography.Text style={{ fontSize: 13 }}>{model}</Typography.Text>
          </InfoItem>
        )}

        {cliVersion && (
          <InfoItem label="CLI 版本">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{cliVersion}</Typography.Text>
          </InfoItem>
        )}

        {(currentCost > 0 || currentDuration > 0) && (
          <div style={{
            background: token.colorBgTextHover, borderRadius: 10, padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {currentCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>费用</Typography.Text>
                <Typography.Text style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  ${currentCost.toFixed(4)}
                </Typography.Text>
              </div>
            )}
            {currentDuration > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>耗时</Typography.Text>
                <Typography.Text style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {(currentDuration / 1000).toFixed(1)}s
                </Typography.Text>
              </div>
            )}
          </div>
        )}
      </div>

      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        {status === 'running' && (
          <Button block icon={<StopOutlined />} onClick={stopSession} danger>
            停止会话
          </Button>
        )}
        <Button block icon={<ClearOutlined />} onClick={clearMessages} disabled={status === 'running'}>
          清空消息
        </Button>
      </Space>
    </div>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
        {label}
      </Typography.Text>
      {children}
    </div>
  );
}
