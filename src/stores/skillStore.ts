import { create } from 'zustand';
import type { Skill } from '@shared/types';
import { api } from '../services/ipcBridge';
import { useChatStore } from './chatStore';
import { useModelStore } from './modelStore';

interface SkillState {
  skills: Skill[];
  categories: string[];
  loading: boolean;
  loadSkills: (options?: { category?: string; search?: string }) => Promise<void>;
  loadCategories: () => Promise<void>;
  saveSkill: (data: Partial<Skill>) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  executeSkill: (skillId: string, params: Record<string, string | number | boolean>) => Promise<string>;
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  categories: [],
  loading: false,

  loadSkills: async (options) => {
    set({ loading: true });
    try {
      const skills = await api.skill.list(options);
      set({ skills, loading: false });
    } catch (err) {
      console.error('加载 Skill 失败:', err);
      set({ loading: false });
    }
  },

  loadCategories: async () => {
    try {
      const skills = await api.skill.list();
      const cats = [...new Set(skills.map((s) => s.category))].sort();
      set({ categories: cats });
    } catch (err) {
      console.error('加载 Skill 分类失败:', err);
    }
  },

  saveSkill: async (data) => {
    try {
      await api.skill.save(data);
      await get().loadSkills();
      await get().loadCategories();
    } catch (err) {
      console.error('保存 Skill 失败:', err);
      throw err;
    }
  },

  deleteSkill: async (id) => {
    try {
      await api.skill.delete(id);
      await get().loadSkills();
    } catch (err) {
      console.error('删除 Skill 失败:', err);
      throw err;
    }
  },

  executeSkill: async (skillId, params) => {
    const { skills } = get();
    const skill = skills.find((s) => s.id === skillId);
    if (!skill) throw new Error('Skill 不存在');

    // 插值 systemPrompt 中的参数
    const interpolatedSystemPrompt = skill.systemPrompt.replace(
      /\{\{(\w+)\}\}/g,
      (match, name) => {
        const v = params[name];
        return v !== undefined ? String(v) : match;
      },
    );

    // 确定使用的模型
    const modelId = skill.modelId || useModelStore.getState().currentModelId;
    if (!modelId) throw new Error('未选择模型，请先在设置中配置模型');

    // 构造参数摘要作为用户消息（让对话有上下文）
    const paramEntries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
    const paramSummary = paramEntries.length > 0
      ? `[执行 Skill: ${skill.name}]\n${paramEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : `[执行 Skill: ${skill.name}]`;

    // 调用对话系统
    const chatStore = useChatStore.getState();
    await chatStore.sendMessage(paramSummary, modelId, interpolatedSystemPrompt);

    return interpolatedSystemPrompt;
  },
}));
