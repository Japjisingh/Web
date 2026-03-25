import { pgTable, text, timestamp, uuid, integer, numeric, jsonb } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const promptLibrary = pgTable('prompt_library', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull().default('general'),
  promptTemplate: text('prompt_template').notNull(),
  variables: jsonb('variables').default([]),
  avgTokens: integer('avg_tokens'),
  avgCostUsd: numeric('avg_cost_usd', { precision: 12, scale: 6 }),
  useCount: integer('use_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
