import { theme } from 'antd';
import { MarkdownRenderer } from '../../../Chat/components/MarkdownRenderer';

export function TextBlock({ text }: { text: string }) {
  const { token } = theme.useToken();
  return (
    <div>
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>
        <MarkdownRenderer content={text} />
      </div>
      <span style={{
        fontSize: 11, color: token.colorTextQuaternary, marginTop: 4, display: 'inline-block',
        fontWeight: 500, letterSpacing: 0.3,
      }}>
        reply
      </span>
    </div>
  );
}
