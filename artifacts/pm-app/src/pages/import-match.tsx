import { useRef, useState } from "react";
import { Upload, Play, RefreshCw, ArrowRight } from "lucide-react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useCatalogSources } from "@/lib/kb-api";

type Result = { itemId: number; itemName: string; rank: number; confidenceScore: number; explanation: string; product: { name: string; code: string | null; price: number | null } };

export default function ImportMatchPage() {
  const { toast } = useToast();
  const { data: sources } = useCatalogSources();
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    try {
      const workbook = read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      setRows(utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[]);
      setFileName(file.name);
      setResults([]);
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Could not read file" });
    }
  };

  const run = async () => {
    if (!rows.length || !sourceIds.length) {
      toast({ variant: "destructive", title: "Upload a file and select at least one catalog." });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/standalone-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds, items: rows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Matching failed");
      setResults(data.results as Result[]);
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Matching failed" });
    } finally {
      setLoading(false);
    }
  };

  const grouped = Array.from(new Map(results.map((r) => [r.itemId, r])).values());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import &amp; Match</h1>
        <p className="text-muted-foreground mt-2">Upload a specification and match it against catalogs without creating a project.</p>
      </div>
      <Card><CardContent className="p-5 space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Upload specification</Button>
          {fileName && <Badge variant="secondary">{fileName} · {rows.length} rows</Badge>}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(sources ?? []).map((source) => <label key={source.id} className="flex items-center gap-2 rounded border p-3 cursor-pointer">
            <Checkbox checked={sourceIds.includes(source.id)} onCheckedChange={(checked) => setSourceIds((current) => checked ? [...new Set([...current, source.id])] : current.filter((id) => id !== source.id))} />
            <span className="text-sm flex-1">{source.name}</span><span className="text-xs text-muted-foreground">{source.productCount}</span>
          </label>)}
        </div>
        <Button onClick={run} disabled={loading || !rows.length}><Play className="w-4 h-4 mr-2" />{loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Run matching"}</Button>
      </CardContent></Card>
      {grouped.length > 0 && <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30"><th className="p-3 text-left">Specification item</th><th className="p-3 text-left">Best candidate</th><th className="p-3">Confidence</th><th className="p-3 text-left">Explanation</th></tr></thead><tbody className="divide-y">{grouped.map((result) => <tr key={result.itemId}><td className="p-3 font-medium">{result.itemName}</td><td className="p-3">{result.product.name}</td><td className="p-3 text-center">{Math.round(result.confidenceScore * 100)}%</td><td className="p-3 text-muted-foreground">{result.explanation} <ArrowRight className="inline w-3 h-3" /></td></tr>)}</tbody></table></CardContent></Card>}
    </div>
  );
}
