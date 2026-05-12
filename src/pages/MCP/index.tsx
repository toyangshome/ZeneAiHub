import { useEffect, useState } from 'react';
import {
  Typography, Button, Modal, Form, Input, Select, Tag, Switch,
  Space, Popconfirm, App, Card, Divider, InputNumber, Collapse,
  Descriptions, Empty, Spin, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, LinkOutlined, DisconnectOutlined,
  PlayCircleOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  LoadingOutlined, ExclamationCircleOutlined, ExperimentOutlined,
} from '@ant-design/icons';
import { useMCPStore } from '../../stores/mcpStore';
import type { MCPServerConfig, MCPTool, MCPToolResult } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const TRANSPORT_OPTIONS = [
  { label: 'stdio（子进程）', value: 'stdio' },
  { label: 'SSE（HTTP）', value: 'sse' },
];

/** 状态标签 */
function StatusTag({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    connected: { color: 'success', icon: <CheckCircleOutlined />, label: '已连接' },
    connecting: { color: 'processing', icon: <LoadingOutlined />, label: '连接中' },
    disconnected: { color: 'default', icon: <DisconnectOutlined />, label: '未连接' },
    error: { color: 'error', icon: <CloseCircleOutlined />, label: '连接失败' },
  };
  const cfg = map[status] || map.disconnected;
  return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
}

/** Server 编辑弹窗 */
function ServerFormModal({ open, editing, onSave, onCancel }: {
  open: boolean;
  editing: MCPServerConfig | null;
  onSave: (values: MCPServerConfig) => void;
  onCancel: () => void;
}) {
  const [form] = Form.useForm();
  const transport = Form.useWatch('transport', form) || 'stdio';

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (editing) {
        form.setFieldsValue({
          ...editing,
          args: (editing.args || []).join(' '),
        });
      } else {
        form.setFieldsValue({ transport: 'stdio', enabled: true, autoReconnect: false, reconnectInterval: 30, timeout: 60000 });
      }
    }
  }, [open, editing, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onSave({
        ...editing,
        ...values,
        id: editing?.id || uuidv4(),
        args: typeof values.args === 'string'
          ? values.args.trim().split(/\s+/).filter(Boolean)
          : values.args || [],
      });
    } catch { /* validation failed */ }
  };

  return (
    <Modal
      title={editing ? '编辑 MCP Server' : '添加 MCP Server'}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={600}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="如：文件系统工具" />
        </Form.Item>
        <Form.Item name="transport" label="传输方式" rules={[{ required: true }]}>
          <Select options={TRANSPORT_OPTIONS} />
        </Form.Item>

        {transport === 'stdio' ? (
          <>
            <Form.Item name="command" label="命令" rules={[{ required: true, message: '请输入命令' }]}
              extra="可执行文件路径，如 npx、node、python">
              <Input placeholder="npx" />
            </Form.Item>
            <Form.Item name="args" label="参数"
              extra="空格分隔，如 -y @modelcontextprotocol/server-filesystem /tmp">
              <Input placeholder="-y @modelcontextprotocol/server-filesystem /tmp" />
            </Form.Item>
            <Form.Item name="cwd" label="工作目录（可选）">
              <Input placeholder="留空则使用默认目录" />
            </Form.Item>
          </>
        ) : (
          <Form.Item name="url" label="SSE URL" rules={[{ required: true, type: 'url', message: '请输入有效 URL' }]}>
            <Input placeholder="http://localhost:3001/sse" />
          </Form.Item>
        )}

        <Divider style={{ margin: '12px 0' }} />
        <Space>
          <Form.Item name="enabled" label="启用" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="autoReconnect" label="自动重连" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="timeout" label="超时(ms)" style={{ marginBottom: 0, width: 140 }}>
            <InputNumber min={5000} max={300000} step={5000} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}

/** 工具测试面板 */
function ToolTestPanel({ tool, serverId, onCall }: {
  tool: MCPTool;
  serverId: string;
  onCall: (serverId: string, name: string, args: Record<string, unknown>) => Promise<MCPToolResult>;
}) {
  const [form] = Form.useForm();
  const [result, setResult] = useState<MCPToolResult | null>(null);
  const [loading, setLoading] = useState(false);

  const properties = (tool.inputSchema?.properties || {}) as Record<string, { type?: string; description?: string; required?: boolean }>;
  const required = (tool.inputSchema?.required || []) as string[];

  const handleCall = async () => {
    setLoading(true);
    setResult(null);
    try {
      const values = await form.validateFields();
      const res = await onCall(serverId, tool.name, values);
      setResult(res);
    } catch (err: unknown) {
      setResult({ content: [{ type: 'text', text: `调用失败: ${(err as Error).message || err}` }], isError: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card size="small" title={tool.name} style={{ marginBottom: 8 }}
      extra={
        <Button type="primary" size="small" icon={<PlayCircleOutlined />} loading={loading} onClick={handleCall}>
          调用
        </Button>
      }
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
        {tool.description}
      </Typography.Paragraph>
      {Object.keys(properties).length > 0 && (
        <Form form={form} layout="vertical" size="small">
          {Object.entries(properties).map(([key, schema]) => (
            <Form.Item key={key} name={key} label={key}
              rules={[{ required: required.includes(key), message: `${key} 必填` }]}
              extra={schema.description}
              style={{ marginBottom: 8 }}
            >
              {schema.type === 'boolean' ? <Switch /> : <Input size="small" />}
            </Form.Item>
          ))}
        </Form>
      )}
      {result && (
        <div style={{ marginTop: 8, padding: 8, background: result.isError ? 'var(--ant-color-error-bg, #fff2f0)' : 'var(--ant-color-success-bg, #f6ffed)', borderRadius: 6, fontSize: 12 }}>
          {result.content.map((c, i) => (
            <div key={i}>{c.type === 'text' ? c.text : `[${c.type}]`}</div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function MCPPage() {
  const { servers, tools, loading, loadServers, saveServer, deleteServer, connectServer, disconnectServer, callTool } = useMCPStore();
  const { message } = App.useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MCPServerConfig | null>(null);
  const [expandedTools, setExpandedTools] = useState<string | null>(null);

  useEffect(() => { loadServers(); }, []);

  const handleAdd = () => { setEditing(null); setModalOpen(true); };
  const handleEdit = (s: MCPServerConfig) => { setEditing(s); setModalOpen(true); };

  const handleQuickTest = async () => {
    const testConfig: MCPServerConfig = {
      id: uuidv4(),
      name: '文件系统工具（测试）',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
      enabled: true,
      autoReconnect: false,
      timeout: 30000,
    };
    try {
      await saveServer(testConfig);
      message.success('测试 Server 已添加，点击"连接"开始使用');
    } catch (err: unknown) {
      message.error(`添加失败: ${(err as Error).message || err}`);
    }
  };

  const handleSave = async (values: MCPServerConfig) => {
    try {
      await saveServer(values);
      message.success(editing ? 'Server 已更新' : 'Server 已添加');
      setModalOpen(false);
    } catch (err: unknown) {
      message.error(`保存失败: ${(err as Error).message || err}`);
    }
  };

  const handleConnect = async (id: string, name: string) => {
    try {
      await connectServer(id);
      message.success(`"${name}" 已连接`);
    } catch (err: unknown) {
      message.error(`连接失败: ${(err as Error).message || err}`);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectServer(id);
      message.info('已断开连接');
    } catch (err: unknown) {
      message.error(`断开失败: ${(err as Error).message || err}`);
    }
  };

  const connectedServers = servers.filter((s) => s.status === 'connected');

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto', minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>MCP 管理</Typography.Title>
        <Space>
          <Button icon={<ExperimentOutlined />} onClick={handleQuickTest}>快速测试</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加 Server</Button>
        </Space>
      </div>

      {/* Server 卡片列表 */}
      <div className="grid-container" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {servers.length === 0 && !loading && (
          <div style={{ width: '100%' }}>
            <Empty description={'暂无 MCP Server，点击「快速测试」或「添加 Server」开始配置'} />
          </div>
        )}
        {servers.map((server) => (
          <div key={server.id} className="grid-item">
            <Card
              title={
                <Space>
                  <ApiOutlined />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {server.name}
                  </span>
                </Space>
              }
              extra={<StatusTag status={server.status} />}
              size="small"
            >
              <Descriptions column={1} size="small" styles={{ label: { fontSize: 12, color: 'var(--ant-color-text-secondary)' }, content: { fontSize: 12 } }}>
                <Descriptions.Item label="传输方式">{server.transport}</Descriptions.Item>
                <Descriptions.Item label={server.transport === 'stdio' ? '命令' : 'URL'}>
                  <Typography.Text ellipsis style={{ fontSize: 12 }}>
                    {server.transport === 'stdio'
                      ? `${server.command} ${(server.args || []).join(' ')}`
                      : server.url}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <Space size={4}>
                  {server.status === 'connected' ? (
                    <Button size="small" icon={<DisconnectOutlined />} onClick={() => handleDisconnect(server.id)}>断开</Button>
                  ) : (
                    <Button size="small" type="primary" icon={<LinkOutlined />}
                      loading={server.status === 'connecting'}
                      onClick={() => handleConnect(server.id, server.name)}
                      disabled={!server.enabled}
                    >连接</Button>
                  )}
                </Space>
                <Space size={0}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(server)} />
                  <Popconfirm title="确定删除？" onConfirm={() => deleteServer(server.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {/* 已连接 Server 的工具列表 */}
      {connectedServers.length > 0 && (
        <>
          <Divider>已发现的工具</Divider>
          <Collapse
            activeKey={expandedTools ? [expandedTools] : []}
            onChange={(keys) => setExpandedTools(Array.isArray(keys) ? (keys[0] as string || null) : (keys || null))}
            items={connectedServers.map((server) => ({
              key: server.id,
              label: (
                <Space>
                  <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />
                  {server.name}
                  <Tag>{tools.filter((t) => t.serverId === server.id).length} 个工具</Tag>
                </Space>
              ),
              children: tools.filter((t) => t.serverId === server.id).length === 0
                ? <Empty description="此 Server 没有提供工具" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                : tools.filter((t) => t.serverId === server.id).map((tool) => (
                  <ToolTestPanel key={tool.name} tool={tool} serverId={server.id} onCall={callTool} />
                )),
            }))}
          />
        </>
      )}

      {/* 编辑弹窗 */}
      <ServerFormModal
        open={modalOpen}
        editing={editing}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
