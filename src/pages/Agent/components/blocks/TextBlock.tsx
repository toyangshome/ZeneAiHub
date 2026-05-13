import { MarkdownRenderer } from '../../../Chat/components/MarkdownRenderer';

export function TextBlock({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7 }}>
      <MarkdownRenderer content={text} />
    </div>
  );
}
