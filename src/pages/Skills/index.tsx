import { useEffect, useState } from 'react';
import {
  Typography, Button, Modal, Form, Input, Select, Tag,
  Space, Popconfirm, Switch, App, Card, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useSkillStore } from '../../stores/skillStore';
import type { Skill, SkillParam } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import SkillExecute from './components/SkillExecute';

const PARAM_TYPE_OPTIONS = [
  { label: '文本', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
];

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '编程', value: 'coding' },
  { label: '写作', value: 'writing' },
  { label: '分析', value: 'analysis' },
];

const defaultSkillValues = {
  category: 'general',
  icon: '',
  parameters: [],
  enabled: true,
};

/** 子组件：form 实例在内部创建，仅在 Modal 打开时挂载 */
function SkillFormModal({ open, editing, onSave, onCancel }: {
  open: boolean;
  editing: Skill | null;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({
          ...editing,
          parameters: editing.parameters.map((p) => ({ ...p })),
        });
      } else {
        form.setFieldsValue(defaultSkillValues);
      }
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const params: SkillParam[] = (values.parameters || []).map((p: Record<string, unknown>) => ({
        name: p.name,
        label: p.label || p.name,
        type: p.type || 'string',
        description: p.description || '',
        required: !!p.required,
        defaultValue: p.defaultValue,
      }));
      onSave({ ...values, parameters: params });
    } catch {
      // validation failed
    }
  };

  return (
    <Modal
      title={editing ? '编辑 Skill' : '新建 Skill'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={680}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}>
          <Input placeholder="输入 Skill 名称" />
        </Form.Item>
        <Space style={{ width: '100%' }} align="start">
          <Form.Item name="icon" label="图标（emoji）">
            <Input placeholder="" style={{ width: 80 }} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="简要描述这个 Skill 的用途" />
        </Form.Item>
        <Form.Item name="systemPrompt" label="系统提示词" rules={[{ required: true }]}
          extra="使用 {{参数名}} 引用参数，如: 请审查以下代码：{{code}}">
          <Input.TextArea rows={6} placeholder="你是一个代码审查专家，请审查以下代码并提供改进建议..." />
        </Form.Item>

        {/* 参数定义 */}
        <Divider orientation="left" style={{ margin: '12px 0' }}>参数定义</Divider>
        <Form.List name="parameters">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }} wrap>
                  <Form.Item
                    {...field}
                    name={[field.name, 'name']}
                    rules={[{ required: true, message: '参数名必填' }]}
                  >
                    <Input placeholder="参数名" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'label']}>
                    <Input placeholder="显示名" style={{ width: 100 }} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'type']} initialValue="string">
                    <Select options={PARAM_TYPE_OPTIONS} style={{ width: 80 }} />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'required']} valuePropName="checked" initialValue={false}>
                    <Switch checkedChildren="必填" unCheckedChildren="可选" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'defaultValue']}>
                    <Input placeholder="默认值" style={{ width: 100 }} />
                  </Form.Item>
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add({ name: '', label: '', type: 'string', required: false })} icon={<PlusOutlined />}>
                添加参数
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}

export default function SkillsPage() {
  const { skills, loadSkills, saveSkill, deleteSkill } = useSkillStore();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [executeSkill, setExecuteSkill] = useState<Skill | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (s: Skill) => {
    setEditing(s);
    setModalOpen(true);
  };

  const handleSave = async (values: Record<string, unknown>) => {
    try {
      await saveSkill({
        ...editing,
        ...values,
        id: editing?.id || uuidv4(),
        parameters: values.parameters as SkillParam[],
      });
      message.success(editing ? 'Skill 已更新' : 'Skill 已创建');
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as Error;
      message.error(`保存失败: ${e?.message || err}`);
    }
  };

  const handleExecute = (s: Skill) => {
    if (s.parameters.length > 0) {
      setExecuteSkill(s);
    } else {
      // 无参数，直接执行
      useSkillStore.getState().executeSkill(s.id, {}).then(() => {
        navigate('/chat');
        message.success(`Skill "${s.name}" 已执行`);
      }).catch((err) => {
        message.error(`执行失败: ${err?.message || err}`);
      });
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', minHeight: '100%' }}>
      <style>{`
        .skill-card {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .skill-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Skill 管理</Typography.Title>
        <Space>
          <Input.Search placeholder="搜索 Skill..." onSearch={(v) => loadSkills({ search: v })} style={{ width: 200 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建 Skill</Button>
        </Space>
      </div>

      <div className="grid-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {skills.length === 0 && (
          <div style={{ width: '100%', textAlign: 'center', padding: 48, color: 'var(--ant-color-text-secondary)' }}>
            暂无 Skill，点击上方"新建 Skill"
          </div>
        )}
        {skills.map((item) => (
          <div key={item.id} className="grid-item">
            <Card
              className="skill-card"
              title={
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {item.icon && <span>{item.icon} </span>}
                  {item.name}
                </span>
              }
              extra={
                <Space size={0} style={{ flexShrink: 0 }}>
                  <Button
                    type="text"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleExecute(item)}
                    title="执行"
                    disabled={!item.enabled}
                  />
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(item)} />
                  <Popconfirm title="确定删除？" onConfirm={() => deleteSkill(item.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
              size="small"
              style={{ height: 180, display: 'flex', flexDirection: 'column' }}
              styles={{ body: { overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' } }}
            >
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                {item.description}
              </Typography.Paragraph>
              <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Tag style={{ flexShrink: 0 }}>{item.category}</Tag>
                  {!item.enabled && <Tag color="red" style={{ flexShrink: 0 }}>已禁用</Tag>}
                  {item.parameters.map((p) => (
                    <Tag key={p.name} color={p.required ? 'blue' : 'default'}>
                      {p.label || p.name}
                      {p.required && '*'}
                    </Tag>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* 编辑弹窗 */}
      <SkillFormModal
        open={modalOpen}
        editing={editing}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
      />

      {/* 执行面板 */}
      {executeSkill && (
        <SkillExecute
          skill={executeSkill}
          open={!!executeSkill}
          onClose={() => setExecuteSkill(null)}
        />
      )}
    </div>
  );
}
