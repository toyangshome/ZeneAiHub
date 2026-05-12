import type Database from 'better-sqlite3';
import { getDatabase } from '../Database';

interface SkillRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  system_prompt: string;
  parameters: string;
  model_id: string | null;
  mcp_tools: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

const BUILT_IN_SKILLS = [
  {
    id: 'builtin-code-review',
    name: '代码审查',
    icon: '🔍',
    category: 'coding',
    description: '审查代码质量、安全性和最佳实践，提供改进建议',
    systemPrompt: '你是一位资深代码审查专家。请对以下代码进行全面审查，包括：\n1. 代码质量和可读性\n2. 潜在的 bug 和安全隐患\n3. 性能优化建议\n4. 最佳实践建议\n\n请用结构化的方式组织你的审查意见，对每个问题给出具体的修改建议。\n\n代码：\n{{code}}',
    parameters: [
      { name: 'code', label: '源代码', type: 'string', description: '需要审查的代码', required: true },
    ],
  },
  {
    id: 'builtin-code-refactor',
    name: '代码重构',
    icon: '🔧',
    category: 'coding',
    description: '分析代码并提供重构方案，提升可维护性',
    systemPrompt: '你是一位代码重构专家。请分析以下代码并提供重构建议：\n1. 识别代码异味（code smells）\n2. 提出具体的重构方案\n3. 给出重构后的代码示例\n4. 说明重构的好处\n\n语言：{{language}}\n\n代码：\n{{code}}',
    parameters: [
      { name: 'code', label: '源代码', type: 'string', description: '需要重构的代码', required: true },
      { name: 'language', label: '编程语言', type: 'string', description: '如 TypeScript、Python 等', required: false },
    ],
  },
  {
    id: 'builtin-gen-tests',
    name: '生成单元测试',
    icon: '✅',
    category: 'coding',
    description: '为给定代码生成全面的单元测试',
    systemPrompt: '你是一位测试工程师。请为以下代码生成全面的单元测试：\n1. 覆盖所有公开方法和边界条件\n2. 包含正常流程和异常流程测试\n3. 使用 {{framework}} 框架\n4. 测试命名清晰，注释充分\n\n代码：\n{{code}}',
    parameters: [
      { name: 'code', label: '源代码', type: 'string', description: '需要生成测试的代码', required: true },
      { name: 'framework', label: '测试框架', type: 'string', description: '如 Jest、Vitest、pytest 等', required: false },
    ],
  },
  {
    id: 'builtin-polish-writing',
    name: '文章润色',
    icon: '✍️',
    category: 'writing',
    description: '改善文章的语言表达、逻辑流畅度和可读性',
    systemPrompt: '你是一位专业的文字编辑。请对以下文字进行润色：\n1. 改善语言表达的准确性和流畅度\n2. 优化句子结构和段落逻辑\n3. 修正语法和用词错误\n4. 保持原文的核心意思和风格\n\n请直接给出润色后的文字，并在关键修改处简要说明修改原因。\n\n原文：\n{{text}}',
    parameters: [
      { name: 'text', label: '待润色文本', type: 'string', description: '需要润色的文字内容', required: true },
    ],
  },
  {
    id: 'builtin-translate',
    name: '中英翻译',
    icon: '🌐',
    category: 'writing',
    description: '中英文互译，保持专业性和自然表达',
    systemPrompt: '你是一位专业的翻译专家。请将以下文字翻译为 {{target_lang}}：\n\n翻译要求：\n1. 准确传达原文含义\n2. 符合目标语言的表达习惯\n3. 专业术语翻译准确\n4. 保持原文的语气和风格\n\n原文：\n{{text}}',
    parameters: [
      { name: 'text', label: '待翻译文本', type: 'string', description: '需要翻译的文字', required: true },
      { name: 'target_lang', label: '目标语言', type: 'string', description: '如：英文、中文', required: false },
    ],
  },
  {
    id: 'builtin-data-analysis',
    name: '数据分析',
    icon: '📊',
    category: 'analysis',
    description: '分析数据并提取关键洞察和趋势',
    systemPrompt: '你是一位数据分析师。请对以下数据进行深入分析：\n1. 数据概览和基本统计特征\n2. 关键趋势和模式识别\n3. 异常数据点分析\n4. 可行的建议和下一步行动\n\n请用清晰的结构呈现分析结果。\n\n数据：\n{{data}}',
    parameters: [
      { name: 'data', label: '数据', type: 'string', description: '需要分析的数据（文本格式）', required: true },
    ],
  },
  {
    id: 'builtin-requirement-breakdown',
    name: '需求拆解',
    icon: '🧩',
    category: 'analysis',
    description: '将复杂需求拆分为可执行的任务清单',
    systemPrompt: '你是一位产品经理和技术负责人。请将以下需求拆解为可执行的任务：\n1. 明确需求的核心目标\n2. 拆解为具体的子任务\n3. 评估每个任务的优先级和复杂度\n4. 识别任务间的依赖关系\n5. 估算整体工作量\n\n请用结构化的方式输出任务清单。\n\n需求：\n{{requirement}}',
    parameters: [
      { name: 'requirement', label: '需求描述', type: 'string', description: '需要拆解的需求', required: true },
    ],
  },
  {
    id: 'builtin-explain-concept',
    name: '概念解释',
    icon: '💡',
    category: 'general',
    description: '用简单易懂的语言解释复杂概念',
    systemPrompt: '你是一位善于讲解的老师。请用简单易懂的语言解释以下概念：\n\n目标受众：{{audience}}\n\n解释要求：\n1. 先给出简洁的定义\n2. 用类比或日常例子帮助理解\n3. 解释核心原理和关键要点\n4. 如有必要，提供进一步学习的建议\n\n概念：\n{{topic}}',
    parameters: [
      { name: 'topic', label: '概念/主题', type: 'string', description: '需要解释的概念', required: true },
      { name: 'audience', label: '目标受众', type: 'string', description: '如：初学者、中级开发者', required: false },
    ],
  },
];

export class SkillRepo {
  private get db(): Database.Database {
    return getDatabase();
  }

  list(options?: { category?: string; search?: string }) {
    let sql = 'SELECT * FROM skills WHERE 1=1';
    const params: unknown[] = [];
    if (options?.category) { sql += ' AND category = ?'; params.push(options.category); }
    if (options?.search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${options.search}%`, `%${options.search}%`); }
    sql += ' ORDER BY updated_at DESC';
    return (this.db.prepare(sql).all(...params) as SkillRow[]).map(this.fromRow);
  }

  get(id: string) {
    const row = this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined;
    return row ? this.fromRow(row) : null;
  }

  save(s: {
    id: string; name?: string; description?: string; icon?: string;
    category?: string; systemPrompt?: string; parameters?: unknown[];
    modelId?: string | null; mcpTools?: string[]; enabled?: boolean;
    createdAt?: number; updatedAt?: number;
  }) {
    const now = Date.now();
    const existing = this.db.prepare('SELECT id FROM skills WHERE id = ?').get(s.id) as { id: string } | undefined;
    if (existing) {
      this.db.prepare(`
        UPDATE skills SET name=?, description=?, icon=?, category=?, system_prompt=?,
        parameters=?, model_id=?, mcp_tools=?, enabled=?, updated_at=? WHERE id=?
      `).run(
        s.name, s.description || '', s.icon || '', s.category || 'general',
        s.systemPrompt, JSON.stringify(s.parameters || []),
        s.modelId || null, JSON.stringify(s.mcpTools || []),
        s.enabled !== false ? 1 : 0, now, s.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO skills (id, name, description, icon, category, system_prompt,
        parameters, model_id, mcp_tools, enabled, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        s.id, s.name, s.description || '', s.icon || '', s.category || 'general',
        s.systemPrompt, JSON.stringify(s.parameters || []),
        s.modelId || null, JSON.stringify(s.mcpTools || []),
        s.enabled !== false ? 1 : 0, s.createdAt || now, s.updatedAt || now,
      );
    }
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  }

  seedBuiltInSkills() {
    const now = Date.now();
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO skills (id, name, description, icon, category, system_prompt,
      parameters, model_id, mcp_tools, enabled, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const insertMany = this.db.transaction((skills: typeof BUILT_IN_SKILLS) => {
      for (const s of skills) {
        insert.run(
          s.id, s.name, s.description, s.icon, s.category, s.systemPrompt,
          JSON.stringify(s.parameters), null, JSON.stringify([]), 1, now, now,
        );
      }
    });

    insertMany(BUILT_IN_SKILLS);
  }

  private fromRow(row: SkillRow) {
    return {
      id: row.id, name: row.name, description: row.description,
      icon: row.icon, category: row.category,
      systemPrompt: row.system_prompt,
      parameters: JSON.parse(row.parameters || '[]'),
      modelId: row.model_id,
      mcpTools: JSON.parse(row.mcp_tools || '[]'),
      enabled: !!row.enabled,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }
}
