import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API = "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Supplier {
  id: number;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  notes: string | null;
  sourceType: string;
}

export interface CatalogSource {
  id: number;
  name: string;
  description: string | null;
  kind: string;
  supplierId: number | null;
  isEnabled: boolean;
  productCount: number;
}

export interface CatalogProduct {
  id: number;
  sourceId: number;
  code: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  unit: string | null;
  price: number | null;
}

export interface SpecItem {
  id: number;
  itemCode: string | null;
  itemName: string;
  description: string | null;
  quantity: number | null;
}

export interface MatchResultRow {
  id: number;
  specItemId: number;
  catalogProductId: number | null;
  rank: number;
  confidenceScore: number;
  explanation: string | null;
  isSelected: boolean;
  reviewStatus: string;
  reviewNote: string | null;
  matchedName: string | null;
  matchedPrice: number | null;
  matchedUnit: string | null;
}

export interface CatalogLink {
  id: number;
  sourceId: number;
  sourceName: string;
  sourceKind: string;
  productCount: number;
  includeInMatching: boolean;
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["kb", "suppliers"],
    queryFn: () => apiFetch<Supplier[]>("/kb/suppliers"),
  });
}

export function useCatalogSources() {
  return useQuery({
    queryKey: ["kb", "sources"],
    queryFn: () => apiFetch<CatalogSource[]>("/kb/sources"),
  });
}

export function useCreateCatalogSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind?: string; description?: string }) =>
      apiFetch<CatalogSource>("/kb/sources", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb", "sources"] }),
  });
}

export function useImportCatalog(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { name: string; code?: string | null; unit?: string | null; price?: number | null }[]) =>
      apiFetch<{ imported: number }>(`/kb/sources/${sourceId}/import`, {
        method: "POST",
        body: JSON.stringify({ items, mode: "upsert" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb", "sources"] });
      qc.invalidateQueries({ queryKey: ["kb", "products", sourceId] });
    },
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; website?: string; notes?: string }) =>
      apiFetch<Supplier>("/kb/suppliers", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb", "suppliers"] }),
  });
}

export function useProjectSpecItems(projectId: number) {
  return useQuery({
    queryKey: ["project", projectId, "spec-items"],
    queryFn: () =>
      apiFetch<{ list: { itemCount: number } | null; items: SpecItem[] }>(
        `/projects/${projectId}/spec-items`,
      ),
  });
}

export function useSaveSpecItems(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      lines?: string[];
      items?: { itemName: string; quantity?: number }[];
      rows?: Record<string, unknown>[];
    }) =>
      apiFetch(`/projects/${projectId}/spec-items`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId, "spec-items"] }),
  });
}

export function useProjectCatalogLinks(projectId: number) {
  return useQuery({
    queryKey: ["project", projectId, "catalog-links"],
    queryFn: () => apiFetch<CatalogLink[]>(`/projects/${projectId}/catalog-links`),
  });
}

export function useSaveCatalogLinks(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceIds: number[]) =>
      apiFetch(`/projects/${projectId}/catalog-links`, {
        method: "PUT",
        body: JSON.stringify({ sourceIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId, "catalog-links"] }),
  });
}

export function useRunMatch(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/projects/${projectId}/match-run`, { method: "POST", body: "{}" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId, "match-results"] }),
  });
}

export function useMatchResults(projectId: number) {
  return useQuery({
    queryKey: ["project", projectId, "match-results"],
    queryFn: () =>
      apiFetch<{
        run: { id: number } | null;
        results: MatchResultRow[];
        specItems: SpecItem[];
      }>(`/projects/${projectId}/match-results`),
  });
}

export function useSelectMatch(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resultId: number) =>
      apiFetch(`/projects/${projectId}/match-results/select`, {
        method: "PATCH",
        body: JSON.stringify({ resultId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId, "match-results"] }),
  });
}

export function useReviewMatch(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { resultId: number; action: "confirm" | "reject"; note?: string }) =>
      apiFetch(`/projects/${projectId}/match-results/review`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "match-results"] });
      qc.invalidateQueries({ queryKey: ["project", projectId, "match-feedback"] });
    },
  });
}

export function useExportOffer(projectId: number) {
  return useMutation({
    mutationFn: (marginPercent: number) =>
      apiFetch<{
        csv: string;
        filename: string;
        lines: {
          lineNumber: number;
          itemName: string;
          matchedName: string;
          quantity: number | null;
          unit: string;
          unitPrice: number | null;
          lineTotal: number | null;
        }[];
        offer: { id: number; totalAmount: number };
      }>(
        `/projects/${projectId}/commercial-offers/export`,
        { method: "POST", body: JSON.stringify({ marginPercent }) },
      ),
  });
}

export function useSupplierSearch() {
  return useMutation({
    mutationFn: (body: { items: { itemName: string; description?: string }[]; createCatalogSource?: boolean }) =>
      apiFetch<{ hits: { itemName: string; supplierName: string; productName: string; website: string | null; notes: string; source: string }[] }>(
        "/kb/supplier-search",
        { method: "POST", body: JSON.stringify(body) },
      ),
  });
}

export function searchCatalogProducts(q: string, sourceIds?: number[]) {
  const params = new URLSearchParams({ q });
  if (sourceIds?.length) params.set("sourceIds", sourceIds.join(","));
  return apiFetch<CatalogProduct[]>(`/kb/products/search?${params}`);
}

export async function parseExcelToRows(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const { read, utils } = await import("xlsx");
  const wb = read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
}

export async function parseExcelCatalogItems(buffer: ArrayBuffer) {
  const rows = await parseExcelToRows(buffer);
  return apiFetch<{ items: Record<string, unknown>[]; count: number }>("/kb/sources/0/import-parse", {
    method: "POST",
    body: JSON.stringify({ rows }),
  }).catch(async () => {
    const { read, utils } = await import("xlsx");
    const wb = read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const headers = raw.length ? Object.keys(raw[0]) : [];
    const nameKey = headers[0];
    return {
      items: raw
        .map((r) => ({ name: String(r[nameKey] ?? "").trim() }))
        .filter((i) => i.name),
      count: raw.length,
    };
  });
}
