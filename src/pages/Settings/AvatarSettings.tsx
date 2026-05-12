import { Typography, Popover } from 'antd';
import {
  UserOutlined, RobotOutlined, SmileOutlined, ThunderboltOutlined,
  StarOutlined, CrownOutlined, BugOutlined, HeartOutlined,
  FireOutlined, RocketOutlined,
} from '@ant-design/icons';
import { useUIStore } from '../../stores/uiStore';

const iconAvatars = [
  { key: 'user', icon: UserOutlined },
  { key: 'robot', icon: RobotOutlined },
  { key: 'smile', icon: SmileOutlined },
  { key: 'thunder', icon: ThunderboltOutlined },
  { key: 'star', icon: StarOutlined },
  { key: 'crown', icon: CrownOutlined },
  { key: 'bug', icon: BugOutlined },
  { key: 'heart', icon: HeartOutlined },
  { key: 'fire', icon: FireOutlined },
  { key: 'rocket', icon: RocketOutlined },
];

const emojiAvatars = [
  { key: 'emoji-😊', label: '😊' },
  { key: 'emoji-🤖', label: '🤖' },
  { key: 'emoji-🧑‍💻', label: '🧑‍💻' },
  { key: 'emoji-😎', label: '😎' },
  { key: 'emoji-🐱', label: '🐱' },
  { key: 'emoji-🦊', label: '🦊' },
  { key: 'emoji-🐼', label: '🐼' },
  { key: 'emoji-🚀', label: '🚀' },
  { key: 'emoji-⚡', label: '⚡' },
  { key: 'emoji-🌟', label: '🌟' },
  { key: 'emoji-🔮', label: '🔮' },
  { key: 'emoji-🦄', label: '🦄' },
];

const colorMap: Record<string, string> = {
  user: '#1677ff', robot: '#52c41a', smile: '#faad14', thunder: '#722ed1',
  star: '#eb2f96', crown: '#fa8c16', bug: '#f5222d', heart: '#eb2f96',
  fire: '#fa541c', rocket: '#13c2c2',
};

function getColors(key: string) {
  return { bg: colorMap[key] || '#8c8c8c', color: '#fff' };
}

function AvatarPreview({ avatarKey, size = 36 }: { avatarKey: string; size?: number }) {
  const { icon, emoji, bg, color } = renderAvatar(avatarKey);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color, fontSize: emoji ? size * 0.55 : size * 0.45,
    }}>
      {emoji || icon}
    </div>
  );
}

function PickerGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: 240 }}>
      {iconAvatars.map((a) => {
        const Icon = a.icon;
        const selected = value === a.key;
        const { bg, color } = getColors(a.key);
        return (
          <div
            key={a.key}
            onClick={() => onChange(a.key)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              background: selected ? bg : 'var(--ant-color-fill-tertiary)',
              color: selected ? color : 'var(--ant-color-text-secondary)',
              border: selected ? '2px solid var(--ant-color-primary)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            <Icon style={{ fontSize: 16 }} />
          </div>
        );
      })}
      {emojiAvatars.map((a) => {
        const selected = value === a.key;
        return (
          <div
            key={a.key}
            onClick={() => onChange(a.key)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 20,
              background: selected ? 'var(--ant-color-primary-bg)' : 'var(--ant-color-fill-tertiary)',
              border: selected ? '2px solid var(--ant-color-primary)' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {a.label}
          </div>
        );
      })}
    </div>
  );
}

export function AvatarSettings() {
  const { userAvatar, assistantAvatar, setUserAvatar, setAssistantAvatar } = useUIStore();

  return (
    <div>
      <Typography.Title level={5}>头像设置</Typography.Title>
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        <Popover
          content={<PickerGrid value={userAvatar} onChange={setUserAvatar} />}
          trigger="click"
          placement="bottomLeft"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <AvatarPreview avatarKey={userAvatar} />
            <Typography.Text style={{ fontSize: 12 }}>用户</Typography.Text>
          </div>
        </Popover>
        <Popover
          content={<PickerGrid value={assistantAvatar} onChange={setAssistantAvatar} />}
          trigger="click"
          placement="bottomLeft"
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <AvatarPreview avatarKey={assistantAvatar} />
            <Typography.Text style={{ fontSize: 12 }}>AI</Typography.Text>
          </div>
        </Popover>
      </div>
    </div>
  );
}

/** 根据 key 渲染头像内容 */
export function renderAvatar(avatarKey: string): { icon?: React.ReactNode; emoji?: string; bg: string; color: string } {
  if (avatarKey.startsWith('emoji-')) {
    return { emoji: avatarKey.slice(6), bg: 'var(--ant-color-fill-secondary)', color: 'inherit' };
  }
  const iconMap: Record<string, React.ComponentType> = {
    user: UserOutlined, robot: RobotOutlined, smile: SmileOutlined,
    thunder: ThunderboltOutlined, star: StarOutlined, crown: CrownOutlined,
    bug: BugOutlined, heart: HeartOutlined, fire: FireOutlined, rocket: RocketOutlined,
  };
  const Icon = iconMap[avatarKey];
  const colors = getColors(avatarKey);
  if (Icon) return { icon: <Icon />, ...colors };
  return { icon: <UserOutlined />, ...getColors('user') };
}
