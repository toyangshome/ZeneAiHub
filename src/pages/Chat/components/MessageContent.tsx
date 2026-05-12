import { useState, type FC } from 'react';
import { Typography, Tag, Image } from 'antd';
import {
  FileOutlined, DownOutlined, RightOutlined, PictureOutlined,
  ToolOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import type { Message, ToolCall } from '@shared/types';

interface MessageContentProps {
  content: string;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

function isImageFile(name: string): boolean {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

function getMimeType(name: string): string {
  const ext = '.' + name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * 解析消息中的文件标记，将 --- 文件: name --- ... 格式转为可折叠卡片
 */
export const MessageContent: FC<MessageContentProps> = ({ content }) => {
  const parts = parseFileBlocks(content);

  if (parts.length === 1 && parts[0].type === 'text') {
    return <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Typography.Text>;
  }

  return (
    <div>
      {parts.map((part, i) =>
        part.type === 'file' ? (
          <FileBlock key={i} name={part.name!} content={part.content} />
        ) : (
          part.content && (
            <Typography.Text key={i} style={{ whiteSpace: 'pre-wrap' }}>
              {part.content}
            </Typography.Text>
          )
        ),
      )}
    </div>
  );
};

/** 工具调用结果卡片 */
export const ToolMessageContent: FC<{ message: Message }> = ({ message }) => {
  const toolCalls = message.toolCalls || [];
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} toolCall={tc} />
      ))}
      {toolCalls.length === 0 && (
        <div
          style={{
            border: '1px solid var(--ant-color-border)',
            borderRadius: 10,
            padding: '6px 10px',
            background: 'var(--ant-color-fill-tertiary)',
            fontSize: 12,
          }}
        >
          <ToolOutlined style={{ marginRight: 6, color: 'var(--ant-color-primary)' }} />
          {message.content}
        </div>
      )}
    </div>
  );
};

/** 单个工具调用卡片 */
function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const hasResult = toolCall.result !== undefined;
  const isError = hasResult && toolCall.result?.startsWith('{') && (() => {
    try { return Boolean(JSON.parse(toolCall.result!).error); } catch { return false; }
  })();

  return (
    <div
      style={{
        border: '1px solid var(--ant-color-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => hasResult && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'var(--ant-color-fill-tertiary)',
          cursor: hasResult ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <ToolOutlined style={{ color: 'var(--ant-color-primary)', fontSize: 13 }} />
        <Typography.Text strong style={{ fontSize: 13, flex: 1 }}>
          {toolCall.name}
        </Typography.Text>
        {hasResult ? (
          isError ? (
            <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontSize: 11, marginRight: 0 }}>失败</Tag>
          ) : (
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 11, marginRight: 0 }}>完成</Tag>
          )
        ) : (
          <Tag color="processing" style={{ fontSize: 11, marginRight: 0 }}>执行中...</Tag>
        )}
        {hasResult && (
          expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />
        )}
      </div>
      {expanded && hasResult && (
        <div
          style={{
            padding: '8px 10px',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 300,
            overflow: 'auto',
            color: 'var(--ant-color-text-secondary)',
            borderTop: '1px solid var(--ant-color-border)',
          }}
        >
          {toolCall.result}
        </div>
      )}
    </div>
  );
}

const FileBlock: FC<{ name: string; content: string }> = ({ name, content }) => {
  const [expanded, setExpanded] = useState(false);
  const isImage = isImageFile(name);

  if (isImage) {
    return (
      <div
        style={{
          border: '1px solid var(--ant-color-border)',
          borderRadius: 10,
          marginTop: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            background: 'var(--ant-color-fill-tertiary)',
          }}
        >
          <PictureOutlined style={{ color: 'var(--ant-color-primary)' }} />
          <Typography.Text strong style={{ fontSize: 13 }}>
            {name}
          </Typography.Text>
          <Tag style={{ fontSize: 11, marginRight: 0 }}>图片</Tag>
        </div>
        <div style={{ padding: 8, textAlign: 'center' }}>
          <Image
            src={`data:${getMimeType(name)};base64,${content}`}
            alt={name}
            style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
          />
        </div>
      </div>
    );
  }

  const lines = content.split('\n');
  const preview = lines.slice(0, 3).join('\n');
  const hasMore = lines.length > 3;
  const sizeLabel = formatSize(content.length);

  return (
    <div
      style={{
        border: '1px solid var(--ant-color-border)',
        borderRadius: 10,
        marginTop: 8,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => hasMore && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          background: 'var(--ant-color-fill-tertiary)',
          cursor: hasMore ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <FileOutlined style={{ color: 'var(--ant-color-primary)' }} />
        <Typography.Text strong style={{ fontSize: 13, flex: 1 }}>
          {name}
        </Typography.Text>
        <Tag style={{ fontSize: 11, marginRight: 0 }}>{sizeLabel}</Tag>
        <Tag style={{ fontSize: 11 }}>{lines.length} 行</Tag>
        {hasMore && (
          expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />
        )}
      </div>
      <div
        style={{
          padding: '8px 10px',
          fontFamily: 'monospace',
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: expanded ? 400 : undefined,
          overflow: expanded ? 'auto' : 'hidden',
          color: 'var(--ant-color-text-secondary)',
        }}
      >
        {expanded ? content : preview}
      </div>
    </div>
  );
};

type Part = { type: 'text'; content: string } | { type: 'file'; name: string; content: string };

function parseFileBlocks(content: string): Part[] {
  const regex = /\n--- 文件: (.+?) ---\n/g;
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // 前面的文本
    const textBefore = content.slice(lastIndex, match.index);
    if (textBefore) {
      parts.push({ type: 'text', content: textBefore });
    }

    // 文件内容：从标记结束到下一个标记或结尾
    const fileStart = regex.lastIndex;
    const nextMatch = regex.exec(content);
    const fileEnd = nextMatch ? nextMatch.index : content.length;
    // 回退，让外层循环继续处理下一个标记
    if (nextMatch) regex.lastIndex = nextMatch.index;

    parts.push({
      type: 'file',
      name: match[1],
      content: content.slice(fileStart, fileEnd),
    });
    lastIndex = fileEnd;
  }

  // 剩余文本
  const remaining = content.slice(lastIndex);
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  // 如果完全没匹配到文件标记，返回纯文本
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return parts;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
