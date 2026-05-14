import { Tag, Button, Typography, theme } from 'antd';
import {
  CheckOutlined, CloseOutlined,
  ReadOutlined, EditOutlined, FileAddOutlined,
  CodeOutlined, SearchOutlined, GlobalOutlined,
  ToolOutlined, SafetyOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useAgentStore } from '../../../stores/agentStore';

const TOOL_META: Record<string, { icon: ReactNode; color: string }> = {
  Read:    { icon: <ReadOutlined />,    color: '#3b82f6' },
  Edit:    { icon: <EditOutlined />,    color: '#f59e0b' },
  Write:   { icon: <FileAddOutlined />, color: '#10b981' },
  Bash:    { icon: <CodeOutlined />,    color: '#8b5cf6' },
  Glob:    { icon: <SearchOutlined />,  color: '#6366f1' },
  Grep:    { icon: <SearchOutlined />,  color: '#ec4899' },
  WebFetch:{ icon: <GlobalOutlined />,  color: '#06b6d4' },
  WebSearch:{ icon: <GlobalOutlined />, color: '#0ea5e9' },
};

function getPreview(input: Record<string, unknown>): string {
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command);
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query);
  if (input.url) return String(input.url);
  return JSON.stringify(input).slice(0, 80);
}

export function ApprovalBar() {
  const { token } = theme.useToken();
  const pendingApprovals = useAgentStore((s) => s.pendingApprovals);
  const approveTool = useAgentStore((s) => s.approveTool);
  const denyTool = useAgentStore((s) => s.denyTool);

  if (pendingApprovals.length === 0) return null;

  return (
    <div style={{
      padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {pendingApprovals.map((approval) => {
        const meta = TOOL_META[approval.toolName];
        const accentColor = meta?.color || token.colorTextSecondary;
        const preview = getPreview(approval.toolInput);

        return (
          <div
            key={approval.toolUseId}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 12,
              background: token.colorWarningBg,
              border: `1px solid ${token.colorWarningBorder}`,
            }}
          >
            <SafetyOutlined style={{ color: token.colorWarning, fontSize: 16, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Tag
                  style={{
                    fontSize: 11, borderRadius: 6, margin: 0,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '1px 8px', lineHeight: '18px',
                    background: token.colorBgContainer,
                    border: 'none', color: accentColor, fontWeight: 500,
                  }}
                >
                  {meta?.icon || <ToolOutlined />}
                  {approval.toolName}
                </Tag>
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 12 }}
                  ellipsis
                >
                  {preview}
                </Typography.Text>
              </div>
              {approval.prompt && (
                <Typography.Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {approval.prompt}
                </Typography.Text>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => approveTool(approval.toolUseId)}
                style={{ borderRadius: 8 }}
              >
                允许
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => denyTool(approval.toolUseId)}
                style={{ borderRadius: 8 }}
              >
                停止
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
