import { relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  numeric,
  date,
  bigint,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Enums
export const directionEnum = pgEnum("direction", ["long", "short"]);

export const statusEnum = pgEnum("status", ["active", "closed", "paused"]);

export const thesisImpactEnum = pgEnum("thesis_impact", [
  "strengthened",
  "weakened",
  "unchanged",
]);

// Holdings
export const holdings = pgTable("holdings", {
  id: uuid().defaultRandom().primaryKey(),
  ticker: varchar({ length: 20 }).notNull(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  direction: directionEnum().notNull(),
  benchmark: varchar({ length: 100 }).notNull().default("S&P 500"),
  status: statusEnum().notNull().default("active"),
  latestImpact: thesisImpactEnum("latest_impact"),
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const holdingsRelations = relations(holdings, ({ many }) => ({
  theses: many(theses),
  weeklyLogs: many(weeklyLogs),
  documents: many(documents),
}));

// Theses
export const theses = pgTable("theses", {
  id: uuid().defaultRandom().primaryKey(),
  holdingId: uuid("holding_id")
    .notNull()
    .references(() => holdings.id, { onDelete: "cascade" }),
  content: text(),
  sources: jsonb(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const thesesRelations = relations(theses, ({ one }) => ({
  holding: one(holdings, {
    fields: [theses.holdingId],
    references: [holdings.id],
  }),
}));

// Weekly Logs
export const weeklyLogs = pgTable(
  "weekly_logs",
  {
    id: uuid().defaultRandom().primaryKey(),
    holdingId: uuid("holding_id")
      .notNull()
      .references(() => holdings.id, { onDelete: "cascade" }),
    weekLabel: varchar("week_label", { length: 20 }),
    weekDate: date("week_date"),
    priceChangePct: numeric("price_change_pct", { precision: 8, scale: 4 }),
    indexChangePct: numeric("index_change_pct", { precision: 8, scale: 4 }),
    relativePerf: numeric("relative_perf", { precision: 8, scale: 4 }),
    thesisImpact: thesisImpactEnum("thesis_impact"),
    summary: text(),
    sources: jsonb(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("weekly_logs_holding_week_uniq").on(
      table.holdingId,
      table.weekLabel,
    ),
  ],
);

export const weeklyLogsRelations = relations(weeklyLogs, ({ one }) => ({
  holding: one(holdings, {
    fields: [weeklyLogs.holdingId],
    references: [holdings.id],
  }),
}));

// Documents
export const documents = pgTable("documents", {
  id: uuid().defaultRandom().primaryKey(),
  holdingId: uuid("holding_id")
    .notNull()
    .references(() => holdings.id, { onDelete: "cascade" }),
  filename: varchar({ length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  fileType: varchar("file_type", { length: 50 }),
  fileSize: bigint("file_size", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  holding: one(holdings, {
    fields: [documents.holdingId],
    references: [holdings.id],
  }),
}));
