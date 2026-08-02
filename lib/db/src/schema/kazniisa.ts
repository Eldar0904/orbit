import {
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  smallint,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Catalogue versions (new PDF editions every 2-3 months) ─────────────────

export const kazniisaVersionsTable = pgTable("kazniisa_versions", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),              // "Прейскурант №2 — 2026.04"
  pdfFilename: text("pdf_filename"),           // "P20R0426.pdf"
  isCurrent: boolean("is_current").notNull().default(false),
  productCount: integer("product_count").notNull().default(0),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Products (the catalogue itself) ────────────────────────────────────────

export const kazniisaProductsTable = pgTable(
  "kazniisa_products",
  {
    id: serial("id").primaryKey(),
    versionId: integer("version_id")
      .notNull()
      .references(() => kazniisaVersionsTable.id, { onDelete: "cascade" }),
    code: text("code").notNull(),                  // "521-101-0401-0059"
    name: text("name").notNull(),                  // "Системный блок Lenovo Neo 50s G4"
    unit: text("unit"),                            // "шт.", "комплект"
    cargoClass: smallint("cargo_class"),           // 1, 2, 3, 4
    weightKg: real("weight_kg"),                   // 10.65
    estimatedPrice: real("estimated_price"),       // Сметная цена (тенге)
    retailPrice: real("retail_price"),             // Отпускная цена (тенге)
    description: text("description"),             // From Section B (detailed specs)
    imageUrl: text("image_url"),                  // Supabase Storage URL
    hasDetail: boolean("has_detail").notNull().default(false),
    sectionCode: text("section_code").notNull(),  // "521-1", "522-1"
    sectionName: text("section_name").notNull(),  // "Дошкольное образование"
    groupCode: text("group_code"),               // "521-101-0400"
    groupName: text("group_name"),               // "Средства обучения технические"
    normalizedText: text("normalized_text"),      // For pg_trgm matching
    isGroupHeader: boolean("is_group_header").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("kazniisa_product_version_code").on(t.versionId, t.code)],
);

// ─── Match sessions (history) ───────────────────────────────────────────────

export const kazniisaMatchSessionsTable = pgTable("kazniisa_match_sessions", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id")
    .notNull()
    .references(() => kazniisaVersionsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),           // "Детсад.xlsx"
  itemCount: integer("item_count").notNull(),
  matchedCount: integer("matched_count").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  noMatchCount: integer("no_match_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Match results (individual item matches) ────────────────────────────────

export const kazniisaMatchResultsTable = pgTable("kazniisa_match_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => kazniisaMatchSessionsTable.id, { onDelete: "cascade" }),
  inputName: text("input_name").notNull(),        // Original item from user's list
  inputCode: text("input_code"),                  // Code from user's list (if any)
  rank: smallint("rank").notNull(),               // 1, 2, or 3
  productId: integer("product_id").references(() => kazniisaProductsTable.id, {
    onDelete: "set null",
  }),
  confidence: real("confidence").notNull(),       // 0.0–1.0
  status: text("status").notNull().default("pending"), // 'matched'|'review'|'no_match'
  userDecision: text("user_decision"),            // 'confirmed'|'rejected'|null
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Type exports ───────────────────────────────────────────────────────────

export type KazniisaVersion = typeof kazniisaVersionsTable.$inferSelect;
export type KazniisaProduct = typeof kazniisaProductsTable.$inferSelect;
export type KazniisaMatchSession = typeof kazniisaMatchSessionsTable.$inferSelect;
export type KazniisaMatchResult = typeof kazniisaMatchResultsTable.$inferSelect;
