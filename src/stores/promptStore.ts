import { create } from 'zustand';
import type { PromptTemplate } from '@shared/types';
import { api } from '../services/ipcBridge';

interface PromptState {
  prompts: PromptTemplate[];
  categories: string[];
  loading: boolean;
  loadPrompts: (options?: { category?: string; search?: string; favorite?: boolean }) => Promise<void>;
  loadCategories: () => Promise<void>;
  savePrompt: (data: Partial<PromptTemplate>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  usePrompt: (id: string, variables: Record<string, string>) => Promise<string>;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  categories: [],
  loading: false,

  loadPrompts: async (options) => {
    set({ loading: true });
    try {
      const prompts = await api.prompt.list(options);
      set({ prompts, loading: false });
    } catch (err) {
      console.error('加载模板失败:', err);
      set({ loading: false });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await api.prompt.categories();
      set({ categories });
    } catch (err) {
      console.error('加载分类失败:', err);
    }
  },

  savePrompt: async (data) => {
    try {
      await api.prompt.save(data);
      await get().loadPrompts();
      await get().loadCategories();
    } catch (err) {
      console.error('保存模板失败:', err);
      throw err;
    }
  },

  deletePrompt: async (id) => {
    try {
      await api.prompt.delete(id);
      await get().loadPrompts();
    } catch (err) {
      console.error('删除模板失败:', err);
      throw err;
    }
  },

  toggleFavorite: async (id) => {
    const prompt = get().prompts.find((p) => p.id === id);
    if (!prompt) return;
    const newFavorite = !prompt.isFavorite;
    try {
      await api.prompt.save({ id, isFavorite: newFavorite });
      set({
        prompts: get().prompts.map((p) =>
          p.id === id ? { ...p, isFavorite: newFavorite } : p,
        ),
      });
    } catch (err) {
      console.error('切换收藏失败:', err);
      throw err;
    }
  },

  usePrompt: async (id, variables) => {
    const template = await api.prompt.get(id);
    if (!template) throw new Error('模板不存在');
    await api.prompt.increment(id);
    return api.prompt.interpolate(template.content, variables);
  },
}));
