import { Button, Typography, theme } from 'antd';
import { SafetyCertificateOutlined, LockOutlined } from '@ant-design/icons';

const toolLabels: Record<string, string> = {
  Read: '读取文件',
  Write: '写入文件',
  Edit: '编辑文件',
  Bash: '执行命令',
  Grep: '搜索内容',
  Glob: '查找文件',
  WebSearch: '搜索网络',
  WebFetch: '获取网页',
  NotebookEdit: '编辑 Notebook',
  TodoWrite: '待办事项',
};

function getToolLabel(name: string): string {
  return toolLabels[name] || name;
}

function getToolPreview(name: string, input: Record<string, unknown>): string {
  if (input.file_path) return String(input.file_path).split(/[/\\]/).pop() || '';
  if (input.command) return String(input.command).slice(0, 80);
  if (input.path) return String(input.path).split(/[/\\]/).pop() || '';
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query).slice(0, 50);
  return '';
}

interface ApprovalCardProps {
  toolName: string;
  toolInput: Record<string, unknown>;
  reason: string;
  onApprove: (mode: 'once' | 'always') => void;
  onDeny: () => void;
}

export function ApprovalCard({ toolName, toolInput, onApprove, onDeny }: ApprovalCardProps) {
  const { token } = theme.useToken();
  const label = getToolLabel(toolName);
  const preview = getToolPreview(toolName, toolInput);

  return (
    <div style={{
      maxWidth: 900, margin: '0 auto', width: '100%',
      border: `1px solid ${token.colorWarningBorder}`,
      borderRadius: 16, overflow: 'hidden',
      background: token.colorWarningBg,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderBottom: `1px solid ${token.colorWarningBorder}`,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: token.colorWarningBg,
          border: `1px solid ${token.colorWarningBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SafetyCertificateOutlined style={{ color: token.colorWarning, fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>工具执行确认</Typography.Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <LockOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {label}
              {preview && (
                <span style={{ marginLeft: 6, color: token.colorTextQuaternary }}>
                  {preview}
                </span>
              )}
            </Typography.Text>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button size="small" danger onClick={onDeny}>
            停止
          </Button>
          <Button size="small" onClick={() => onApprove('once')}>
            允许一次
          </Button>
          <Button size="small" type="primary" onClick={() => onApprove('always')}>
            始终允许
          </Button>
        </div>
      </div>
    </div>
  );
}
