import { useRef, useState } from "react";
import { Download, ExternalLink, Play, RefreshCw, Upload, X, Check } from "lucide-react";
import { read, utils, write } from "xlsx";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCatalogSources, useCreateCatalogSource } from "@/lib/kb-api";
import { useQueryClient } from "@tanstack/react-query";

type Result = {
  itemId: number;
  itemName: string;
  rank: number;
  confidenceScore: number;
  explanation: string;
  product: { name: string; code: string | null; price: number | null; unit?: string | null };
};

async function readApiResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return (JSON.parse(text) ?? {}) as Record<string, unknown>;
  } catch {
    throw new Error(`API returned ${response.status} ${response.statusText}. Restart or redeploy the API server.`);
  }
}

export default function ImportMatchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sources } = useCatalogSources();
  const createSource = useCreateCatalogSource();
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [decisions, setDecisions] = useState<Record<number, "confirmed" | "rejected">>({});
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [matchProgress, setMatchProgress] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLInputElement>(null);

  const uploadCatalog = async (file: File) => {
    try {
      const workbook = read(await file.arrayBuffer(), { type: "array" });
      const raw = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const headers = raw.length ? Object.keys(raw[0]) : [];
      const find = (...names: string[]) => headers.find((header) => names.some((name) => header.toLowerCase().includes(name))) ?? headers[0];
      const nameKey = find("name", "item", "product", "description");
      const codeKey = find("code", "sku", "article");
      const priceKey = find("price", "cost");
      const unitKey = find("unit", "uom");
      const items = raw.map((row) => ({ name: String(row[nameKey] ?? "").trim(), code: String(row[codeKey] ?? "").trim() || null, unit: String(row[unitKey] ?? "").trim() || null, price: Number.parseFloat(String(row[priceKey] ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || null })).filter((item) => item.name);
      if (!items.length) throw new Error("No catalogue products found in this file.");
      const sourceName = file.name.replace(/\.[^.]+$/, "");
      const source = sources?.find((candidate) => candidate.name === sourceName)
        ?? await createSource.mutateAsync({ name: sourceName });
      // Keep each request below serverless proxy/body limits for large catalogues.
      // Small batches are intentional: Vercel functions have a hard execution
      // timeout, and Supabase connection latency can vary between invocations.
      const batchSize = 25;
      setImportProgress(0);
      for (let offset = 0; offset < items.length; offset += batchSize) {
        const importResponse = await fetch(`/api/kb/sources/${source.id}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.slice(offset, offset + batchSize),
            mode: offset === 0 ? "replace" : "upsert",
          }),
        });
        const importText = await importResponse.text();
        let importData: Record<string, unknown> = {};
        try { importData = JSON.parse(importText) as Record<string, unknown>; } catch { /* Vercel may return an HTML timeout page. */ }
        if (!importResponse.ok) {
          const detail = typeof importData.error === "string" ? importData.error : `${importResponse.status} ${importResponse.statusText}`;
          throw new Error(`Catalogue batch ${Math.floor(offset / batchSize) + 1} failed: ${detail}`);
        }
        setImportProgress(Math.min(100, Math.round(((offset + items.slice(offset, offset + batchSize).length) / items.length) * 100)));
      }
      await queryClient.invalidateQueries({ queryKey: ["kb", "sources"] });
      setSourceIds((current) => [...new Set([...current, source.id])]);
      setImportProgress(100);
      toast({ title: `Catalogue imported: ${items.length} products` });
    } catch (error) {
      // Never leave a failed upload paired with an older/partial catalogue.
      setRows([]);
      setFileName("");
      setSourceIds([]);
      setResults([]);
      setDecisions({});
      setMatchProgress(null);
      setImportProgress(null);
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Catalogue import failed" });
    }
  };

  const upload = async (file: File) => {
    try {
      const workbook = read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      setRows(utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[]);
      setFileName(file.name);
      setResults([]);
      setDecisions({});
      setMatchProgress(null);
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Could not read file" });
    }
  };

  const run = async () => {
    if (!rows.length || !sourceIds.length) {
      toast({ variant: "destructive", title: "Upload a destination list and select at least one catalog." });
      return;
    }
    setLoading(true);
    try {
      const header = (names: string[]) => {
        const keys = rows.length ? Object.keys(rows[0]) : [];
        return keys.find((key) => names.some((name) => key.toLowerCase().includes(name))) ?? null;
      };
      const nameKey = header(["itemname", "goods", "required", "description", "name", "item"]);
      const codeKey = header(["itemcode", "code", "sku", "article"]);
      const quantityKey = header(["quantity", "qty", "amount"]);
      const unitKey = header(["unit", "uom"]);
      const normalizedRows = rows
        .map((row) => ({
          itemCode: codeKey ? String(row[codeKey] ?? "").trim() || null : null,
          itemName: nameKey ? String(row[nameKey] ?? "").trim() : "",
          quantity: quantityKey ? Number.parseFloat(String(row[quantityKey] ?? "").replace(",", ".")) || null : null,
          description: null,
          unit: unitKey ? String(row[unitKey] ?? "").trim() || null : null,
        }))
        .filter((row) => row.itemName);
      if (!normalizedRows.length) throw new Error("No goods names found. Use a column such as Goods required or Item name.");
      const batchSize = 25;
      const allResults: Result[] = [];
      setMatchProgress(0);
      for (let offset = 0; offset < normalizedRows.length; offset += batchSize) {
        const response = await fetch("/api/standalone-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceIds, items: normalizedRows.slice(offset, offset + batchSize) }),
        });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `Matching batch ${Math.floor(offset / batchSize) + 1} failed`);
        if (Array.isArray(data.results)) allResults.push(...(data.results as Result[]));
        setMatchProgress(Math.min(100, Math.round(((offset + normalizedRows.slice(offset, offset + batchSize).length) / normalizedRows.length) * 100)));
      }
      setResults(allResults);
      if (allResults.length === 0) {
        throw new Error("No candidates returned. Confirm the selected catalogue contains active products.");
      }
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Matching failed" });
    } finally {
      setLoading(false);
    }
  };

  const exportReview = () => {
    const sheet = utils.json_to_sheet(results.filter((result) => decisions[result.itemId] !== "rejected").map((result) => ({
      "Destination item": result.itemName,
      "Catalog product": result.product.name,
      Code: result.product.code ?? "",
      Confidence: Math.round(result.confidenceScore * 100) / 100,
      Status: decisions[result.itemId] ?? "pending",
      Explanation: result.explanation,
      Price: result.product.price ?? "",
      Unit: result.product.unit ?? "",
    })));
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, "Reviewed matches");
    const bytes = write(workbook, { type: "array", bookType: "xlsx" });
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "goodsprogram-matches.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const grouped = Array.from(new Map(results.map((result) => [result.itemId, result])).values());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import &amp; Match</h1>
          <p className="text-muted-foreground mt-2">GoodsProgram workspace for destination lists, catalog matching, review, and export—independent of projects.</p>
        </div>
        <Button variant="outline" asChild><Link href="/catalogs"><ExternalLink className="w-4 h-4 mr-2" />Manage catalogs</Link></Button>
      </div>
      <Card><CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2"><Badge>Step 1</Badge><h2 className="font-semibold">Upload catalogue</h2></div>
        <input ref={catalogRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadCatalog(file); event.target.value = ""; }} />
        <Button variant="outline" onClick={() => catalogRef.current?.click()} disabled={createSource.isPending || importProgress !== null && importProgress < 100}><Upload className="w-4 h-4 mr-2" />Upload catalogue</Button>
        {importProgress !== null && <div className="w-full max-w-md space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>{importProgress < 100 ? "Importing catalogue…" : "Catalogue import complete"}</span><span>{importProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${importProgress}%` }} /></div></div>}
        <div className="flex items-center gap-2"><Badge>Step 2</Badge><h2 className="font-semibold">Upload goods list</h2></div>
        <div className="flex gap-3 items-center flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Upload destination list</Button>
          {fileName && <Badge variant="secondary">{fileName} · {rows.length} rows</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">Columns are mapped automatically. You can upload a specification, destination list, or plain item-name spreadsheet.</p>
        <div className="flex items-center gap-2"><Badge>Step 3</Badge><h2 className="font-semibold">Select catalogue and match</h2></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(sources ?? []).map((source) => <label key={source.id} className="flex items-center gap-2 rounded border p-3 cursor-pointer">
            <Checkbox checked={sourceIds.includes(source.id)} onCheckedChange={(checked) => setSourceIds((current) => checked ? [...new Set([...current, source.id])] : current.filter((id) => id !== source.id))} />
            <span className="text-sm flex-1">{source.name}</span><span className="text-xs text-muted-foreground">{source.productCount}</span>
          </label>)}
        </div>
        <Button onClick={run} disabled={loading || !rows.length}><Play className="w-4 h-4 mr-2" />{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Run matching"}</Button>
        {matchProgress !== null && <div className="w-full max-w-md space-y-1"><div className="flex justify-between text-xs text-muted-foreground"><span>{matchProgress < 100 ? "Matching goods…" : "Matching complete"}</span><span>{matchProgress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${matchProgress}%` }} /></div></div>}
      </CardContent></Card>
      {grouped.length > 0 && <Card><CardContent className="p-0 overflow-x-auto"><div className="p-4 border-b flex items-center justify-between"><div><h2 className="font-semibold">Review candidates</h2><p className="text-xs text-muted-foreground">Top-three candidates are shown for every destination item.</p></div><Button size="sm" variant="outline" onClick={exportReview}><Download className="w-4 h-4 mr-2" />Export XLSX</Button></div><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30"><th className="p-3 text-left">Destination item</th><th className="p-3 text-left">Candidates</th><th className="p-3">Review</th></tr></thead><tbody className="divide-y">{grouped.map((best) => { const candidates = results.filter((result) => result.itemId === best.itemId).sort((a, b) => a.rank - b.rank); return <tr key={best.itemId} className="align-top"><td className="p-3 font-medium max-w-xs">{best.itemName}</td><td className="p-3 space-y-2">{candidates.map((candidate) => <div key={candidate.rank} className="flex gap-2 items-start"><Badge variant={candidate.rank === 1 ? "default" : "outline"}>{candidate.rank}</Badge><div><p>{candidate.product.name} <span className="text-xs text-muted-foreground">{Math.round(candidate.confidenceScore * 100)}%</span></p><p className="text-xs text-muted-foreground">{candidate.explanation}</p></div></div>)}</td><td className="p-3"><div className="flex gap-1">{decisions[best.itemId] === "confirmed" ? <Badge className="bg-emerald-600"><Check className="w-3 h-3 mr-1" />Confirmed</Badge> : <Button size="sm" variant="outline" onClick={() => setDecisions((current) => ({ ...current, [best.itemId]: "confirmed" }))}><Check className="w-3 h-3 mr-1" />Confirm</Button>}{decisions[best.itemId] === "rejected" ? <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Rejected</Badge> : <Button size="sm" variant="ghost" onClick={() => setDecisions((current) => ({ ...current, [best.itemId]: "rejected" }))}><X className="w-3 h-3 mr-1" />Reject</Button>}</div></td></tr>; })}</tbody></table></CardContent></Card>}
    </div>
  );
}
