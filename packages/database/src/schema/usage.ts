import { pgTable, text, timestamp, uuid, integer, numeric, date } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const usageSnapshots = pgTable('usage_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  totalRequests: integer('total_requests').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  totalCostUsd: numeric('total_cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
  cachedRequests: integer('cached_requests').notNull().default(0),
  savedCostUsd: numeric('saved_cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
  avgLatencyMs: integer('avg_latency_ms'),
  errorCount: integer('error_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
