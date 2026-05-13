import { useState } from 'react';
import { Typography, theme } from 'antd';
import { BulbOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';

export function ThinkingBlock({ thinking }: { thinking: string }) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  const preview = thinking.length > 80 ? thinking.slice(0, 80) + '...' : thinking;

  return (
    <div style={{
      border: `1px dashed ${token.colorBorder}`, borderRadius: 12, overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: token.colorBgTextHover, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <BulbOutlined style={{ color: token.colorWarning, fontSize: 14 }} />
        <Typography.Text style={{
          fontSize: 12, color: token.colorTextSecondary, flex: 1,
          fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {expanded ? '思考过程' : preview}
        </Typography.Text>
        <span style={{ color: token.colorTextQuaternary, fontSize: 10, flexShrink: 0 }}>
          {expanded ? <DownOutlined /> : <RightOutlined />}
        </span>
      </div>
      {expanded && (
        <div style={{
          padding: '12px 14px', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap',
          color: token.colorTextSecondary, borderTop: `1px dashed ${token.colorBorder}`,
          maxHeight: 500, overflow: 'auto',
        }}>
          {thinking}
        </div>
      )}
    </div>
  );
}
