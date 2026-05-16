import { useState, useMemo } from 'react';
import { theme, Typography } from 'antd';
import {
  DownOutlined, RightOutlined, FileOutlined,
  PlusOutlined, MinusOutlined,
} from '@ant-design/icons';
import { diffLines, type Change } from 'diff';

interface DiffBlockProps {
  filePath: string;
  oldContent: string;
  newContent: string;
}

/** 从文件路径推断语言 */
function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    css: 'css', scss: 'scss', less: 'less',
    html: 'html', xml: 'xml', svg: 'xml',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', dockerfile: 'dockerfile',
  };
  return map[ext] || '';
}

/** 文件名截断 */
function shortName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts.length > 3 ? '…/' + parts.slice(-2).join('/') : path;
}

export function DiffBlock({ filePath, oldContent, newContent }: DiffBlockProps) {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(true);

  const { changes, added, removed } = useMemo(() => {
    const result = diffLines(oldContent, newContent);
    let a = 0, r = 0;
    for (const c of result) {
      const count = c.value.split('\n').length - 1;
      if (c.added) a += count;
      if (c.removed) r += count;
    }
    return { changes: result, added: a, removed: r };
  }, [oldContent, newContent]);

  const rows = useMemo(() => buildRows(changes), [changes]);

  return (
    <div style={{
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: 10,
      overflow: 'hidden',
      fontSize: 12,
    }}>
      {/* 标题栏 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          background: token.colorBgTextHover,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        {expanded
          ? <DownOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
          : <RightOutlined style={{ fontSize: 10, color: token.colorTextQuaternary }} />
        }
        <FileOutlined style={{ fontSize: 13, color: token.colorPrimary }} />
        <Typography.Text style={{ fontSize: 12, fontWeight: 500 }} ellipsis>
          {shortName(filePath)}
        </Typography.Text>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {added > 0 && (
            <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
              <PlusOutlined style={{ fontSize: 9 }} /> {added}
            </span>
          )}
          {removed > 0 && (
            <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
              <MinusOutlined style={{ fontSize: 9 }} /> {removed}
            </span>
          )}
        </span>
      </div>

      {/* Diff 内容 */}
      {expanded && (
        <div style={{
          fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
          fontSize: 12, lineHeight: '20px',
          maxHeight: 400, overflow: 'auto',
          background: token.colorBgContainer,
        }}>
          {rows.map((row, i) => (
            <DiffRow key={i} row={row} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Diff 行构建 ==========

interface DiffRowData {
  type: 'context' | 'add' | 'remove' | 'separator';
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

function buildRows(changes: Change[]): DiffRowData[] {
  const rows: DiffRowData[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (let ci = 0; ci < changes.length; ci++) {
    const change = changes[ci];
    const lines = change.value.split('\n');
    // split('\n') 末尾会多一个空串
    if (lines[lines.length - 1] === '') lines.pop();

    if (change.added) {
      for (const line of lines) {
        rows.push({ type: 'add', oldLine: null, newLine: newLine++, content: line });
      }
    } else if (change.removed) {
      for (const line of lines) {
        rows.push({ type: 'remove', oldLine: oldLine++, newLine: null, content: line });
      }
    } else {
      // 上下文行 — 只保留前后各 3 行
      if (lines.length > 6 && ci > 0 && ci < changes.length - 1) {
        // 前 3 行
        for (let j = 0; j < 3; j++) {
          rows.push({ type: 'context', oldLine: oldLine++, newLine: newLine++, content: lines[j] });
        }
        // 分隔符
        rows.push({ type: 'separator', oldLine: null, newLine: null, content: '' });
        // 跳过中间行
        oldLine += lines.length - 6;
        newLine += lines.length - 6;
        // 后 3 行
        for (let j = lines.length - 3; j < lines.length; j++) {
          rows.push({ type: 'context', oldLine: oldLine++, newLine: newLine++, content: lines[j] });
        }
      } else {
        for (const line of lines) {
          rows.push({ type: 'context', oldLine: oldLine++, newLine: newLine++, content: line });
        }
      }
    }
  }

  return rows;
}

// ========== Diff 行渲染 ==========

function DiffRow({ row, token }: { row: DiffRowData; token: ReturnType<typeof theme.useToken>['token'] }) {
  if (row.type === 'separator') {
    return (
      <div style={{
        padding: '2px 12px',
        background: token.colorBgTextHover,
        color: token.colorTextQuaternary,
        textAlign: 'center',
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        userSelect: 'none',
      }}>
        ──
      </div>
    );
  }

  const bg = row.type === 'add'
    ? 'rgba(34, 197, 94, 0.08)'
    : row.type === 'remove'
      ? 'rgba(239, 68, 68, 0.08)'
      : 'transparent';
  const prefix = row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' ';
  const prefixColor = row.type === 'add'
    ? '#22c55e'
    : row.type === 'remove'
      ? '#ef4444'
      : token.colorTextQuaternary;

  return (
    <div style={{
      display: 'flex',
      background: bg,
      borderBottom: `1px solid ${token.colorBorderSecondary}22`,
    }}>
      {/* 行号 */}
      <span style={{
        width: 40, textAlign: 'right', paddingRight: 8,
        color: token.colorTextQuaternary, userSelect: 'none',
        flexShrink: 0, borderRight: `1px solid ${token.colorBorderSecondary}44`,
      }}>
        {row.oldLine ?? ''}
      </span>
      <span style={{
        width: 40, textAlign: 'right', paddingRight: 8,
        color: token.colorTextQuaternary, userSelect: 'none',
        flexShrink: 0, borderRight: `1px solid ${token.colorBorderSecondary}44`,
      }}>
        {row.newLine ?? ''}
      </span>
      {/* 前缀 + 内容 */}
      <span style={{
        width: 20, textAlign: 'center', color: prefixColor,
        fontWeight: 600, flexShrink: 0, userSelect: 'none',
      }}>
        {prefix}
      </span>
      <span style={{
        flex: 1, paddingLeft: 4, whiteSpace: 'pre',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {row.content}
      </span>
    </div>
  );
}
