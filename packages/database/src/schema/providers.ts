import { pgTable, text, timestamp, boolean, uuid, jsonb } from 'drizzle-orm/pg-core'
import { organisations } from './organisations'

export const providerCredentials = pgTable('provider_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  encryptedApiKey: text('encrypted_api_key').notNull(),
  models: text('models').array(),
  isActive: boolean('is_active').notNull().default(true),
  lastTestedAt: timestamp('last_tested_at'),
  testStatus: text('test_status'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
