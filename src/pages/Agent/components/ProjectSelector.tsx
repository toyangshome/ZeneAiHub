import { theme, Tooltip } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';

export function ProjectSelector() {
  const { token } = theme.useToken();
  const cwd = useAgentStore((s) => s.cwd);
  const selectDirectory = useAgentStore((s) => s.selectDirectory);
  const status = useAgentStore((s) => s.status);
  const isRunning = status === 'running';

  return (
    <Tooltip title={cwd || '选择项目目录'}>
      <button
        onClick={selectDirectory}
        disabled={isRunning}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', border: 'none', borderRadius: 10,
          background: 'transparent', cursor: isRunning ? 'not-allowed' : 'pointer',
          fontSize: 13, fontWeight: 500, color: token.colorText,
          lineHeight: 1.4, transition: 'background 0.15s', outline: 'none',
          fontFamily: 'inherit', opacity: isRunning ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isRunning) (e.currentTarget as HTMLElement).style.background = token.colorFillSecondary;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <FolderOpenOutlined style={{ fontSize: 14, color: token.colorTextTertiary }} />
        <span style={{
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {cwd ? cwd.split(/[/\\]/).pop() : '选择项目'}
        </span>
      </button>
    </Tooltip>
  );
}
