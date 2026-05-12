import { Layout } from 'antd';
import { ChatSidebar } from './components/ChatSidebar';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { ModelSelector } from './components/ModelSelector';
import { PromptSelector } from './components/PromptSelector';
import { SkillSelector } from './components/SkillSelector';

export default function ChatPage() {
  return (
    <Layout style={{ height: '100%', width: '100%' }}>
      <Layout.Sider
        width={260}
        theme="light"
        style={{
          borderRight: '1px solid var(--ant-color-border)',
          overflow: 'hidden',
        }}
      >
        <ChatSidebar />
      </Layout.Sider>
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {/* Prompt + Skill 选择器 - 浮动在左上角 */}
        <div style={{ position: 'absolute', top: 0, left: 24, zIndex: 50, height: 41, display: 'flex', alignItems: 'center', gap: 2 }}>
          <PromptSelector />
          <SkillSelector />
        </div>
        {/* 模型选择器 - 浮动在右上角 */}
        <div style={{ position: 'absolute', top: 0, right: 24, zIndex: 50, height: 41, display: 'flex', alignItems: 'center' }}>
          <ModelSelector />
        </div>
        <Layout.Content
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
          }}
        >
          <div style={{ height: 41, borderBottom: '1px solid var(--ant-color-border)', flexShrink: 0 }} />
          <MessageList />
          <ChatInput />
        </Layout.Content>
      </div>
    </Layout>
  );
}
