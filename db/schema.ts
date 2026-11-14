import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const consumed = sqliteTable('consumed', {
  hash: text('hash').primaryKey(),
  result: integer('result').notNull(),
  at: text('at').notNull(),
  type: integer('type').notNull().default(0),
  diceJson: text('dice_json').notNull().default('[]'),
  outcomeJson: text('outcome_json').notNull().default('{}'),
});

// Future batches can live entirely in D1. The original 185 labels continue to
// resolve through the compiled registry, so the migration never contains secrets.
export const potionCodes = sqliteTable('potion_codes', {
  hash: text('hash').primaryKey(),
  publicId: text('public_id').notNull().unique(),
  potionType: text('potion_type').notNull(),
  batchId: text('batch_id'),
  createdAt: text('created_at').notNull(),
  disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
});
