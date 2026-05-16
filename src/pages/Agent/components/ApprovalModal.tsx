import { Modal, Tag, Typography, theme, Alert } from 'antd';
import {
  CheckOutlined, CloseOutlined, SafetyOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';
import { TOOL_META, getToolDetail } from '../agentToolMeta';

export function ApprovalModal() {
  const { token } = theme.useToken();
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const approveTool = useAgentStore((s) => s.approveTool);
  const denyTool = useAgentStore((s) => s.denyTool);
  const alwaysAllowTool = useAgentStore((s) => s.alwaysAllowTool);

  const current = pendingApprovals[0];
  if (!current) return null;

  const meta = TOOL_META[current.toolName];
  const accentColor = meta?.color || token.colorTextSecondary;
  const detail = getToolDetail(current.toolInput);
  const isBash = current.toolName === 'Bash';
  const remaining = pendingApprovals.length - 1;

  return (
    <Modal
      open
      closable={false}
      maskClosable={false}
      footer={null}
      width={520}
      styles={{ body: { padding: 0 } }}
      destroyOnClose
    >
      <div style={{ padding: '20px 24px 0' }}>
        {/* 标题区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <SafetyOutlined style={{ color: token.colorWarning, fontSize: 20 }} />
          <Typography.Text strong style={{ fontSize: 16 }}>
            工具调用确认
          </Typography.Text>
          {remaining > 0 && (
            <Tag style={{ marginLeft: 'auto', borderRadius: 8, fontSize: 11 }}>
              还有 {remaining} 项待确认
            </Tag>
          )}
        </div>

        {/* 工具信息 */}
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: token.colorBgTextHover,
          border: `1px solid ${token.colorBorderSecondary}`,
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Tag style={{
              fontSize: 12, borderRadius: 6, margin: 0,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 10px', fontWeight: 500,
              background: token.colorBgContainer, border: 'none',
              color: accentColor,
            }}>
              {meta?.icon || <ToolOutlined />}
              {current.toolName}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {meta?.risk || '执行操作'}
            </Typography.Text>
          </div>

          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: token.colorBgContainer,
            fontSize: 13, lineHeight: 1.6,
            fontFamily: "'Cascadia Code', 'Fira Code', monospace",
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            maxHeight: 200, overflow: 'auto',
            color: token.colorText,
          }}>
            {detail}
          </div>
        </div>

        {/* Bash 命令警告 */}
        {isBash && (
          <Alert
            type="warning"
            showIcon
            message="此操作将执行系统命令，请确认命令内容安全"
            style={{ marginBottom: 16, borderRadius: 8 }}
          />
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{
        display: 'flex', gap: 8, justifyContent: 'flex-end',
        padding: '12px 24px 20px',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <button
          onClick={() => denyTool(current.toolUseId)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 16px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${token.colorBorder}`,
            background: token.colorBgContainer,
            color: token.colorText,
            cursor: 'pointer',
          }}
        >
          <CloseOutlined /> 拒绝
        </button>
        <button
          onClick={() => alwaysAllowTool(current.toolUseId, current.toolName)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 16px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${token.colorPrimaryBorder}`,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            cursor: 'pointer',
          }}
        >
          始终允许 {current.toolName}
        </button>
        <button
          onClick={() => approveTool(current.toolUseId)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            border: 'none',
            background: token.colorPrimary,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <CheckOutlined /> 允许
        </button>
      </div>
    </Modal>
  );
}
