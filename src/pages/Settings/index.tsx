import { Typography, Divider } from 'antd';
import { GeneralSettings } from './GeneralSettings';
import { AvatarSettings } from './AvatarSettings';
import { ModelSettings } from './ModelSettings';

export default function SettingsPage() {
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <Typography.Title level={3}>设置</Typography.Title>

      <GeneralSettings />
      <Divider />
      <AvatarSettings />
      <Divider />
      <ModelSettings />
    </div>
  );
}
