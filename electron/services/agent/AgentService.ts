/**
 * Agent 服务 — 管理 Agent 会话生命周期
 * TODO: 重新设计核心架构，不再依赖 Claude Code CLI
 */

class AgentService {
  /** 启动一个 Agent 会话，返回 session ID */
  startSession(): string {
    throw new Error('Agent 核心尚未实现');
  }

  /** 取消当前轮次 */
  cancelCurrentTurn(): void {
    // no-op
  }

  /** 停止会话 */
  stopSession(): void {
    // no-op
  }
}

export const agentService = new AgentService();
