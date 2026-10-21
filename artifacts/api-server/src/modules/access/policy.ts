export type AccessRole = "admin" | "editor" | "viewer";
export interface AccessScope {
  workspaceId: number;
  subject: string;
  role: AccessRole;
  projectIds: number[];
  writableProjectIds: number[];
  canReviewImports: boolean;
}
export function canAccessProject(scope: AccessScope, projectId: number, write = false): boolean {
  return (write ? scope.writableProjectIds : scope.projectIds).includes(projectId);
}
export function parseId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n <= 2147483647 ? n : null;
}
