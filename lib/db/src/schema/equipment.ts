import { pgTable, serial, integer, text, timestamp, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { workspacesTable } from "./workspaces";

export const projectMembershipsTable = pgTable("project_memberships", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  clerkSubject: text("clerk_subject").notNull(),
  role: text("role", { enum: ["editor", "viewer"] }).notNull(),
}, t => [uniqueIndex("project_subject_unique").on(t.projectId, t.clerkSubject)]);

export const equipmentSitesTable = pgTable("equipment_sites", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  region: text("region"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("equipment_site_code_unique").on(t.projectId, t.code)]);

export const equipmentRoomsTable = pgTable("equipment_rooms", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull().references(() => equipmentSitesTable.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  numberText: text("number_text"),
  areaM2: numeric("area_m2", { precision: 12, scale: 2 }),
  technical: jsonb("technical").$type<Record<string, string | null>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("equipment_room_code_unique").on(t.siteId, t.code)]);

export const equipmentImportsTable = pgTable("equipment_imports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  sourceBookId: text("source_book_id").notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  contentHash: text("content_hash").notNull(),
  mappingVersion: text("mapping_version").notNull().default("dk-discovery-v1"),
  status: text("status").notNull().default("staged"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("equipment_import_content_unique").on(t.projectId, t.contentHash, t.mappingVersion)]);

export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
