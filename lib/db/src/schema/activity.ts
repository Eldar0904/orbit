import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  type: text("type", {
    enum: ["task_created", "task_updated", "task_completed", "project_created", "project_updated"],
  }).notNull(),
  title: text("title").notNull(),
  entityType: text("entity_type", { enum: ["task", "project"] }).notNull(),
  entityId: integer("entity_id").notNull(),
  projectName: text("project_name"),
  assigneeName: text("assignee_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Activity = typeof activityTable.$inferSelect;
