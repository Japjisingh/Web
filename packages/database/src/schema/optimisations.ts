import { pgTable, text, timestamp, uuid, numeric, boolean } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const optimisationRecommendations = pgTable('optimisation_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  estimatedSavingUsd: numeric('estimated_saving_usd', { precision: 12, scale: 4 }).notNull(),
  actualSavingUsd: numeric('actual_saving_usd', { precision: 12, scale: 4 }),
  priority: text('priority').notNull().default('medium'),
  status: text('status').notNull().default('pending'),
  isApplied: boolean('is_applied').notNull().default(false),
  appliedAt: timestamp('applied_at'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
