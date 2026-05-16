import { useState, useCallback, useEffect } from 'react';
import { Sender } from '@ant-design/x';
import { App, theme } from 'antd';
import { useAgentStore } from '../../../stores/agentStore';
import { ProjectSelector } from './ProjectSelector';
import { PermissionModeSelector } from './PermissionModeSelector';

export function AgentInput() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const status = useAgentStore((s) => s.status);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const stopSession = useAgentStore((s) => s.stopSession);
  const cliAvailable = useAgentStore((s) => s.cliAvailable);
  const cwd = useAgentStore((s) => s.cwd);
  const pendingMessage = useAgentStore((s) => s.pendingMessage);
  const setPendingMessage = useAgentStore((s) => s.setPendingMessage);

  const [value, setValue] = useState('');

  // 从 Chat 页面跳转时自动填充消息
  useEffect(() => {
    if (pendingMessage) {
      setValue(pendingMessage);
      setPendingMessage(null);
    }
  }, [pendingMessage, setPendingMessage]);
  const isRunning = status === 'running';
  const disabled = !cliAvailable || !cwd;

  const handleSend = useCallback(async () => {
    const content = value.trim();
    if (!content) return;
    setValue('');
    try {
      await sendMessage(content);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '发送失败');
    }
  }, [value, sendMessage, message]);

  const btnDisabled = disabled || !value.trim();

  const sendBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
    border: isRunning ? 'none' : `1px solid transparent`,
    cursor: isRunning ? 'pointer' : (btnDisabled ? 'not-allowed' : 'pointer'),
    opacity: isRunning ? 1 : (btnDisabled ? 0.45 : 1),
    fontFamily: 'inherit', lineHeight: 1.4,
    transition: 'all 0.2s ease',
    background: isRunning
      ? 'linear-gradient(135deg, #fb923c, #f97316)'
      : 'linear-gradient(135deg, #fed7aa, #fdba74)',
    color: isRunning ? '#fff' : '#9a3412',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <Sender
        value={value}
        onChange={setValue}
        onSubmit={handleSend}
        onCancel={stopSession}
        loading={isRunning}
        disabled={disabled}
        placeholder={
          !cliAvailable ? 'Claude CLI 未安装' :
          !cwd ? '请先选择项目目录' :
          '描述你的编程任务...'
        }
        autoSize={{ minRows: 1, maxRows: 6 }}
        actions={() => null}
        allowSpeech={false}
        footer={({ components: { SendButton: Send } }) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ProjectSelector />
              <span style={{ width: 1, height: 16, background: token.colorBorderSecondary, flexShrink: 0 }} />
              <PermissionModeSelector placement="top" />
            </div>
            <button
              className={isRunning ? 'agent-send-btn-running' : undefined}
              style={sendBtnStyle}
              disabled={!isRunning && btnDisabled}
              onClick={isRunning ? stopSession : handleSend}
              onMouseEnter={(e) => {
                if (!btnDisabled) {
                  (e.currentTarget as HTMLElement).style.background = isRunning
                    ? 'linear-gradient(135deg, #ea580c, #dc2626)'
                    : 'linear-gradient(135deg, #fdba74, #fb923c)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isRunning
                  ? 'linear-gradient(135deg, #fb923c, #f97316)'
                  : 'linear-gradient(135deg, #fed7aa, #fdba74)';
              }}
            >
              {isRunning ? '停止' : 'Send'}
              {!isRunning && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {isRunning && (
                <span style={{
                  display: 'inline-block', width: 14, height: 14,
                  border: `2px solid rgba(255,255,255,0.3)`,
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'agent-spin 0.8s linear infinite',
                  flexShrink: 0,
                }} />
              )}
            </button>
          </div>
        )}
      />
    </div>
  );
}
