import { Layout } from 'antd';
import { useEffect } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { AgentSidebar } from './components/AgentSidebar';
import { AgentMessageList } from './components/AgentMessageList';
import { AgentInput } from './components/AgentInput';

export default function AgentPage() {
  const checkCli = useAgentStore((s) => s.checkCli);
  const getCliVersion = useAgentStore((s) => s.getCliVersion);

  useEffect(() => {
    checkCli();
    getCliVersion();
  }, [checkCli, getCliVersion]);

  return (
    <Layout style={{ height: '100%', width: '100%' }}>
      <Layout.Sider
        width={260}
        theme="light"
        style={{ borderRight: '1px solid var(--ant-color-border)', overflow: 'hidden' }}
      >
        <AgentSidebar />
      </Layout.Sider>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AgentMessageList />
        <AgentInput />
      </div>
    </Layout>
  );
}
