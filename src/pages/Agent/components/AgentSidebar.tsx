import { useEffect } from 'react';
import { Typography, Button, theme, Popconfirm } from 'antd';
import {
  ApiOutlined, ClearOutlined, StopOutlined,
  FolderOutlined, RobotOutlined, HistoryOutlined,
  DeleteOutlined, MessageOutlined, ExportOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';

const STATUS_STYLE: Record<string, { bg: string; dot: string; label: string }> = {
  idle:           { bg: 'rgba(0,0,0,0.04)',  dot: '#999',  label: '空闲' },
  running:        { bg: 'rgba(24,144,255,0.06)', dot: '#1890ff', label: '运行中' },
  waiting_input:  { bg: 'rgba(82,196,26,0.06)',  dot: '#52c41a', label: '等待输入' },
  error:          { bg: 'rgba(255,77,79,0.06)',  dot: '#ff4d4f', label: '错误' },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 172800000) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function AgentSidebar() {
  const { token } = theme.useToken();
  const status = useAgentStore((s) => s.status);
  const model = useAgentStore((s) => s.model);
  const cwd = useAgentStore((s) => s.cwd);
  const sessionId = useAgentStore((s) => s.sessionId);
  const stopSession = useAgentStore((s) => s.stopSession);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const loadSession = useAgentStore((s) => s.loadSession);
  const deleteSessionHistory = useAgentStore((s) => s.deleteSessionHistory);
  const exportSession = useAgentStore((s) => s.exportSession);
  const listSessions = useAgentStore((s) => s.listSessions);
  const sessionSummaries = useAgentStore((s) => s.sessionSummaries);

  const st = STATUS_STYLE[status] || STATUS_STYLE.idle;
  const projectName = cwd ? cwd.split(/[/\\]/).pop() : '';

  // cwd 变化时加载历史
  useEffect(() => {
    if (cwd) listSessions();
  }, [cwd, listSessions]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 14px' }}>
      {/* 标题 + 状态 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16, padding: '10px 12px', borderRadius: 12,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
        {projectName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px', borderRadius: 8, fontSize: 13,
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
            padding: '6px 10px', borderRadius: 8, fontSize: 13,
          }}>
            <RobotOutlined style={{ fontSize: 14, color: token.colorTextQuaternary, flexShrink: 0 }} />
            <Typography.Text ellipsis={{ tooltip: model }} style={{ fontSize: 13, margin: 0 }}>
              {model}
            </Typography.Text>
          </div>
        )}
      </div>

      {/* 历史会话 */}
      {sessionSummaries.length > 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', marginBottom: 4,
            fontSize: 11, fontWeight: 600, color: token.colorTextQuaternary,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <HistoryOutlined style={{ fontSize: 11 }} />
            历史会话
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sessionSummaries.map((s) => {
              const isActive = s.id === sessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => !isActive && loadSession(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 8, fontSize: 13,
                    cursor: isActive ? 'default' : 'pointer',
                    background: isActive ? token.colorPrimaryBg : 'transparent',
                    border: isActive ? `1px solid ${token.colorPrimaryBorder}` : '1px solid transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = token.colorBgTextHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <MessageOutlined style={{
                    fontSize: 12, color: isActive ? token.colorPrimary : token.colorTextQuaternary,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text ellipsis style={{
                      fontSize: 12, display: 'block',
                      color: isActive ? token.colorPrimary : token.colorText,
                      fontWeight: isActive ? 500 : 400,
                    }}>
                      {s.title || '未命名会话'}
                    </Typography.Text>
                    <div style={{
                      fontSize: 10, color: token.colorTextQuaternary,
                      display: 'flex', gap: 6, marginTop: 1,
                    }}>
                      <span>{formatTime(s.updatedAt)}</span>
                      <span>{s.messageCount} 条消息</span>
                    </div>
                  </div>
                  <ExportOutlined
                    onClick={(e) => { e.stopPropagation(); exportSession(s.id); }}
                    style={{
                      fontSize: 11, color: token.colorTextQuaternary,
                      opacity: 0.5, flexShrink: 0, padding: 4,
                      borderRadius: 4, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = '0.5'}
                  />
                  <Popconfirm
                    title="删除此会话？"
                    description="将删除所有消息记录"
                    onConfirm={(e) => { e?.stopPropagation?.(); deleteSessionHistory(s.id); }}
                    onCancel={(e) => e?.stopPropagation?.()}
                  >
                    <DeleteOutlined
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 11, color: token.colorTextQuaternary,
                        opacity: 0.5, flexShrink: 0, padding: 4,
                        borderRadius: 4, transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.opacity = '0.5'}
                    />
                  </Popconfirm>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto', paddingTop: 8 }}>
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
          新建会话
        </Button>
      </div>
    </div>
  );
}
