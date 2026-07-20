import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectCatalogsTable = pgTable("project_catalogs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projectsTable.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  filename: text("filename").notNull(),
  itemCount: integer("item_count").notNull().default(0),
  items: jsonb("items").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectCatalog = typeof projectCatalogsTable.$inferSelect;
export type NewProjectCatalog = typeof projectCatalogsTable.$inferInsert;
