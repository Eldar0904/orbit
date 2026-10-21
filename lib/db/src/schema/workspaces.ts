import { pgTable, serial, text, integer, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";

export const workspacesTable = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembershipsTable = pgTable("workspace_memberships", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspacesTable.id),
  clerkSubject: text("clerk_subject").notNull(),
  role: text("role", { enum: ["admin", "editor", "viewer"] }).notNull(),
  canReviewImports: boolean("can_review_imports").notNull().default(false),
}, (t) => [uniqueIndex("workspace_subject_unique").on(t.workspaceId, t.clerkSubject)]);
