export interface Organisation {
  id: string
  name: string
  slug: string
  vertical: string
  plan: string
  monthlyBudgetUsd: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ApiKey {
  id: string
  organisationId: string
  name: string
  keyPrefix: string
  vertical: string | null
  rateLimitPerMinute: number | null
  monthlyBudgetCap: string | null
  allowedProviders: string[] | null
  expiresAt: Date | null
  lastUsedAt: Date | null
  isActive: boolean
  createdAt: Date
}

export interface ProviderCredential {
  id: string
  organisationId: string
  provider: string
  models: string[] | null
  isActive: boolean
  lastTestedAt: Date | null
  testStatus: string | null
  createdAt: Date
}

export interface AiRequest {
  id: string
  organisationId: string
  apiKeyId: string | null
  provider: string
  model: string
  endpoint: string | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: string
  latencyMs: number | null
  statusCode: number | null
  cached: boolean
  cacheKey: string | null
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface UsageSnapshot {
  id: string
  organisationId: string
  date: string
  provider: string
  model: string
  totalRequests: number
  totalTokens: number
  totalCostUsd: string
  cachedRequests: number
  savedCostUsd: string
  avgLatencyMs: number | null
  errorCount: number
}

export interface OptimisationRecommendation {
  id: string
  organisationId: string
  type: string
  title: string
  description: string
  estimatedSavingUsd: string
  actualSavingUsd: string | null
  priority: string
  status: string
  isApplied: boolean
  appliedAt: Date | null
  createdAt: Date
}

export interface Alert {
  id: string
  organisationId: string
  type: string
  name: string
  condition: Record<string, unknown>
  channels: string[]
  isActive: boolean
  lastTriggeredAt: Date | null
  createdAt: Date
}

export interface AiAgent {
  id: string
  organisationId: string
  name: string
  description: string | null
  vertical: string | null
  systemPrompt: string | null
  modelPreference: string | null
  temperature: string | null
  toolsEnabled: string[] | null
  isActive: boolean
  totalCalls: number
  createdAt: Date
}

export interface PromptTemplate {
  id: string
  organisationId: string
  name: string
  category: string
  promptTemplate: string
  variables: unknown[]
  avgTokens: number | null
  avgCostUsd: string | null
  useCount: number
  createdAt: Date
}

export interface Experiment {
  id: string
  organisationId: string
  name: string
  variantA: Record<string, unknown>
  variantB: Record<string, unknown>
  metric: string
  status: string
  trafficSplit: string
  results: Record<string, unknown>
  createdAt: Date
}

export type Provider = 'openai' | 'anthropic' | 'google' | 'mistral'
export type Plan = 'free' | 'starter' | 'growth' | 'enterprise'
export type Vertical = 'ecommerce' | 'hr' | 'healthtech' | 'legaltech' | 'fintech' | 'edtech' | 'proptech' | 'general'
export type RecommendationType = 'cache' | 'model_downgrade' | 'compression' | 'duplicate' | 'expensive_endpoint'
export type AlertType = 'cost_threshold' | 'error_rate' | 'latency_spike' | 'budget_warning'
export type ExperimentStatus = 'running' | 'complete' | 'paused'

export interface MetricCardData {
  title: string
  value: number | string
  format: 'currency' | 'number' | 'percent'
  change?: number
  changePeriod?: string
  sparklineData?: number[]
  icon?: string
}

export interface DateRange {
  start: Date
  end: Date
  preset?: 'today' | '7d' | '30d' | '90d' | 'custom'
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface LiveActivityEvent {
  id: string
  model: string
  endpoint: string
  tokens: { input: number; output: number }
  cost: string
  latencyMs: number
  cached: boolean
  status: 'success' | 'error'
  timestamp: Date
}
