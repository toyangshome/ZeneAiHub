import { create } from 'zustand';
import type { ModelConfigPublic, ModelConfigInput } from '@shared/types';
import { api } from '../services/ipcBridge';

interface ModelState {
  models: ModelConfigPublic[];
  currentModelId: string;
  loading: boolean;
  loadModels: () => Promise<void>;
  saveModel: (config: ModelConfigInput) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  setCurrentModel: (id: string) => void;
}

export const useModelStore = create<ModelState>((set, get) => ({
  models: [],
  currentModelId: '',
  loading: false,

  loadModels: async () => {
    set({ loading: true });
    try {
      const models = await api.model.list();
      const currentId = await api.store.get<string>('current-model-id', '');
      set({
        models,
        currentModelId: currentId || models[0]?.id || '',
        loading: false,
      });
    } catch (err) {
      console.error('加载模型列表失败:', err);
      set({ loading: false });
    }
  },

  saveModel: async (config) => {
    try {
      await api.model.save(config);
      await get().loadModels();
    } catch (err) {
      console.error('保存模型失败:', err);
      throw err;
    }
  },

  deleteModel: async (id) => {
    try {
      await api.model.delete(id);
      await get().loadModels();
    } catch (err) {
      console.error('删除模型失败:', err);
      throw err;
    }
  },

  setCurrentModel: (id) => {
    set({ currentModelId: id });
    api.store.set('current-model-id', id).catch((err) => {
      console.error('保存当前模型 ID 失败:', err);
    });
  },
}));
