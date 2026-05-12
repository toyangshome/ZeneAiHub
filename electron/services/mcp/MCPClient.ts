import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { MCPServerConfig, MCPTool, MCPToolResult } from '@shared/types';

export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private tools: MCPTool[] = [];
  private status: MCPConnectionStatus = 'disconnected';
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  getStatus(): MCPConnectionStatus {
    return this.status;
  }

  getTools(): MCPTool[] {
    return this.tools;
  }

  async connect(): Promise<MCPTool[]> {
    if (this.status === 'connected') return this.tools;
    this.status = 'connecting';

    try {
      if (this.config.transport === 'stdio') {
        this.transport = new StdioClientTransport({
          command: this.config.command || '',
          args: this.config.args,
          cwd: this.config.cwd,
          env: this.config.env,
        });
      } else {
        this.transport = new SSEClientTransport(
          new URL(this.config.url || ''),
        );
      }

      this.client = new Client(
        { name: 'zeneaihub', version: '1.0.0' },
        { capabilities: {} },
      );

      const timeout = this.config.timeout || 60000;
      await Promise.race([
        this.client.connect(this.transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`连接超时 (${timeout}ms)`)), timeout),
        ),
      ]);

      const result = await this.client.listTools();
      this.tools = result.tools.map((t) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema as Record<string, unknown>,
        serverId: this.config.id,
      }));

      this.status = 'connected';
      return this.tools;
    } catch (err) {
      this.status = 'error';
      await this.cleanup();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
    this.tools = [];
    await this.cleanup();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.client || this.status !== 'connected') {
      throw new Error('MCP Server 未连接');
    }

    const result = await this.client.callTool({ name, arguments: args });
    return {
      content: (result.content as MCPToolResult['content']) || [],
      isError: !!result.isError,
    };
  }

  private async cleanup(): Promise<void> {
    if (this.client) {
      try { await this.client.close(); } catch { /* ignore */ }
      this.client = null;
    }
    this.transport = null;
  }
}
