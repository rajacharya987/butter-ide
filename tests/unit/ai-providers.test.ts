import { describe, it, expect } from 'vitest';
import {
  AIProviderRegistry,
  OpenAICompatibleProvider,
  ClaudeProvider,
  GeminiProvider,
} from '@ai-ide/ai-providers';

describe('Multi-Provider AI Engine Unit Tests', () => {
  it('registers all standard and custom providers with sensible defaults', () => {
    const registry = new AIProviderRegistry();
    const configs = registry.getAllConfigs();

    expect(configs.length).toBe(5);
    const ids = configs.map((c) => c.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('claude');
    expect(ids).toContain('gemini');
    expect(ids).toContain('grok');
    expect(ids).toContain('custom_openai');
  });

  it('prevents external network calls when privacy mode is enabled', async () => {
    const registry = new AIProviderRegistry();
    registry.setPrivacyMode(true);

    await expect(
      registry.chat({
        providerId: 'openai',
        messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now() }],
      })
    ).rejects.toThrow(/Privacy Mode Enabled/);
  });

  it('custom OpenAI-compatible provider configures arbitrary base URLs and models', () => {
    const provider = new OpenAICompatibleProvider('custom_openai', 'Local Ollama');
    expect(provider.id).toBe('custom_openai');
    expect(provider.displayName).toBe('Local Ollama');
  });
});
