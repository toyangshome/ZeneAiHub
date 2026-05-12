import { useMemo } from 'react';
import { Bubble } from '@ant-design/x';
import { type GetProp } from 'antd';
import { useChatStore } from '../../../stores/chatStore';
import { useUIStore } from '../../../stores/uiStore';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageContent } from './MessageContent';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { renderAvatar } from '../../Settings/AvatarSettings';
import type { Message } from '@shared/types';

function AvatarIcon({ avatarKey }: { avatarKey: string }) {
  const { icon, emoji, bg, color } = renderAvatar(avatarKey);

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        color,
        fontSize: emoji ? 18 : 14,
      }}
    >
      {emoji || icon}
    </div>
  );
}

export function MessageList() {
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const userAvatar = useUIStore((s) => s.userAvatar);
  const assistantAvatar = useUIStore((s) => s.assistantAvatar);
  const { containerRef, scrollToBottom } = useAutoScroll([messages.length, streaming]);

  const items: GetProp<typeof Bubble.List, 'items'> = useMemo(
    () =>
      messages.map((msg: Message) => {
        const isUser = msg.role === 'user';
        return {
          key: msg.id,
          placement: isUser ? 'end' : 'start' as const,
          avatar: {
            icon: <AvatarIcon avatarKey={isUser ? userAvatar : assistantAvatar} />,
            style: { background: 'transparent' },
          },
          content: isUser ? <MessageContent content={msg.content} /> : <MarkdownRenderer content={msg.content} />,
          messageRender: isUser ? undefined : (content: React.ReactNode) => content,
          loading: !isUser && msg.content === '' && streaming,
          styles: {
            content: {
              maxWidth: '75%',
            },
          },
        };
      }),
    [messages, streaming, userAvatar, assistantAvatar],
  );

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 24px',
      }}
    >
      {messages.length === 0 ? (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ant-color-text-tertiary)',
            fontSize: 16,
          }}
        >
          输入消息开始对话
        </div>
      ) : (
        <Bubble.List items={items} />
      )}
    </div>
  );
}
