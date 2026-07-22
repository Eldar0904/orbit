import { useState, useRef, useCallback } from "react";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import {
  useGetProjectCatalog,
  useUploadProjectCatalog,
  useDeleteProjectCatalog,
  useMatchProjectItems,
  getGetProjectCatalogQueryKey,
  type CatalogItem,
  type MatchResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  Download,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSpreadsheet(buffer: ArrayBuffer): { rows: string[]; error?: string } {
  try {
    const wb = xlsxRead(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: "" });
    const rows: string[] = [];
    for (const row of raw) {
      const first = String(row[0] ?? "").trim();
      if (first) rows.push(first);
    }
    return { rows };
  } catch {
    return { rows: [], error: "Could not parse file. Use CSV or Excel (.xlsx, .xls)." };
  }
}

function parseCatalogSpreadsheet(buffer: ArrayBuffer): {
  items: CatalogItem[];
  error?: string;
} {
  try {
    const wb = xlsxRead(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, unknown>[] = xlsxUtils.sheet_to_json(ws, { defval: "" });
    if (raw.length === 0) {
      // Fall back to headerless — treat first column as name
      const rows: unknown[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: "" });
      const items: CatalogItem[] = rows
        .map((r) => String(r[0] ?? "").trim())
        .filter(Boolean)
        .map((name) => ({ name }));
      return { items };
    }

    // Try to find columns by common header names
    const headers = Object.keys(raw[0]);
    const findCol = (...candidates: string[]) =>
      headers.find((h) =>
        candidates.some((c) => h.toLowerCase().includes(c.toLowerCase()))
      ) ?? null;

    const nameCol = findCol("name", "наименование", "название", "товар", "позиция", "item", "description", "описание") ?? headers[0];
    const codeCol = findCol("code", "код", "артикул", "art");
    const unitCol = findCol("unit", "ед", "единица", "uom");
    const priceCol = findCol("price", "цена", "стоимость", "cost");

    const items = raw
      .map((row): CatalogItem | null => {
        const name = String(row[nameCol] ?? "").trim();
        if (!name) return null;
        return {
          name,
          code: codeCol ? String(row[codeCol] ?? "").trim() || null : null,
          unit: unitCol ? String(row[unitCol] ?? "").trim() || null : null,
          price: priceCol ? parseFloat(String(row[priceCol] ?? "")) || null : null,
        };
      })
      .filter((x): x is CatalogItem => x !== null);

    return { items };
  } catch {
    return { items: [], error: "Could not parse file. Use CSV or Excel (.xlsx, .xls)." };
  }
}

function downloadCsv(results: MatchResult[], filename: string) {
  const header = ["#", "Spec Item", "Best Match", "Score %", "Status", "Unit", "Price"];
  const rows = results.map((r, i) => [
    i + 1,
    `"${r.input.replace(/"/g, '""')}"`,
    r.matched ? `"${r.matched.replace(/"/g, '""')}"` : "",
    r.score,
    r.status,
    r.catalogItem?.unit ?? "",
    r.catalogItem?.price ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function MatchBadge({ status }: { status: MatchResult["status"] }) {
  if (status === "matched")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Matched
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 gap-1">
        <AlertCircle className="w-3 h-3" /> Partial
      </Badge>
    );
  return (
    <Badge className="bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50 gap-1">
      <CircleDashed className="w-3 h-3" /> No match
    </Badge>
  );
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  label,
  accept,
  onFile,
  compact = false,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-lg transition-colors cursor-pointer select-none
        ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}
        ${compact ? "p-4" : "p-8"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
      <div className={`flex flex-col items-center text-center gap-2 ${compact ? "" : "gap-3"}`}>
        <Upload className={`text-muted-foreground/50 ${compact ? "w-5 h-5" : "w-8 h-8"}`} />
        <span className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>{label}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProcurementTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Catalog state
  const {
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useGetProjectCatalog(projectId, {
    query: { retry: false, queryKey: getGetProjectCatalogQueryKey(projectId) },
  });

  const uploadCatalog = useUploadProjectCatalog();
  const deleteCatalog = useDeleteProjectCatalog();
  const matchItems = useMatchProjectItems();

  // Spec / results state
  const [specText, setSpecText] = useState("");
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  const invalidateCatalog = () =>
    queryClient.invalidateQueries({ queryKey: getGetProjectCatalogQueryKey(projectId) });

  // ── Catalog upload ──────────────────────────────────────────────────────────

  const handleCatalogFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const { items, error } = parseCatalogSpreadsheet(buffer);
    if (error || items.length === 0) {
      toast({ variant: "destructive", title: error ?? "No items found in file" });
      return;
    }
    uploadCatalog.mutate(
      { id: projectId, data: { filename: file.name, items } },
      {
        onSuccess: () => {
          toast({ title: `Catalog loaded — ${items.length} items` });
          invalidateCatalog();
          setResults(null);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to save catalog" }),
      }
    );
  };

  const handleDeleteCatalog = () => {
    if (!confirm("Remove the catalog for this project?")) return;
    deleteCatalog.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          toast({ title: "Catalog removed" });
          invalidateCatalog();
          setResults(null);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to remove catalog" }),
      }
    );
  };

  // ── Spec file upload ────────────────────────────────────────────────────────

  const handleSpecFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const { rows, error } = parseSpreadsheet(buffer);
    if (error || rows.length === 0) {
      toast({ variant: "destructive", title: error ?? "No items found in file" });
      return;
    }
    setSpecText(rows.join("\n"));
    toast({ title: `${rows.length} items loaded from ${file.name}` });
  };

  // ── Match ───────────────────────────────────────────────────────────────────

  const handleMatch = () => {
    const items = specText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (items.length === 0) {
      toast({ variant: "destructive", title: "Enter at least one item to match" });
      return;
    }

    setIsMatching(true);
    matchItems.mutate(
      { id: projectId, data: { items } },
      {
        onSuccess: (data) => {
          setResults(data.results);
          setIsMatching(false);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Matching failed — upload a catalog first" });
          setIsMatching(false);
        },
      }
    );
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = results
    ? {
        matched: results.filter((r) => r.status === "matched").length,
        partial: results.filter((r) => r.status === "partial").length,
        unmatched: results.filter((r) => r.status === "unmatched").length,
      }
    : null;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Step 1: Catalog ── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">
              Step 1 — Catalog
            </h3>
            {catalog && (
              <span className="text-xs text-muted-foreground font-mono">
                {catalog.itemCount} items
              </span>
            )}
          </div>

          {isCatalogLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : catalog ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800 truncate">{catalog.filename}</p>
                <p className="text-xs text-emerald-600">
                  {catalog.itemCount} items · uploaded{" "}
                  {new Date(catalog.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCatalogFile(f); e.target.value = ""; }}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Replace
                    </span>
                  </Button>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteCatalog}
                  disabled={deleteCatalog.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <DropZone
                label="Drop a CSV or Excel file with your product catalog. First column = item name."
                accept=".csv,.xlsx,.xls"
                onFile={handleCatalogFile}
              />
              {uploadCatalog.isPending && (
                <p className="text-xs text-muted-foreground mt-2 text-center">Uploading…</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Spec items ── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground mb-4">
            Step 2 — Spec Items
          </h3>

          <Textarea
            placeholder={"Paste items one per line, e.g.:\nSchool desks 2-seat × 120\nClassroom chairs × 240\nInteractive whiteboard 75\" × 15"}
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={6}
            className="font-mono text-sm resize-y mb-3"
          />

          <div className="flex items-center justify-between gap-3">
            <DropZone
              label="or upload CSV / Excel"
              accept=".csv,.xlsx,.xls"
              onFile={handleSpecFile}
              compact
            />
            <Button
              onClick={handleMatch}
              disabled={isMatching || !catalog || !specText.trim()}
              className="shrink-0"
            >
              {isMatching ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Matching…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Match
                </>
              )}
            </Button>
          </div>
          {!catalog && (
            <p className="text-xs text-muted-foreground mt-2">
              ↑ Upload a catalog in Step 1 before running.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Step 3: Results ── */}
      {results && stats && (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-5 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">
                Results
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-emerald-600 font-semibold">{stats.matched} matched</span>
                <span className="text-amber-600">{stats.partial} partial</span>
                <span className="text-slate-400">{stats.unmatched} unmatched</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(results, `match-results-project-${projectId}.csv`)
              }
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2 w-8 font-mono">#</th>
                  <th className="px-4 py-2">Spec Item</th>
                  <th className="px-4 py-2">Best Match</th>
                  <th className="px-4 py-2 w-20 text-center">Score</th>
                  <th className="px-4 py-2 w-28">Status</th>
                  <th className="px-4 py-2 w-16 text-right">Unit</th>
                  <th className="px-4 py-2 w-24 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium max-w-xs">
                      <span className="line-clamp-2">{r.input}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-xs">
                      {r.matched ? (
                        <span className="line-clamp-2">{r.matched}</span>
                      ) : (
                        <span className="text-slate-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-mono font-semibold text-xs ${
                          r.status === "matched"
                            ? "text-emerald-600"
                            : r.status === "partial"
                            ? "text-amber-600"
                            : "text-slate-400"
                        }`}
                      >
                        {r.score}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MatchBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                      {r.catalogItem?.unit ?? ""}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground font-mono">
                      {r.catalogItem?.price != null
                        ? r.catalogItem.price.toLocaleString()
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
