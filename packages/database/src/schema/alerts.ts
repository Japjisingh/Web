import { pgTable, text, timestamp, uuid, boolean, jsonb } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  condition: jsonb('condition').notNull(),
  channels: text('channels').array().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastTriggeredAt: timestamp('last_triggered_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const alertHistory = pgTable('alert_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id').notNull().references(() => alerts.id, { onDelete: 'cascade' }),
  triggeredValue: text('triggered_value'),
  message: text('message').notNull(),
  acknowledged: boolean('acknowledged').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
