/** IPC 通道名常量 */
export const IPC = {
  // 系统
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',
  SYSTEM_GET_INFO: 'system:get-info',
  SYSTEM_GET_PATH: 'system:get-path',

  // 窗口
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  // 存储
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',

  // AI
  AI_STREAM_START: 'ai:stream:start',
  AI_STREAM_CANCEL: 'ai:stream:cancel',

  // 模型
  MODEL_LIST: 'model:list',
  MODEL_SAVE: 'model:save',
  MODEL_DELETE: 'model:delete',
  MODEL_TEST: 'model:test',

  // 数据库 - 对话
  DB_CONVERSATION_LIST: 'db:conversation:list',
  DB_CONVERSATION_GET: 'db:conversation:get',
  DB_CONVERSATION_SAVE: 'db:conversation:save',
  DB_CONVERSATION_DELETE: 'db:conversation:delete',
  DB_CONVERSATION_UPDATE_TITLE: 'db:conversation:update-title',

  // 数据库 - 消息
  DB_MESSAGE_LIST: 'db:message:list',
  DB_MESSAGE_SAVE: 'db:message:save',

  // 文件
  FILE_SELECT_DIALOG: 'file:select-dialog',
  FILE_EXPORT: 'file:export',
  FILE_READ: 'file:read',
  FILE_INFO: 'file:info',

  // Prompt
  PROMPT_LIST: 'prompt:list',
  PROMPT_GET: 'prompt:get',
  PROMPT_SAVE: 'prompt:save',
  PROMPT_DELETE: 'prompt:delete',
  PROMPT_INCREMENT: 'prompt:increment',
  PROMPT_CATEGORIES: 'prompt:categories',
  PROMPT_INTERPOLATE: 'prompt:interpolate',

  // Skill
  SKILL_LIST: 'skill:list',
  SKILL_GET: 'skill:get',
  SKILL_SAVE: 'skill:save',
  SKILL_DELETE: 'skill:delete',

  // MCP
  MCP_SERVER_LIST: 'mcp:server:list',
  MCP_SERVER_SAVE: 'mcp:server:save',
  MCP_SERVER_DELETE: 'mcp:server:delete',
  MCP_SERVER_CONNECT: 'mcp:server:connect',
  MCP_SERVER_DISCONNECT: 'mcp:server:disconnect',
  MCP_TOOL_LIST: 'mcp:tool:list',
  MCP_TOOL_CALL: 'mcp:tool:call',
  MCP_STATUS: 'mcp:status',

  // Agent
  AGENT_CHECK_CLI: 'agent:check-cli',
  AGENT_GET_CLI_VERSION: 'agent:get-cli-version',
  AGENT_SELECT_DIRECTORY: 'agent:select-directory',
  AGENT_SESSION_CREATE: 'agent:session:create',
  AGENT_SESSION_SEND: 'agent:session:send',
  AGENT_SESSION_STOP: 'agent:session:stop',
  AGENT_SESSION_PERMISSION: 'agent:session:permission',
} as const;
