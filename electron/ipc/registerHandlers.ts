import { registerAIHandlers } from './aiHandlers';
import { registerModelHandlers } from './modelHandlers';
import { registerStoreHandlers } from './storeHandlers';
import { registerFileHandlers } from './fileHandlers';
import { registerDBHandlers } from './dbHandlers';
import { registerPromptHandlers } from './promptHandlers';
import { registerSkillHandlers } from './skillHandlers';
import { registerMCPHandlers } from './mcpHandlers';
import { registerAgentHandlers } from './agentHandlers';

export function registerAllHandlers(): void {
  registerStoreHandlers();
  registerAIHandlers();
  registerModelHandlers();
  registerFileHandlers();
  registerDBHandlers();
  registerPromptHandlers();
  registerSkillHandlers();
  registerMCPHandlers();
  registerAgentHandlers();
}
