import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const experiments = pgTable('experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  variantA: jsonb('variant_a').notNull(),
  variantB: jsonb('variant_b').notNull(),
  metric: text('metric').notNull(),
  status: text('status').notNull().default('running'),
  trafficSplit: text('traffic_split').notNull().default('50'),
  results: jsonb('results').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
