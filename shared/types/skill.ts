/** Skill 参数定义 */
export interface SkillParam {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required: boolean;
  defaultValue?: string | number | boolean;
}

/** Skill 技能 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  systemPrompt: string;
  parameters: SkillParam[];
  modelId?: string;
  mcpTools: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
