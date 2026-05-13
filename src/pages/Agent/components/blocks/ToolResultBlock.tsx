import { useState } from 'react';
import { Typography, theme } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

interface ToolResultBlockProps {
  toolUseId: string;
  content: string;
  is_error?: boolean;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export function ToolResultBlock({ content, is_error }: ToolResultBlockProps) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  const hasContent = content && content.trim().length > 0;
  const lineCount = hasContent ? content.split('\n').length : 0;
  const isError = !!is_error;

  const bg = isError ? token.colorErrorBg : token.colorSuccessBg;
  const border = isError ? token.colorErrorBorder : token.colorSuccessBorder;
  const iconColor = isError ? token.colorError : token.colorSuccess;

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden', marginLeft: 24,
      background: bg,
      border: `1px solid ${border}`,
    }}>
      <div
        onClick={() => hasContent && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          cursor: hasContent ? 'pointer' : 'default', userSelect: 'none',
        }}
      >
        {isError ? (
          <CloseCircleOutlined style={{ color: iconColor, fontSize: 13 }} />
        ) : (
          <CheckCircleOutlined style={{ color: iconColor, fontSize: 13 }} />
        )}
        <Typography.Text style={{
          fontSize: 12, flex: 1, color: iconColor,
        }}>
          {isError ? '执行失败' : hasContent ? truncate(content, 60) : '执行成功'}
        </Typography.Text>
        {hasContent && lineCount > 1 && (
          <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0, marginRight: 4 }}>
            {lineCount} 行
          </Typography.Text>
        )}
        {hasContent && (
          <span style={{ color: token.colorTextQuaternary, fontSize: 10, flexShrink: 0 }}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
      </div>
      {expanded && hasContent && (
        <div style={{
          padding: '10px 14px', fontSize: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400, overflow: 'auto',
          color: token.colorTextSecondary,
          borderTop: `1px solid ${border}`,
        }}>
          {content}
        </div>
      )}
    </div>
  );
}
