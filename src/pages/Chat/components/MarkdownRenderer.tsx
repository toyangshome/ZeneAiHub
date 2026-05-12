import { memo, useState, useEffect, useRef, type FC } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { DownOutlined, RightOutlined, BulbOutlined } from '@ant-design/icons';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

/** 区分行内代码和代码块，传给 CodeBlock 的 inline 属性 */
const codeComponent: Components['code'] = ({ className, children, ...rest }) => {
  const isInline = !className?.startsWith('language-');
  return <CodeBlock className={className} inline={isInline}>{children}</CodeBlock>;
};

const markdownComponents: Components = {
  code: codeComponent,
  pre: ({ children }) => <div>{children}</div>,
};

export const MarkdownRenderer: FC<MarkdownRendererProps> = memo(({ content }) => {
  const parts = parseThinkingBlocks(content);
  // 有未闭合的 THINKING 标签说明正在思考中（流式输出）
  const isThinking = /\[THINKING\]/.test(content) && !/\[\/THINKING\]/.test(content);

  if (parts.length === 1 && parts[0].type === 'text') {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    );
  }

  return (
    <div>
      {parts.map((part, i) =>
        part.type === 'thinking' ? (
          <ThinkingBlock key={i} content={part.content} streaming={isThinking} />
        ) : (
          part.content && (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {part.content}
            </ReactMarkdown>
          )
        ),
      )}
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

const ThinkingBlock: FC<{ content: string; streaming?: boolean }> = ({ content, streaming }) => {
  const [expanded, setExpanded] = useState(streaming || false);
  const [dots, setDots] = useState('');
  const autoExpandedRef = useRef(false);

  // 动态点点点动画
  useEffect(() => {
    if (!streaming) {
      setDots('');
      return;
    }
    const timer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(timer);
  }, [streaming]);

  // 思考中时自动展开（仅首次）
  useEffect(() => {
    if (streaming && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      setExpanded(true);
    }
  }, [streaming]);

  return (
    <div
      style={{
        border: '1px solid var(--ant-color-border)',
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'var(--ant-color-fill-tertiary)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <BulbOutlined style={{ color: 'var(--ant-color-warning)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
          {streaming ? `思考中${dots}` : '思考过程'}
        </span>
        {expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
      </div>
      {expanded && (
        <div
          style={{
            padding: '8px 10px',
            fontSize: 13,
            lineHeight: 1.7,
            maxHeight: 400,
            overflow: 'auto',
            color: 'var(--ant-color-text-quaternary)',
            background: 'var(--ant-color-fill-secondary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
          {streaming && (
            <span style={styles.thinkingCursor}>▊</span>
          )}
        </div>
      )}
    </div>
  );
};

type Part = { type: 'thinking'; content: string } | { type: 'text'; content: string };

function parseThinkingBlocks(content: string): Part[] {
  const regex = /\[THINKING\]([\s\S]*?)\[\/THINKING\]/g;
  const parts: Part[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const textBefore = content.slice(lastIndex, match.index);
    if (textBefore) {
      parts.push({ type: 'text', content: textBefore });
    }
    parts.push({ type: 'thinking', content: match[1] });
    lastIndex = regex.lastIndex;
  }

  const remaining = content.slice(lastIndex);
  if (remaining) {
    parts.push({ type: 'text', content: remaining });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  // 合并相邻的 thinking 块（流式输出会产生多个 chunk）
  const merged: Part[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (part.type === 'thinking' && prev?.type === 'thinking') {
      prev.content += part.content;
    } else if (part.type === 'text' && part.content.trim() === '' && prev?.type === 'thinking') {
      // thinking 之间的空白文本，跳过，让下一个 thinking 合并进来
      continue;
    } else {
      merged.push(part);
    }
  }

  return merged;
}

const styles: Record<string, React.CSSProperties> = {
  thinkingCursor: {
    display: 'inline-block',
    animation: 'blink 1s step-end infinite',
    color: 'var(--ant-color-text-quaternary)',
    marginLeft: 2,
  },
};
