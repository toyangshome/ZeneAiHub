import { useState, useEffect } from 'react';
import { Typography, Input, Button, Tag, Space, Modal, App } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/agentStore';
import { api } from '../../services/ipcBridge';

const MODEL_PRESETS = [
  { key: 'opus', label: 'Opus', defaultModel: 'claude-opus-4-20250514' },
  { key: 'sonnet4', label: 'Sonnet 4', defaultModel: 'claude-sonnet-4-5-20250514' },
  { key: 'sonnet37', label: 'Sonnet 3.7', defaultModel: 'claude-sonnet-3-7-20250219' },
  { key: 'haiku', label: 'Haiku', defaultModel: 'claude-haiku-3-5-20241022' },
] as const;

type ModelMap = Record<string, string>;

export function ClaudeCodeSettings() {
  const { message } = App.useApp();
  const cliAvailable = useAgentStore((s) => s.cliAvailable);
  const cliVersion = useAgentStore((s) => s.cliVersion);
  const cliCheckError = useAgentStore((s) => s.cliCheckError);
  const checkCli = useAgentStore((s) => s.checkCli);
  const getCliVersion = useAgentStore((s) => s.getCliVersion);

  const [modalOpen, setModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState<ModelMap>({});
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadConfig = async () => {
    const [key, url, m] = await Promise.all([
      api.store.get<string>('claude-api-key', ''),
      api.store.get<string>('claude-base-url', ''),
      api.store.get<ModelMap>('claude-models', {}),
    ]);
    setApiKey(key || '');
    setBaseUrl(url || '');
    setModels(m || {});
  };

  useEffect(() => { loadConfig(); }, []);

  const handleOpen = () => {
    loadConfig();
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.store.set('claude-api-key', apiKey.trim()),
        api.store.set('claude-base-url', baseUrl.trim()),
        api.store.set('claude-models', models),
      ]);
      message.success('配置已保存');
      setModalOpen(false);
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Typography.Title level={5}>Claude Code</Typography.Title>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {cliAvailable ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已内置 {cliVersion && `v${cliVersion}`}
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            {cliCheckError || '不可用'}
          </Tag>
        )}
        {baseUrl && <Tag>代理: {baseUrl}</Tag>}
        <Button size="small" icon={<ReloadOutlined />} onClick={() => { checkCli(); getCliVersion(); }}>
          重新检测
        </Button>
        <Button size="small" icon={<SettingOutlined />} onClick={handleOpen}>
          配置
        </Button>
      </div>

      <Modal
        title="Claude Code 配置"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={480}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 12 }}>
          <div>
            <Typography.Text strong>API Key</Typography.Text>
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-... 或第三方 key"
              visibilityToggle={{ visible: showKey, onVisibleChange: setShowKey }}
              style={{ marginTop: 6 }}
            />
          </div>
          <div>
            <Typography.Text strong>API Base URL</Typography.Text>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="留空使用官方地址，例：https://api.anthropic.com"
              style={{ marginTop: 6 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              支持兼容 Anthropic API 的第三方代理地址
            </Typography.Text>
          </div>
          <div>
            <Typography.Text strong>模型映射</Typography.Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {MODEL_PRESETS.map((p) => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text style={{ width: 80, flexShrink: 0, fontSize: 13 }}>
                    {p.label}
                  </Typography.Text>
                  <Input
                    size="small"
                    value={models[p.key] || ''}
                    onChange={(e) => setModels((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder={p.defaultModel}
                  />
                </div>
              ))}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              留空则使用官方默认模型名
            </Typography.Text>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
