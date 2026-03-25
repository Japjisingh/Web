import { pgTable, text, timestamp, boolean, uuid, varchar, jsonb } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const organisations = pgTable('organisations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  vertical: text('vertical').notNull().default('general'),
  plan: text('plan').notNull().default('free'),
  monthlyBudgetUsd: text('monthly_budget_usd'),
  settings: jsonb('settings').default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verticalConfigs = pgTable('vertical_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  cachingEnabled: boolean('caching_enabled').notNull().default(true),
  similarityThreshold: text('similarity_threshold').notNull().default('0.92'),
  cacheTtlSeconds: text('cache_ttl_seconds').notNull().default('86400'),
  piiDetection: boolean('pii_detection').notNull().default(false),
  piiAction: text('pii_action').notNull().default('detect'),
  smartRouting: boolean('smart_routing').notNull().default(false),
  simpleModel: text('simple_model'),
  complexModel: text('complex_model'),
  complexityThreshold: text('complexity_threshold').notNull().default('0.5'),
  compressionEnabled: boolean('compression_enabled').notNull().default(false),
  systemPromptPrefix: text('system_prompt_prefix'),
  dataRetentionDays: text('data_retention_days').notNull().default('90'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const organisationRelations = relations(organisations, ({ many, one }) => ({
  apiKeys: many(apiKeys),
  verticalConfig: one(verticalConfigs, {
    fields: [organisations.id],
    references: [verticalConfigs.organisationId],
  }),
}))

// Forward reference - will be defined in api-keys.ts
import { apiKeys } from './api-keys'
