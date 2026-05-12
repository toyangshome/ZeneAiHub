import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { getConfig, setConfig } from '../services/storage/ConfigStore';
import { getSecureStore } from '../services/storage/SecureStore';
import type { ModelConfigPublic, ModelConfigInput, ModelConfig, ProviderType } from '@shared/types';
import { IPC } from '@shared/types/ipc';

export function registerModelHandlers(): void {
  const secureStore = getSecureStore();

  ipcMain.handle(IPC.MODEL_LIST, async (): Promise<ModelConfigPublic[]> => {
    const models = getConfig('models') as ModelConfig[];
    return models.map((m) => ({
      ...m,
      hasApiKey: !!secureStore.get(`apikey:${m.id}`),
      apiKeyMasked: secureStore.getMasked(`apikey:${m.id}`) || undefined,
    }));
  });

  ipcMain.handle(IPC.MODEL_SAVE, async (_event, input: ModelConfigInput) => {
    const models = [...(getConfig('models') as ModelConfig[])];
    const id = input.id || uuidv4();

    // 如果有 API Key，加密存储
    if (input.apiKey) {
      secureStore.set(`apikey:${id}`, input.apiKey);
    }

    const existingIdx = models.findIndex((m) => m.id === id);
    const modelConfig: ModelConfig = {
      id,
      name: input.name,
      provider: input.provider as ProviderType,
      hasApiKey: !!secureStore.get(`apikey:${id}`),
      apiKeyRef: `apikey:${id}`,
      baseUrl: input.baseUrl,
      model: input.model,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
      topP: input.topP,
      frequencyPenalty: input.frequencyPenalty,
      presencePenalty: input.presencePenalty,
      thinking: input.thinking || false,
      enabled: true,
      order: existingIdx >= 0 ? models[existingIdx].order : models.length,
    };

    if (existingIdx >= 0) {
      models[existingIdx] = modelConfig;
    } else {
      models.push(modelConfig);
    }

    setConfig('models', models);
  });

  ipcMain.handle(IPC.MODEL_DELETE, async (_event, id: string) => {
    const models = (getConfig('models') as ModelConfig[]).filter((m) => m.id !== id);
    setConfig('models', models);
    secureStore.delete(`apikey:${id}`);
  });

  ipcMain.handle(IPC.MODEL_TEST, async (_event, input: ModelConfigInput) => {
    const startTime = Date.now();
    try {
      const apiKey = input.apiKey || secureStore.get(`apikey:${input.id || ''}`) || '';
      if (!apiKey) {
        return { success: false, latency: 0, error: 'API Key 未配置' };
      }

      // 根据 provider 选择测试 URL 和 headers
      let testUrl: string;
      let headers: Record<string, string>;

      if (input.provider === 'anthropic') {
        const baseUrl = input.baseUrl || 'https://api.anthropic.com';
        testUrl = `${baseUrl}/v1/messages`;
        headers = {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        };
        // Anthropic 没有简单的 models 列表接口，发送一个最小请求测试连通性
        const response = await fetch(testUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: input.model || 'claude-sonnet-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        return {
          success: response.ok,
          latency: Date.now() - startTime,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        };
      } else {
        // OpenAI 兼容（包括 ollama, lmstudio, custom）
        const baseUrl = input.baseUrl || 'https://api.openai.com/v1';
        testUrl = `${baseUrl}/models`;
        headers = { 'Authorization': `Bearer ${apiKey}` };
        const response = await fetch(testUrl, {
          method: 'GET',
          headers,
        });
        return {
          success: response.ok,
          latency: Date.now() - startTime,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
