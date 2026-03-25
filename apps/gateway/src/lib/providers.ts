import { MODEL_PRICING } from '@neuralgate/shared/constants'

interface ProviderConfig {
  baseUrl: string
  chatPath: string
  authHeader: (key: string) => Record<string, string>
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com',
    chatPath: '/v1/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    chatPath: '/v1/messages',
    authHeader: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    chatPath: '/v1beta/models',
    authHeader: (key) => ({ 'x-goog-api-key': key }),
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai',
    chatPath: '/v1/chat/completions',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
}

export function getProviderConfig(provider: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[provider]
}

export function detectProvider(model: string): string {
  if (model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) return 'openai'
  if (model.startsWith('claude-')) return 'anthropic'
  if (model.startsWith('gemini-')) return 'google'
  if (model.startsWith('mistral-')) return 'mistral'
  return 'openai'
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || { input: 1.0, output: 3.0 }
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
}
