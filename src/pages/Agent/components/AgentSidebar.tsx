import { Typography, Tag, theme } from 'antd';
import { ApiOutlined, ClearOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';

export function AgentSidebar() {
  const { token } = theme.useToken();
  const status = useAgentStore((s) => s.status);
  const cwd = useAgentStore((s) => s.cwd);
  const clearMessages = useAgentStore((s) => s.clearMessages);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <Typography.Title level={5} style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <ApiOutlined />
        Agent
      </Typography.Title>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
            状态
          </Typography.Text>
          <Tag color={status === 'running' ? 'processing' : undefined} style={{ margin: 0 }}>
            {status === 'idle' ? '空闲' : status === 'running' ? '运行中' : status === 'error' ? '错误' : status}
          </Tag>
        </div>

        {cwd && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>
              项目
            </Typography.Text>
            <Typography.Text ellipsis={{ tooltip: cwd }} style={{ fontSize: 13 }}>
              {cwd.split(/[/\\]/).pop()}
            </Typography.Text>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={clearMessages}
          disabled={status === 'running'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 0', border: `1px solid ${token.colorBorder}`, borderRadius: 8,
            background: token.colorBgContainer, cursor: status === 'running' ? 'not-allowed' : 'pointer',
            fontSize: 13, color: token.colorText, fontFamily: 'inherit', opacity: status === 'running' ? 0.5 : 1,
          }}
        >
          <ClearOutlined />
          清空消息
        </button>
      </div>
    </div>
  );
}
