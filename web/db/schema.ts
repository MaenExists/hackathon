import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const imports = sqliteTable("imports", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
});
export const tips = sqliteTable("tips", {
  id: text("id").primaryKey(),
  district: text("district").notNull(),
  narrative: text("narrative").notNull(),
  contact: text("contact"),
  createdAt: text("created_at").notNull(),
  duplicateGroup: text("duplicate_group"),
  synthetic: text("synthetic").notNull(),
});
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull(),
  evidenceId: text("evidence_id"),
  actor: text("actor").notNull(),
  createdAt: text("created_at").notNull(),
});
export const briefs = sqliteTable("briefs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  audience: text("audience").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const mapSearchCache = sqliteTable("map_search_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: text("fetched_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const mapSearchLimits = sqliteTable("map_search_limits", {
  key: text("key").primaryKey(),
  nextRequestAt: integer("next_request_at").notNull(),
});
