import type Database from 'better-sqlite3';
import { getDatabase } from '../Database';

export interface PromptTemplateRow {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  variables: string;
  tags: string;
  is_favorite: number;
  usage_count: number;
  is_built_in: number;
  created_at: number;
  updated_at: number;
}

export class PromptRepo {
  private get db(): Database.Database {
    return getDatabase();
  }

  list(options?: { category?: string; search?: string; favorite?: boolean }) {
    let sql = 'SELECT * FROM prompt_templates WHERE 1=1';
    const params: string[] = [];

    if (options?.category) {
      sql += ' AND category = ?';
      params.push(options.category);
    }
    if (options?.search) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR content LIKE ?)';
      const q = `%${options.search}%`;
      params.push(q, q, q);
    }
    if (options?.favorite) {
      sql += ' AND is_favorite = 1';
    }

    sql += ' ORDER BY usage_count DESC, updated_at DESC';
    return (this.db.prepare(sql).all(...params) as PromptTemplateRow[]).map(this.fromRow);
  }

  get(id: string) {
    const row = this.db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(id) as PromptTemplateRow | undefined;
    return row ? this.fromRow(row) : null;
  }

  save(t: {
    id: string; name?: string; description?: string; category?: string;
    content?: string; variables?: unknown[]; tags?: string[]; isFavorite?: boolean;
    isBuiltIn?: boolean; createdAt?: number; updatedAt?: number;
  }) {
    const now = Date.now();
    const existing = this.db.prepare('SELECT * FROM prompt_templates WHERE id = ?').get(t.id) as PromptTemplateRow | undefined;
    if (existing) {
      // 部分更新：仅更新提供的字段
      const sets: string[] = [];
      const params: (string | number)[] = [];
      if (t.name !== undefined) { sets.push('name=?'); params.push(t.name); }
      if (t.description !== undefined) { sets.push('description=?'); params.push(t.description); }
      if (t.category !== undefined) { sets.push('category=?'); params.push(t.category); }
      if (t.content !== undefined) { sets.push('content=?'); params.push(t.content); }
      if (t.variables !== undefined) { sets.push('variables=?'); params.push(JSON.stringify(t.variables)); }
      if (t.tags !== undefined) { sets.push('tags=?'); params.push(JSON.stringify(t.tags)); }
      if (t.isFavorite !== undefined) { sets.push('is_favorite=?'); params.push(t.isFavorite ? 1 : 0); }
      if (t.isBuiltIn !== undefined) { sets.push('is_built_in=?'); params.push(t.isBuiltIn ? 1 : 0); }
      sets.push('updated_at=?');
      params.push(now, t.id);
      this.db.prepare(`UPDATE prompt_templates SET ${sets.join(', ')} WHERE id=?`).run(...params);
    } else {
      this.db.prepare(`
        INSERT INTO prompt_templates (id, name, description, category, content, variables,
        tags, is_favorite, usage_count, is_built_in, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        t.id, t.name, t.description || '', t.category, t.content,
        JSON.stringify(t.variables || []), JSON.stringify(t.tags || []),
        t.isFavorite ? 1 : 0, 0, t.isBuiltIn ? 1 : 0,
        t.createdAt || now, t.updatedAt || now,
      );
    }
  }

  delete(id: string) {
    const row = this.db.prepare('SELECT is_built_in FROM prompt_templates WHERE id = ?').get(id) as { is_built_in: number } | undefined;
    if (row?.is_built_in) throw new Error('内置模板不可删除');
    this.db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(id);
  }

  incrementUsage(id: string) {
    this.db.prepare('UPDATE prompt_templates SET usage_count = usage_count + 1 WHERE id = ?').run(id);
  }

  getCategories(): string[] {
    const rows = this.db.prepare('SELECT DISTINCT category FROM prompt_templates ORDER BY category').all() as { category: string }[];
    return rows.map((r) => r.category);
  }

  private fromRow(row: PromptTemplateRow) {
    return {
      id: row.id, name: row.name, description: row.description,
      category: row.category, content: row.content,
      variables: JSON.parse(row.variables || '[]'),
      tags: JSON.parse(row.tags || '[]'),
      isFavorite: !!row.is_favorite, usageCount: row.usage_count,
      isBuiltIn: !!row.is_built_in,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }
}
