export const PROVIDERS = {
  openai: { name: 'OpenAI', color: '#10a37f' },
  anthropic: { name: 'Anthropic', color: '#d4a574' },
  google: { name: 'Google', color: '#4285f4' },
  mistral: { name: 'Mistral', color: '#ff7000' },
} as const

export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'mistral-large': { input: 2.00, output: 6.00 },
  'mistral-small': { input: 0.20, output: 0.60 },
}

export const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#5b5ef4',
  'gpt-4o-mini': '#3b82f6',
  'gpt-4-turbo': '#8b5cf6',
  'claude-opus-4-20250514': '#f59e0b',
  'claude-sonnet-4-20250514': '#f97316',
  'claude-haiku-4-5-20251001': '#fb923c',
  'gemini-2.0-flash': '#06b6d4',
  'gemini-2.5-pro': '#0891b2',
  'mistral-large': '#ff7000',
  'mistral-small': '#ff9940',
}

export const PLAN_LIMITS = {
  free: { tokens: 100_000, apiKeys: 1, retention: 7 },
  starter: { tokens: 10_000_000, apiKeys: 5, retention: 90 },
  growth: { tokens: 100_000_000, apiKeys: -1, retention: 365 },
  enterprise: { tokens: -1, apiKeys: -1, retention: -1 },
} as const

export const VERTICALS = [
  { id: 'ecommerce', name: 'Ecommerce', icon: 'shopping-cart', emoji: '🛒' },
  { id: 'hr', name: 'HR & Recruitment', icon: 'users', emoji: '👥' },
  { id: 'healthtech', name: 'HealthTech', icon: 'heart-pulse', emoji: '🏥' },
  { id: 'legaltech', name: 'LegalTech', icon: 'scale', emoji: '⚖️' },
  { id: 'fintech', name: 'FinTech', icon: 'landmark', emoji: '🏦' },
  { id: 'edtech', name: 'EdTech', icon: 'graduation-cap', emoji: '🎓' },
  { id: 'proptech', name: 'PropTech', icon: 'building', emoji: '🏗️' },
  { id: 'general', name: 'General', icon: 'settings', emoji: '⚙️' },
] as const
