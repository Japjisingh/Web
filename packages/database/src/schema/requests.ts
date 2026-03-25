import { pgTable, text, timestamp, uuid, integer, numeric, jsonb, index, boolean } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const aiRequests = pgTable('ai_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  apiKeyId: uuid('api_key_id'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  endpoint: text('endpoint'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 12, scale: 8 }).notNull().default('0'),
  latencyMs: integer('latency_ms'),
  statusCode: integer('status_code'),
  cached: boolean('cached').notNull().default(false),
  cacheKey: text('cache_key'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_requests_org_created').on(table.organisationId, table.createdAt),
  index('idx_requests_model').on(table.model),
  index('idx_requests_cached').on(table.cached),
])

export const requestLogs = pgTable('request_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  requestId: uuid('request_id').notNull().references(() => aiRequests.id, { onDelete: 'cascade' }),
  requestHeaders: jsonb('request_headers'),
  requestBody: text('request_body'),
  responseHeaders: jsonb('response_headers'),
  responseBody: text('response_body'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
