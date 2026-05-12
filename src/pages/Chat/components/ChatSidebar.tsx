import { useEffect } from 'react';
import { Conversations } from '@ant-design/x';
import { PlusOutlined, DeleteOutlined, PushpinOutlined } from '@ant-design/icons';
import { Button, type GetProp } from 'antd';
import { useChatStore } from '../../../stores/chatStore';
import { useModelStore } from '../../../stores/modelStore';

/** 根据时间戳返回分组标签 */
function getTimeGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  // 今天
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= todayStart) return '今天';

  // 昨天
  const yesterdayStart = todayStart - 86400000;
  if (timestamp >= yesterdayStart) return '昨天';

  // 过去 7 天
  const weekStart = todayStart - 7 * 86400000;
  if (timestamp >= weekStart) return '过去 7 天';

  // 过去 30 天
  const monthStart = todayStart - 30 * 86400000;
  if (timestamp >= monthStart) return '过去 30 天';

  return '更早';
}

/** 分组排序权重 */
const groupOrder: Record<string, number> = {
  '今天': 0,
  '昨天': 1,
  '过去 7 天': 2,
  '过去 30 天': 3,
  '更早': 4,
};

export function ChatSidebar() {
  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const currentModelId = useModelStore((s) => s.currentModelId);

  useEffect(() => {
    loadConversations();
  }, []);

  const items: GetProp<typeof Conversations, 'items'> = conversations.map((conv) => ({
    key: conv.id,
    label: conv.title,
    icon: conv.pinned ? <PushpinOutlined /> : undefined,
    timestamp: conv.updatedAt,
    group: getTimeGroup(conv.updatedAt),
  }));

  const menuConfig: GetProp<typeof Conversations, 'menu'> = (conversation) => ({
    items: [
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
      },
    ],
    onClick: (info) => {
      if (info.key === 'delete') {
        deleteConversation(conversation.key as string);
      }
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={() => createConversation(currentModelId || '')}
          style={{ height: 40, fontWeight: 500, transition: 'all 0.2s ease' }}
        >
          新建对话
        </Button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Conversations
          items={items}
          activeKey={currentConversationId}
          onActiveChange={(key) => selectConversation(key)}
          menu={menuConfig}
          groupable={{
            sort: (a, b) => (groupOrder[a] ?? 99) - (groupOrder[b] ?? 99),
          }}
        />
      </div>
    </div>
  );
}
