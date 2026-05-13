import { useState, useEffect } from 'react';
import { Typography, Input, Button, Tag, Space, Modal, App } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/agentStore';
import { api } from '../../services/ipcBridge';

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
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const loadConfig = async () => {
    const [key, url, m] = await Promise.all([
      api.store.get<string>('claude-api-key', ''),
      api.store.get<string>('claude-base-url', ''),
      api.store.get<string>('claude-model', ''),
    ]);
    setApiKey(key || '');
    setBaseUrl(url || '');
    setModel(m || '');
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
        api.store.set('claude-model', model.trim()),
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
        {model && <Tag>模型: {model}</Tag>}
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
            <Typography.Text strong>模型</Typography.Text>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="留空使用默认模型，例：claude-sonnet-4-5-20250514"
              style={{ marginTop: 6 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
