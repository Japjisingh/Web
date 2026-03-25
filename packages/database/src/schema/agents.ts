import { pgTable, text, timestamp, uuid, integer, numeric, boolean } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const aiAgents = pgTable('ai_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  vertical: text('vertical'),
  systemPrompt: text('system_prompt'),
  modelPreference: text('model_preference'),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
  toolsEnabled: text('tools_enabled').array(),
  isActive: boolean('is_active').notNull().default(true),
  totalCalls: integer('total_calls').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
