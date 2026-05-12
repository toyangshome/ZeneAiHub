import { useEffect, useState } from 'react';
import { Typography, List, Button, Space, Popconfirm, Tag, App } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ApiOutlined, LoadingOutlined } from '@ant-design/icons';
import { useModelStore } from '../../stores/modelStore';
import { api } from '../../services/ipcBridge';
import { ModelFormModal, getModePreset } from '../../components/common/ModelFormModal';
import type { ModelConfigInput, ModelConfigPublic } from '@shared/types';

const defaultAddValues = {
  provider: 'openai' as const,
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 1,
};

export function ModelSettings() {
  const { models, loadModels, saveModel, deleteModel } = useModelStore();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfigPublic | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formDefaults, setFormDefaults] = useState<Record<string, unknown>>(defaultAddValues);

  useEffect(() => {
    loadModels();
  }, []);

  const handleAdd = () => {
    setEditingModel(null);
    setFormDefaults(defaultAddValues);
    setModalOpen(true);
  };

  const handleEdit = (model: ModelConfigPublic) => {
    setEditingModel(model);
    setFormDefaults({ ...model, apiKey: '' });
    setModalOpen(true);
  };

  const handleSave = async (values: Record<string, unknown>) => {
    try {
      const input = {
        ...values,
        maxTokens: (values.maxTokens as number) ?? getModePreset('balanced').maxTokens,
        temperature: (values.temperature as number) ?? getModePreset('balanced').temperature,
        topP: (values.topP as number) ?? getModePreset('balanced').topP,
        id: editingModel?.id,
      } as unknown as ModelConfigInput;
      await saveModel(input);
      message.success(editingModel ? '模型已更新' : '模型已添加');
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as Error;
      message.error(`保存失败: ${e?.message || err}`);
    }
  };

  const handleTest = async (model: ModelConfigPublic) => {
    setTestingId(model.id);
    try {
      const result = await api.model.test({
        name: model.name,
        provider: model.provider,
        model: model.model,
        baseUrl: model.baseUrl,
        maxTokens: model.maxTokens,
        temperature: model.temperature,
        topP: model.topP,
        frequencyPenalty: model.frequencyPenalty,
        presencePenalty: model.presencePenalty,
        id: model.id,
      });
      if (result.success) {
        message.success(`${model.name} 连接成功 (${result.latency}ms)`);
      } else {
        message.error(`${model.name} 连接失败: ${result.error}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      message.error(`测试失败: ${e.message}`);
    }
    setTestingId(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>模型管理</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加模型
        </Button>
      </div>

      <List
        dataSource={models}
        renderItem={(model) => (
          <List.Item
            actions={[
              <Button
                key="test"
                type="text"
                icon={testingId === model.id ? <LoadingOutlined /> : <ApiOutlined />}
                onClick={() => handleTest(model)}
                disabled={!!testingId && testingId !== model.id}
              >
                测试
              </Button>,
              <Button key="edit" type="text" icon={<EditOutlined />} onClick={() => handleEdit(model)} />,
              <Popconfirm key="delete" title="确定删除此模型？" onConfirm={() => deleteModel(model.id)}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  {model.name}
                  <Tag color={model.hasApiKey ? 'green' : 'default'}>
                    {model.hasApiKey ? '已配置 Key' : '未配置'}
                  </Tag>
                  {model.thinking && <Tag color="orange">Thinking</Tag>}
                </Space>
              }
              description={`${model.provider} — ${model.model}`}
            />
          </List.Item>
        )}
        locale={{ emptyText: '暂无模型配置，点击上方"添加模型"' }}
      />

      <ModelFormModal
        open={modalOpen}
        title={editingModel ? '编辑模型' : '添加模型'}
        isEditing={!!editingModel}
        initialValues={formDefaults}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
