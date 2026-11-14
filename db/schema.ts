// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const consumed = sqliteTable('consumed', { hash: text('hash').primaryKey(), result: integer('result').notNull(), at: text('at').notNull() });
