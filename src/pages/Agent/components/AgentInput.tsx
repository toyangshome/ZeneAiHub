import { useState, useCallback } from 'react';
import { Sender } from '@ant-design/x';
import { App } from 'antd';
import { useAgentStore } from '../../../stores/agentStore';
import { ProjectSelector } from './ProjectSelector';

export function AgentInput() {
  const { message } = App.useApp();
  const status = useAgentStore((s) => s.status);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const stopSession = useAgentStore((s) => s.stopSession);
  const cliAvailable = useAgentStore((s) => s.cliAvailable);
  const cwd = useAgentStore((s) => s.cwd);

  const [value, setValue] = useState('');
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
            </div>
            <Send disabled={disabled || !value.trim()} />
          </div>
        )}
      />
    </div>
  );
}
