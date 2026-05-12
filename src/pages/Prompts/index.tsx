import { useEffect, useState } from 'react';
import {
  Typography, List, Button, Modal, Form, Input, Select, Tag,
  Space, Popconfirm, App, Divider, Card, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, StarFilled, StarOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { usePromptStore } from '../../stores/promptStore';
import { useChatStore } from '../../stores/chatStore';
import type { PromptTemplate } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '编程', value: 'coding' },
  { label: '写作', value: 'writing' },
  { label: '分析', value: 'analysis' },
];

/** 子组件：模板编辑表单，form 实例在内部创建 */
function PromptFormModal({ open, editing, categories, onSave, onCancel }: {
  open: boolean;
  editing: PromptTemplate | null;
  categories: string[];
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({ ...editing, tags: editing.tags.join(',') });
      } else {
        form.setFieldsValue({ category: 'general', variables: [], tags: [] });
      }
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSave(values);
    } catch {
      // validation failed
    }
  };

  return (
    <Modal title={editing ? '编辑模板' : '新建模板'} open={open} onOk={handleOk} onCancel={onCancel} width={640} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="category" label="分类" rules={[{ required: true }]}>
          <Select options={categories.map((c) => ({ label: c, value: c }))} allowClear placeholder="输入新分类或选择已有分类" />
        </Form.Item>
        <Form.Item name="content" label="模板内容" rules={[{ required: true }]} extra="使用 {{变量名}} 定义变量">
          <Input.TextArea rows={8} placeholder="请帮我审查以下代码：\n\n{{code}}" />
        </Form.Item>
        <Form.Item name="tags" label="标签（逗号分隔）"><Input placeholder="编程, 代码审查" /></Form.Item>
      </Form>
    </Modal>
  );
}

/** 子组件：使用模板变量填写表单 */
function UseTemplateModal({ open, template, onConfirm, onCancel }: {
  open: boolean;
  template: PromptTemplate | null;
  onConfirm: (variables: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && template) {
      form.resetFields();
      template.variables.forEach((v) => {
        if (v.defaultValue) form.setFieldValue(v.name, v.defaultValue);
      });
    }
  }, [open, template, form]);

  const handleOk = async () => {
    if (!template) return;
    try {
      await form.validateFields();
      const variables: Record<string, string> = {};
      template.variables.forEach((v) => {
        variables[v.name] = form.getFieldValue(v.name) || '';
      });
      onConfirm(variables);
    } catch {
      // validation failed
    }
  };

  return (
    <Modal title={`使用模板：${template?.name}`} open={open} onOk={handleOk} onCancel={onCancel} width={520} destroyOnHidden>
      {template?.variables.length ? (
        <Form form={form} layout="vertical">
          {template.variables.map((v) => (
            <Form.Item key={v.name} name={v.name} label={v.label} rules={[{ required: v.required }]}>
              {v.type === 'textarea' ? <Input.TextArea rows={4} placeholder={v.placeholder} /> : <Input placeholder={v.placeholder} />}
            </Form.Item>
          ))}
        </Form>
      ) : (
        <Typography.Text type="secondary">此模板无需填写变量，点击确定即可复制内容。</Typography.Text>
      )}
    </Modal>
  );
}

export default function PromptsPage() {
  const { prompts, categories, loadPrompts, loadCategories, savePrompt, deletePrompt, toggleFavorite, usePrompt } = usePromptStore();
  const strictPromptMode = useChatStore((s) => s.strictPromptMode);
  const setStrictPromptMode = useChatStore((s) => s.setStrictPromptMode);
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [useDrawerOpen, setUseDrawerOpen] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState<PromptTemplate | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadPrompts(); loadCategories(); }, []);

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (t: PromptTemplate) => {
    setEditing(t);
    setModalOpen(true);
  };

  const handleSave = async (values: Record<string, unknown>) => {
    try {
      await savePrompt({
        ...editing,
        ...values,
        id: editing?.id || uuidv4(),
        tags: typeof values.tags === 'string' ? values.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : (values.tags as string[]) || [],
      });
      message.success(editing ? '模板已更新' : '模板已创建');
      setModalOpen(false);
    } catch (err: unknown) {
      const e = err as Error;
      message.error(`保存失败: ${e?.message || err}`);
    }
  };

  const handleUse = (t: PromptTemplate) => {
    setUsingTemplate(t);
    setUseDrawerOpen(true);
  };

  const handleUseConfirm = async (variables: Record<string, string>) => {
    if (!usingTemplate) return;
    try {
      const content = await usePrompt(usingTemplate.id, variables);
      await navigator.clipboard.writeText(content);
      message.success('已复制到剪贴板');
      setUseDrawerOpen(false);
    } catch (err: unknown) {
      const e = err as Error;
      message.error(`操作失败: ${e?.message || err}`);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Prompt 模板库</Typography.Title>
        <Space>
          <Input.Search placeholder="搜索模板..." onSearch={(v) => loadPrompts({ search: v })} style={{ width: 200 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建模板</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space wrap>
          <Tag.CheckableTag checked={!search} onChange={() => { setSearch(''); loadPrompts(); }}>全部</Tag.CheckableTag>
          <Tag.CheckableTag checked={search === 'favorite'} onChange={() => { setSearch('favorite'); loadPrompts({ favorite: true }); }}>
            <StarFilled /> 收藏
          </Tag.CheckableTag>
          {categories.map((c) => (
            <Tag.CheckableTag key={c} checked={search === c} onChange={() => { setSearch(c); loadPrompts({ category: c }); }}>
              {c}
            </Tag.CheckableTag>
          ))}
        </Space>
        <Space>
          <span style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>强约束</span>
          <Switch size="small" checked={strictPromptMode} onChange={setStrictPromptMode} />
        </Space>
      </div>

      <List
        grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
        dataSource={prompts}
        renderItem={(item) => (
          <List.Item>
            <Card
                title={
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {item.name}
                  </span>
                }
                size="small"
                style={{ width: '100%' }}
                styles={{ body: { overflow: 'hidden' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <Tag style={{ flexShrink: 0 }}>{item.category}</Tag>
                    {item.isBuiltIn && <Tag color="blue" style={{ flexShrink: 0 }}>内置</Tag>}
                    {item.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                  </div>
                  <Space size={0} style={{ flexShrink: 0 }}>
                    <Button
                      type="text"
                      size="small"
                      icon={item.isFavorite ? <StarFilled style={{ color: '#fadb14' }} /> : <StarOutlined />}
                      onClick={() => toggleFavorite(item.id)}
                      title={item.isFavorite ? '取消收藏' : '收藏'}
                    />
                    <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleUse(item)} title="使用" />
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(item)} />
                    {!item.isBuiltIn && (
                      <Popconfirm title="确定删除？" onConfirm={() => deletePrompt(item.id)}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                </div>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                  {item.description || item.content.slice(0, 100)}
                </Typography.Paragraph>
              </Card>
          </List.Item>
        )}
        locale={{ emptyText: '暂无模板，点击上方"新建模板"' }}
      />

      {/* 编辑弹窗 */}
      <PromptFormModal
        open={modalOpen}
        editing={editing}
        categories={categories}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
      />

      {/* 使用弹窗 */}
      <UseTemplateModal
        open={useDrawerOpen}
        template={usingTemplate}
        onConfirm={handleUseConfirm}
        onCancel={() => setUseDrawerOpen(false)}
      />
    </div>
  );
}
