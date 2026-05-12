/** MCP Server 配置 */
export interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  autoReconnect: boolean;
  reconnectInterval?: number;
  timeout?: number;
  createdAt?: number;
  updatedAt?: number;
}

/** MCP 工具 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

/** MCP 工具调用结果 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError: boolean;
}
