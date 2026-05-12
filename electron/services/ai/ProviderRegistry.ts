import type { ProviderType } from '@shared/types';
import { BaseProvider } from './providers/BaseProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ClaudeProvider } from './providers/ClaudeProvider';

const providers = new Map<ProviderType, BaseProvider>();

providers.set('openai', new OpenAIProvider());
providers.set('anthropic', new ClaudeProvider());
// Ollama / LM Studio / Custom 都兼容 OpenAI API
providers.set('ollama', new OpenAIProvider());
providers.set('lmstudio', new OpenAIProvider());
providers.set('custom', new OpenAIProvider());

export function getProvider(type: ProviderType): BaseProvider {
  const provider = providers.get(type);
  if (!provider) {
    throw new Error(`Unknown provider: ${type}`);
  }
  return provider;
}
