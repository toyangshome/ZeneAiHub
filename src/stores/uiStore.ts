import { create } from 'zustand';
import { api } from '../services/ipcBridge';

interface UIState {
  siderCollapsed: boolean;
  toggleSider: () => void;

  userAvatar: string;
  assistantAvatar: string;
  loadAvatars: () => Promise<void>;
  setUserAvatar: (avatar: string) => void;
  setAssistantAvatar: (avatar: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  siderCollapsed: false,
  toggleSider: () => set((s) => ({ siderCollapsed: !s.siderCollapsed })),

  userAvatar: 'user',
  assistantAvatar: 'robot',

  loadAvatars: async () => {
    try {
      const [user, assistant] = await Promise.all([
        api.store.get<string>('user-avatar', 'user'),
        api.store.get<string>('assistant-avatar', 'robot'),
      ]);
      set({ userAvatar: user, assistantAvatar: assistant });
    } catch (err) {
      console.error('加载头像设置失败:', err);
    }
  },

  setUserAvatar: (avatar) => {
    set({ userAvatar: avatar });
    api.store.set('user-avatar', avatar).catch(console.error);
  },

  setAssistantAvatar: (avatar) => {
    set({ assistantAvatar: avatar });
    api.store.set('assistant-avatar', avatar).catch(console.error);
  },
}));
