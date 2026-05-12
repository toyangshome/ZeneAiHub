import { useCallback, type FC } from 'react';
import { Button, App } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

interface CodeBlockProps {
  className?: string;
  children: React.ReactNode;
  inline?: boolean;
}

export const CodeBlock: FC<CodeBlockProps> = ({ className, children, inline }) => {
  const language = className?.replace('language-', '') || '';

  // 行内代码：简单渲染，不带复制按钮
  if (inline || (!language && !String(children).includes('\n'))) {
    return (
      <code
        style={{
          background: 'var(--ant-color-fill-tertiary)',
          padding: '1px 4px',
          borderRadius: 6,
          fontSize: '0.9em',
        }}
      >
        {children}
      </code>
    );
  }

  // 代码块
  return <CodeBlockContent language={language} className={className}>{children}</CodeBlockContent>;
};

const CodeBlockContent: FC<{ language: string; className?: string; children: React.ReactNode }> = ({
  language, className, children,
}) => {
  const { message } = App.useApp();
  const code = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      message.success('已复制');
    } catch (err: unknown) {
      const e = err as Error;
      message.error('复制失败: ' + (e?.message || '未知错误'));
    }
  }, [code, message]);

  return (
    <div style={{ position: 'relative' }}>
      {language && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 12px',
            fontSize: 12,
            color: 'var(--ant-color-text-tertiary)',
            borderBottom: '1px solid var(--ant-color-border)',
          }}
        >
          <span>{language}</span>
          <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy}>
            复制
          </Button>
        </div>
      )}
      {!language && (
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopy}
          style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}
        />
      )}
      <pre style={{ margin: 0, padding: 12, overflow: 'auto' }}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};
