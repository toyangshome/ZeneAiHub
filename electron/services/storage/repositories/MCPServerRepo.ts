import type Database from 'better-sqlite3';
import { getDatabase } from '../Database';
import type { MCPServerConfig } from '@shared/types';

interface MCPServerRow {
  id: string;
  name: string;
  transport: string;
  command: string | null;
  args: string;
  cwd: string | null;
  env: string;
  url: string | null;
  headers: string;
  enabled: number;
  auto_reconnect: number;
  reconnect_interval: number;
  timeout: number;
  created_at: number;
  updated_at: number;
}

export class MCPServerRepo {
  private get db(): Database.Database {
    return getDatabase();
  }

  list() {
    return (this.db.prepare('SELECT * FROM mcp_servers ORDER BY updated_at DESC').all() as MCPServerRow[])
      .map(this.fromRow);
  }

  get(id: string) {
    const row = this.db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as MCPServerRow | undefined;
    return row ? this.fromRow(row) : null;
  }

  save(config: MCPServerConfig) {
    const now = Date.now();
    const existing = this.db.prepare('SELECT id FROM mcp_servers WHERE id = ?').get(config.id) as { id: string } | undefined;
    if (existing) {
      this.db.prepare(`
        UPDATE mcp_servers SET name=?, transport=?, command=?, args=?, cwd=?,
        env=?, url=?, headers=?, enabled=?, auto_reconnect=?, reconnect_interval=?,
        timeout=?, updated_at=? WHERE id=?
      `).run(
        config.name, config.transport, config.command || null,
        JSON.stringify(config.args || []), config.cwd || null,
        JSON.stringify(config.env || {}), config.url || null,
        JSON.stringify(config.headers || {}),
        config.enabled ? 1 : 0, config.autoReconnect ? 1 : 0,
        config.reconnectInterval || 30, config.timeout || 60000,
        now, config.id,
      );
    } else {
      this.db.prepare(`
        INSERT INTO mcp_servers (id, name, transport, command, args, cwd,
        env, url, headers, enabled, auto_reconnect, reconnect_interval,
        timeout, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        config.id, config.name, config.transport, config.command || null,
        JSON.stringify(config.args || []), config.cwd || null,
        JSON.stringify(config.env || {}), config.url || null,
        JSON.stringify(config.headers || {}),
        config.enabled ? 1 : 0, config.autoReconnect ? 1 : 0,
        config.reconnectInterval || 30, config.timeout || 60000,
        config.createdAt || now, config.updatedAt || now,
      );
    }
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
  }

  private fromRow(row: MCPServerRow): MCPServerConfig {
    return {
      id: row.id,
      name: row.name,
      transport: row.transport as 'stdio' | 'sse',
      command: row.command || undefined,
      args: JSON.parse(row.args || '[]'),
      cwd: row.cwd || undefined,
      env: JSON.parse(row.env || '{}'),
      url: row.url || undefined,
      headers: JSON.parse(row.headers || '{}'),
      enabled: !!row.enabled,
      autoReconnect: !!row.auto_reconnect,
      reconnectInterval: row.reconnect_interval,
      timeout: row.timeout,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
