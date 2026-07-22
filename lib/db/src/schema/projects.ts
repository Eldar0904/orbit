import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectStageEnum = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;
export const projectKindEnum = ["akr", "ep", "no_plan"] as const;
export const projectStatusEnum = ["active", "archived"] as const;

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: projectStatusEnum }).notNull().default("active"),
  color: text("color").notNull().default("#6366f1"),
  projectType: text("project_type"),
  kind: text("kind", { enum: projectKindEnum }),
  stage: text("stage", { enum: projectStageEnum }).notNull().default("p1"),
  location: text("location"),
  client: text("client"),
  budget: integer("budget"),
  budgetSpent: integer("budget_spent").notNull().default(0),
  startDate: date("start_date"),
  endDate: date("end_date"),
  area: integer("area"),
  rooms: integer("rooms"),
  floors: integer("floors"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
