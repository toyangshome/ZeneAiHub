/** Prompt 模板变量定义 */
export interface VariableDef {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  defaultValue?: string;
  options?: string[];
  required: boolean;
  placeholder?: string;
}

/** Prompt 模板 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: VariableDef[];
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}
