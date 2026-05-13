import { useState } from 'react';
import { Typography } from 'antd';
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
  const [expanded, setExpanded] = useState(false);
  const hasContent = content && content.trim().length > 0;
  const lineCount = hasContent ? content.split('\n').length : 0;
  const isError = !!is_error;

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden', marginLeft: 24,
      background: isError ? 'var(--ant-color-error-bg)' : 'var(--ant-color-success-bg)',
      border: `1px solid ${isError ? 'var(--ant-color-error-border)' : 'var(--ant-color-success-border)'}`,
    }}>
      <div
        onClick={() => hasContent && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          cursor: hasContent ? 'pointer' : 'default', userSelect: 'none',
        }}
      >
        {isError ? (
          <CloseCircleOutlined style={{ color: 'var(--ant-color-error)', fontSize: 13 }} />
        ) : (
          <CheckCircleOutlined style={{ color: 'var(--ant-color-success)', fontSize: 13 }} />
        )}
        <Typography.Text style={{
          fontSize: 12, flex: 1,
          color: isError ? 'var(--ant-color-error)' : 'var(--ant-color-success)',
        }}>
          {isError ? '执行失败' : hasContent ? truncate(content, 60) : '执行成功'}
        </Typography.Text>
        {hasContent && lineCount > 1 && (
          <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0, marginRight: 4 }}>
            {lineCount} 行
          </Typography.Text>
        )}
        {hasContent && (
          <span style={{ color: 'var(--ant-color-text-quaternary)', fontSize: 10, flexShrink: 0 }}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
      </div>
      {expanded && hasContent && (
        <div style={{
          padding: '10px 14px', fontSize: 12, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 400, overflow: 'auto',
          color: 'var(--ant-color-text-secondary)',
          borderTop: `1px solid ${isError ? 'var(--ant-color-error-border)' : 'var(--ant-color-success-border)'}`,
        }}>
          {content}
        </div>
      )}
    </div>
  );
}
