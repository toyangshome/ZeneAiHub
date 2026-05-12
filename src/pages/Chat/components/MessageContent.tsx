import { useState, type FC } from 'react';
import { Typography, Tag, Image } from 'antd';
import { FileOutlined, DownOutlined, RightOutlined, PictureOutlined } from '@ant-design/icons';

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
