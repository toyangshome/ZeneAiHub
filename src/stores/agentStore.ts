import { create } from 'zustand';
import type { AgentMessage } from '@shared/types/agent';
import { api } from '../services/ipcBridge';

interface AgentState {
  cwd: string;
  status: 'idle' | 'running' | 'waiting_input' | 'error';
  model: string | null;

  messages: AgentMessage[];
  error: string | null;

  selectDirectory: () => Promise<void>;
  setCwd: (cwd: string) => void;
  clearMessages: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  cwd: '',
  status: 'idle',
  model: null,
  messages: [],
  error: null,

  selectDirectory: async () => {
    try {
      const dir = await api.agent.selectDirectory();
      if (dir) set({ cwd: dir });
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  },

  setCwd: (cwd) => set({ cwd }),

  clearMessages: () => set({ messages: [], status: 'idle', error: null }),
}));
