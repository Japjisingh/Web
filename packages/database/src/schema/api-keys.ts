import { pgTable, text, timestamp, boolean, uuid, varchar, integer } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { organisations } from './organisations'

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
  vertical: text('vertical'),
  rateLimitPerMinute: integer('rate_limit_per_minute').default(60),
  monthlyBudgetCap: text('monthly_budget_cap'),
  allowedProviders: text('allowed_providers').array(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const apiKeyRelations = relations(apiKeys, ({ one }) => ({
  organisation: one(organisations, {
    fields: [apiKeys.organisationId],
    references: [organisations.id],
  }),
}))
