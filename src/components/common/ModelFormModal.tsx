import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Slider, Switch, Button, Segmented } from 'antd';
import type { ProviderType } from '@shared/types';

export const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'LM Studio', value: 'lmstudio' },
  { label: '自定义', value: 'custom' },
];

export const defaultModels: Record<ProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  ollama: 'llama3',
  lmstudio: 'local-model',
  google: 'gemini-2.5-pro',
  custom: '',
};

const modePresets = {
  precise: { label: '精确', temperature: 0.3, topP: 0.9, maxTokens: 4096 },
  balanced: { label: '平衡', temperature: 0.7, topP: 1.0, maxTokens: 4096 },
  creative: { label: '创意', temperature: 1.0, topP: 1.0, maxTokens: 4096 },
};

type ModeKey = keyof typeof modePresets;

function detectMode(temperature: number, topP: number): ModeKey {
  if (temperature <= 0.5) return 'precise';
  if (temperature <= 0.85) return 'balanced';
  return 'creative';
}

export function getModePreset(mode: ModeKey) {
  return modePresets[mode];
}

interface ModelFormModalProps {
  open: boolean;
  title?: string;
  isEditing?: boolean;
  /** 初始值，open 变化时自动填充 */
  initialValues?: Record<string, unknown>;
  onOk: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ModelFormModal({ open, title = '添加模型', isEditing = false, initialValues, onOk, onCancel }: ModelFormModalProps) {
  const [form] = Form.useForm();
  const [mode, setMode] = useState<ModeKey>('balanced');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // open 时填充初始值
  useEffect(() => {
    if (open) {
      form.resetFields();
      if (initialValues) {
        form.setFieldsValue(initialValues);
      }
      if (initialValues?.temperature != null && initialValues?.topP != null) {
        setMode(detectMode(initialValues.temperature as number, initialValues.topP as number));
      } else {
        setMode('balanced');
      }
      setShowAdvanced(false);
    }
  }, [open, form]);

  const handleProviderChange = (provider: ProviderType) => {
    form.setFieldsValue({ model: defaultModels[provider] });
  };

  const handleModeChange = (value: ModeKey) => {
    setMode(value);
    const preset = modePresets[value];
    form.setFieldsValue({
      temperature: preset.temperature,
      topP: preset.topP,
      maxTokens: preset.maxTokens,
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
    } catch {
      // validation failed, antd shows errors
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="我的 GPT-4o" />
        </Form.Item>
        <Form.Item name="provider" label="Provider" rules={[{ required: true }]}>
          <Select options={providerOptions} onChange={handleProviderChange} />
        </Form.Item>
        <Form.Item name="model" label="模型标识" rules={[{ required: true }]}>
          <Input placeholder="gpt-4o" />
        </Form.Item>
        <Form.Item name="apiKey" label={isEditing ? 'API Key（留空不修改）' : 'API Key'}>
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item name="baseUrl" label="自定义 Base URL（可选）">
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
        <Form.Item label="回复模式">
          <Segmented
            value={mode}
            onChange={(v) => handleModeChange(v as ModeKey)}
            options={Object.entries(modePresets).map(([key, p]) => ({
              label: p.label,
              value: key,
            }))}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--ant-color-text-tertiary)' }}>
            {mode === 'precise' && '更精确、保守的回复，适合代码和技术问答'}
            {mode === 'balanced' && '兼顾准确性和创造力，适合大多数场景'}
            {mode === 'creative' && '更发散、有创意的回复，适合写作和头脑风暴'}
          </div>
        </Form.Item>
        <div style={{ marginBottom: 16 }}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? '收起高级设置' : '高级设置'}
          </Button>
        </div>
        {showAdvanced && (
          <>
            <Form.Item name="maxTokens" label="Max Tokens（回复最大长度）">
              <InputNumber min={1} max={128000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="temperature" label="Temperature（随机性）">
              <Slider min={0} max={2} step={0.1} />
            </Form.Item>
            <Form.Item name="topP" label="Top P（采样范围）">
              <Slider min={0} max={1} step={0.05} />
            </Form.Item>
          </>
        )}
        <Form.Item name="thinking" label="思考模式 (Thinking)" valuePropName="checked" extra="开启后显示模型推理过程（仅支持 Claude / OpenAI 推理模型）">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
