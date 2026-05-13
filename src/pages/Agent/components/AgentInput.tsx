import { useState, useCallback } from 'react';
import { Sender } from '@ant-design/x';
import { App } from 'antd';
import { useAgentStore } from '../../../stores/agentStore';
import { ProjectSelector } from './ProjectSelector';

export function AgentInput() {
  const { message } = App.useApp();
  const status = useAgentStore((s) => s.status);
  const cwd = useAgentStore((s) => s.cwd);

  const [value, setValue] = useState('');
  const disabled = !cwd;

  const handleSend = useCallback(async () => {
    const content = value.trim();
    if (!content) return;
    setValue('');
    // TODO: 实现消息发送
    message.info('Agent 核心尚未实现，敬请期待');
  }, [value, message]);

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <Sender
        value={value}
        onChange={setValue}
        onSubmit={handleSend}
        disabled={disabled}
        placeholder={!cwd ? '请先选择项目目录' : '描述你的编程任务...'}
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
