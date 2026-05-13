import { Button, Tooltip } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';

export function ProjectSelector() {
  const cwd = useAgentStore((s) => s.cwd);
  const selectDirectory = useAgentStore((s) => s.selectDirectory);
  const status = useAgentStore((s) => s.status);
  const isRunning = status === 'running';

  return (
    <Tooltip title={cwd || '选择项目目录'}>
      <Button
        icon={<FolderOpenOutlined />}
        onClick={selectDirectory}
        disabled={isRunning}
        size="small"
      >
        {cwd ? cwd.split(/[/\\]/).pop() : '选择项目'}
      </Button>
    </Tooltip>
  );
}
