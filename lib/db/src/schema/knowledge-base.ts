import {
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const catalogSourceKindEnum = ["government", "supplier", "internal"] as const;

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  notes: text("notes"),
  sourceType: text("source_type").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const catalogSourcesTable = pgTable("catalog_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  kind: text("kind").notNull().default("supplier"),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  isArchived: boolean("is_archived").notNull().default(false),
  productCount: integer("product_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const catalogVersionsTable = pgTable(
  "catalog_versions",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => catalogSourcesTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("catalog_version_source_label").on(t.sourceId, t.label)],
);

export const catalogProductsTable = pgTable("catalog_products", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id")
    .notNull()
    .references(() => catalogSourcesTable.id, { onDelete: "cascade" }),
  versionId: integer("version_id").references(() => catalogVersionsTable.id, { onDelete: "set null" }),
  code: text("code"),
  name: text("name").notNull(),
  brand: text("brand"),
  model: text("model"),
  description: text("description"),
  technicalSpecs: text("technical_specs"),
  unit: text("unit"),
  price: real("price"),
  categoryCode: text("category_code"),
  categoryName: text("category_name"),
  normalizedText: text("normalized_text"),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const specListsTable = pgTable("spec_lists", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull().default("Spec list"),
  itemCount: integer("item_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const specItemsTable = pgTable("spec_items", {
  id: serial("id").primaryKey(),
  specListId: integer("spec_list_id")
    .notNull()
    .references(() => specListsTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  itemCode: text("item_code"),
  itemName: text("item_name").notNull(),
  description: text("description"),
  quantity: real("quantity"),
  categoryCode: text("category_code"),
  categoryName: text("category_name"),
  normalizedText: text("normalized_text"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectCatalogLinksTable = pgTable(
  "project_catalog_links",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => catalogSourcesTable.id, { onDelete: "cascade" }),
    includeInMatching: boolean("include_in_matching").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("project_catalog_link_unique").on(t.projectId, t.sourceId)],
);

export const matchRunsTable = pgTable("match_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  engineName: text("engine_name").notNull().default("jaccard_v1"),
  params: jsonb("params").$type<Record<string, unknown>>(),
  itemsProcessed: integer("items_processed").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const matchResultsTable = pgTable("match_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => matchRunsTable.id, { onDelete: "cascade" }),
  specItemId: integer("spec_item_id")
    .notNull()
    .references(() => specItemsTable.id, { onDelete: "cascade" }),
  catalogProductId: integer("catalog_product_id").references(() => catalogProductsTable.id, {
    onDelete: "set null",
  }),
  rank: integer("rank").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  explanation: text("explanation"),
  isSelected: boolean("is_selected").notNull().default(false),
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  matchedName: text("matched_name"),
  matchedPrice: real("matched_price"),
  matchedUnit: text("matched_unit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchFeedbackTable = pgTable("match_feedback", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  runId: integer("run_id")
    .notNull()
    .references(() => matchRunsTable.id, { onDelete: "cascade" }),
  specItemId: integer("spec_item_id")
    .notNull()
    .references(() => specItemsTable.id, { onDelete: "cascade" }),
  matchResultId: integer("match_result_id").references(() => matchResultsTable.id, {
    onDelete: "set null",
  }),
  catalogProductId: integer("catalog_product_id").references(() => catalogProductsTable.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commercialOffersTable = pgTable("commercial_offers", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  marginPercent: real("margin_percent").notNull().default(0),
  lineCount: integer("line_count").notNull().default(0),
  totalAmount: real("total_amount"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commercialOfferLinesTable = pgTable("commercial_offer_lines", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id")
    .notNull()
    .references(() => commercialOffersTable.id, { onDelete: "cascade" }),
  specItemId: integer("spec_item_id").references(() => specItemsTable.id, { onDelete: "set null" }),
  catalogProductId: integer("catalog_product_id").references(() => catalogProductsTable.id, {
    onDelete: "set null",
  }),
  lineNumber: integer("line_number").notNull(),
  itemName: text("item_name").notNull(),
  matchedName: text("matched_name"),
  quantity: real("quantity"),
  unit: text("unit"),
  unitPrice: real("unit_price"),
  lineTotal: real("line_total"),
});

export type Supplier = typeof suppliersTable.$inferSelect;
export type CatalogSource = typeof catalogSourcesTable.$inferSelect;
export type CatalogProduct = typeof catalogProductsTable.$inferSelect;
export type SpecItem = typeof specItemsTable.$inferSelect;
export type MatchResultRow = typeof matchResultsTable.$inferSelect;
