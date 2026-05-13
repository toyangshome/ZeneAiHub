import { useState } from 'react';
import { Typography, Tag, theme } from 'antd';
import { ToolOutlined, DownOutlined, RightOutlined, LoadingOutlined } from '@ant-design/icons';

// 工具名映射为中文描述
const toolLabels: Record<string, string> = {
  read: '读取文件',
  write: '写入文件',
  edit: '编辑文件',
  bash: '执行命令',
  grep: '搜索内容',
  glob: '查找文件',
  web_search: '搜索网络',
  web_fetch: '获取网页',
  git: 'Git 操作',
};

function getToolLabel(name: string): string {
  return toolLabels[name] || name;
}

interface ToolUseBlockProps {
  id: string;
  name: string;
  input: Record<string, unknown>;
  hasResult?: boolean;
}

export function ToolUseBlock({ name, input, hasResult }: ToolUseBlockProps) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  const label = getToolLabel(name);

  // 生成简要预览
  const getPreview = () => {
    if (input.file_path) return String(input.file_path).split(/[/\\]/).pop();
    if (input.command) return String(input.command).slice(0, 60);
    if (input.pattern) return String(input.pattern);
    if (input.query) return String(input.query).slice(0, 40);
    if (input.url) return String(input.url).slice(0, 50);
    return '';
  };
  const preview = getPreview();

  return (
    <div style={{
      border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 12,
      overflow: 'hidden', background: token.colorBgTextHover,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: hasResult ? token.colorSuccessBg : token.colorPrimaryBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {hasResult ? (
            <ToolOutlined style={{ color: token.colorSuccess, fontSize: 14 }} />
          ) : (
            <LoadingOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Typography.Text strong style={{ fontSize: 13 }}>{label}</Typography.Text>
            {!hasResult && (
              <Tag color="processing" style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}>
                执行中
              </Tag>
            )}
          </div>
          {preview && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }} ellipsis>
              {preview}
            </Typography.Text>
          )}
        </div>
        <span style={{ color: token.colorTextQuaternary, fontSize: 10, flexShrink: 0 }}>
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
      </div>
      {expanded && (
        <div style={{
          padding: '10px 14px', fontFamily: 'var(--ant-font-family)', fontSize: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto',
          color: token.colorTextSecondary, borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}>
          {JSON.stringify(input, null, 2)}
        </div>
      )}
    </div>
  );
}
