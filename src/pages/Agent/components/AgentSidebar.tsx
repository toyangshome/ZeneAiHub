import { Typography, Button, theme } from 'antd';
import {
  ApiOutlined, ClearOutlined, StopOutlined,
  FolderOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';

const STATUS_STYLE: Record<string, { bg: string; dot: string; label: string }> = {
  idle:           { bg: 'rgba(0,0,0,0.04)',  dot: '#999',  label: '空闲' },
  running:        { bg: 'rgba(24,144,255,0.06)', dot: '#1890ff', label: '运行中' },
  waiting_input:  { bg: 'rgba(82,196,26,0.06)',  dot: '#52c41a', label: '等待输入' },
  error:          { bg: 'rgba(255,77,79,0.06)',  dot: '#ff4d4f', label: '错误' },
};

export function AgentSidebar() {
  const { token } = theme.useToken();
  const status = useAgentStore((s) => s.status);
  const model = useAgentStore((s) => s.model);
  const cwd = useAgentStore((s) => s.cwd);
  const stopSession = useAgentStore((s) => s.stopSession);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const st = STATUS_STYLE[status] || STATUS_STYLE.idle;
  const projectName = cwd ? cwd.split(/[/\\]/).pop() : '';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 14px' }}>
      {/* 标题 + 状态 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 20, padding: '10px 12px', borderRadius: 12,
        background: st.bg,
      }}>
        <ApiOutlined style={{ fontSize: 18, color: st.dot }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>Agent</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: st.dot,
              boxShadow: status === 'running' ? `0 0 6px ${st.dot}` : 'none',
              animation: status === 'running' ? 'agent-dot-pulse 1.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{st.label}</span>
          </div>
        </div>
      </div>

      {/* 关键信息 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {projectName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8, fontSize: 13,
          }}>
            <FolderOutlined style={{ fontSize: 14, color: token.colorTextQuaternary, flexShrink: 0 }} />
            <Typography.Text ellipsis={{ tooltip: cwd }} style={{ fontSize: 13, margin: 0 }}>
              {projectName}
            </Typography.Text>
          </div>
        )}
        {model && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 8, fontSize: 13,
          }}>
            <RobotOutlined style={{ fontSize: 14, color: token.colorTextQuaternary, flexShrink: 0 }} />
            <Typography.Text ellipsis={{ tooltip: model }} style={{ fontSize: 13, margin: 0 }}>
              {model}
            </Typography.Text>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {status === 'running' && (
          <Button
            block icon={<StopOutlined />} onClick={stopSession}
            danger size="middle"
            style={{ borderRadius: 10, fontWeight: 500 }}
          >
            停止会话
          </Button>
        )}
        <Button
          block icon={<ClearOutlined />} onClick={clearMessages}
          disabled={status === 'running'} size="middle"
          style={{ borderRadius: 10, fontWeight: 500 }}
        >
          清空消息
        </Button>
      </div>
    </div>
  );
}
