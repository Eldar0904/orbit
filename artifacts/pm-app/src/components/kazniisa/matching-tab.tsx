import { useRef, useState, useMemo } from "react";
import { Download, Play, Upload, X, Check } from "lucide-react";
import { read, utils, write } from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Candidate = {
  rank: number;
  productId: number;
  code: string;
  name: string;
  unit: string | null;
  price: number | null;
  description: string | null;
  imageUrl: string | null;
  sectionName: string | null;
  confidence: number;
};

type MatchResultItem = {
  input: string;
  candidates: Candidate[];
};

type GoodsPreview = {
  headers: string[];
  detectedNameCol: string;
  sampleRows: Record<string, unknown>[];
  allRows: Record<string, unknown>[];
  fileName: string;
};

// ─── Smart column detection ─────────────────────────────────────────────────

function detectNameColumn(rows: Record<string, unknown>[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  const knownPatterns = /^(наименование|название|товар|товары|позиция|номенклатура|продукт|продукция|материал|оборудование|мебель|предмет|изделие|name|item|product|goods)/i;
  const found = keys.find((k) => knownPatterns.test(k.trim()));
  if (found) return found;

  const sample = rows.slice(0, 50);
  let bestKey = keys[0];
  let bestScore = -1;
  for (const key of keys) {
    let score = 0;
    for (const row of sample) {
      const val = String(row[key] ?? "").trim();
      if (!val || val.length < 4) continue;
      if (/^\d[\d\s.,\-/]*$/.test(val)) continue;
      const len = val.length;
      score += (len >= 6 && len <= 150 ? len : len > 150 ? 40 : 0) * (/[\u0400-\u04FF]/.test(val) ? 1.3 : 1.0);
    }
    const uniqueRatio = new Set(sample.map((r) => String(r[key] ?? "").trim())).size / Math.max(sample.length, 1);
    score *= Math.min(uniqueRatio * 1.5, 1.0);
    if (score > bestScore) { bestScore = score; bestKey = key; }
  }
  return bestKey;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MatchingTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [goodsPreview, setGoodsPreview] = useState<GoodsPreview | null>(null);
  const [selectedNameCol, setSelectedNameCol] = useState("");
  const [goodsItems, setGoodsItems] = useState<{ name: string; code: string | null }[]>([]);
  const [goodsFileName, setGoodsFileName] = useState("");
  const [results, setResults] = useState<MatchResultItem[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "confirmed" | "rejected">>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [summary, setSummary] = useState<{ matched: number; review: number; noMatch: number } | null>(null);

  // ─── Upload goods list ──────────────────────────────────────────────────

  const onFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = read(e.target?.result, { type: "array" });
        const raw = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        if (!raw.length) throw new Error("Пустой файл");
        const headers = Object.keys(raw[0]);
        const detectedNameCol = detectNameColumn(raw) ?? headers[0];
        setGoodsPreview({ headers, detectedNameCol, sampleRows: raw.slice(0, 5), allRows: raw, fileName: file.name });
        setSelectedNameCol(detectedNameCol);
      } catch (error) {
        toast({ variant: "destructive", title: error instanceof Error ? error.message : "Не удалось прочитать файл" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmColumn = () => {
    if (!goodsPreview || !selectedNameCol) return;
    const { allRows, fileName, headers } = goodsPreview;
    const codeKey = headers.find((h) => /код|code|артикул|sku|шифр/i.test(h));
    const items = allRows
      .map((row) => ({
        name: String(row[selectedNameCol] ?? "").trim(),
        code: codeKey ? String(row[codeKey] ?? "").trim() || null : null,
      }))
      .filter((item) => item.name.length >= 3);
    if (!items.length) { toast({ variant: "destructive", title: "Нет данных в выбранной колонке" }); return; }
    setGoodsItems(items);
    setGoodsFileName(fileName);
    setGoodsPreview(null);
    setResults([]);
    setDecisions({});
    setSummary(null);
    toast({ title: `Загружено: ${items.length} позиций` });
  };

  // ─── Run matching ───────────────────────────────────────────────────────

  const runMatching = async () => {
    if (!goodsItems.length) return;
    setLoading(true);
    setResults([]);
    setProgress(0);
    setSummary(null);
    try {
      const batchSize = 25;
      const allResults: MatchResultItem[] = [];
      let totalMatched = 0, totalReview = 0, totalNoMatch = 0;

      for (let offset = 0; offset < goodsItems.length; offset += batchSize) {
        const batch = goodsItems.slice(offset, offset + batchSize);
        const resp = await fetch("/api/kazniisa/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: goodsFileName, items: batch }),
        });
        if (!resp.ok) {
          let msg = "Ошибка подбора";
          try { const e = await resp.json(); msg = e.error ?? msg; } catch {}
          throw new Error(msg);
        }
        const data = await resp.json();
        allResults.push(...(data.results ?? []));
        totalMatched += data.matched ?? 0;
        totalReview += data.review ?? 0;
        totalNoMatch += data.noMatch ?? 0;
        setProgress(Math.round(((offset + batch.length) / goodsItems.length) * 100));
      }
      setResults(allResults);
      setSummary({ matched: totalMatched, review: totalReview, noMatch: totalNoMatch });
      setProgress(100);
      toast({ title: `Подбор завершён` });
    } catch (error) {
      setProgress(null);
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Ошибка" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Export ─────────────────────────────────────────────────────────────

  const exportResults = () => {
    const rows = results.flatMap((r) =>
      r.candidates.length > 0
        ? r.candidates.map((c) => ({
            "Позиция из списка": r.input,
            "Ранг": c.rank,
            "Совпадение %": c.confidence,
            "Код КазНИИСА": c.code,
            "Наименование (каталог)": c.name,
            "Описание": c.description ?? "",
            "Ед.изм": c.unit ?? "",
            "Сметная цена, ₸": c.price ?? "",
            "Раздел": c.sectionName ?? "",
            "Статус": decisions[`${r.input}-${c.rank}`] ?? "pending",
          }))
        : [{ "Позиция из списка": r.input, "Ранг": "", "Совпадение %": "", "Код КазНИИСА": "", "Наименование (каталог)": "", "Описание": "", "Ед.изм": "", "Сметная цена, ₸": "", "Раздел": "", "Статус": "нет совпадений" }],
    );
    const sheet = utils.json_to_sheet(rows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, "Подбор");
    const buf = write(workbook, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `подбор_${goodsFileName.replace(/\.[^.]+$/, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Upload / status bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-lg">Подбор товаров</h2>
              {goodsItems.length > 0 && (
                <>
                  <Badge variant="secondary">{goodsItems.length} позиций</Badge>
                  <span className="text-sm text-muted-foreground">{goodsFileName}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                {goodsItems.length ? "Другой список" : "Загрузить список"}
              </Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFileSelect(e.target.files[0]); e.target.value = ""; }} />
              {goodsItems.length > 0 && (
                <Button onClick={runMatching} disabled={loading}>
                  <Play className="w-4 h-4 mr-2" />{loading ? "Подбор..." : "Запустить подбор"}
                </Button>
              )}
              {results.length > 0 && (
                <Button size="sm" variant="outline" onClick={exportResults}>
                  <Download className="w-4 h-4 mr-2" />XLSX
                </Button>
              )}
            </div>
          </div>

          {/* Drop zone */}
          {goodsItems.length === 0 && !goodsPreview && (
            <div
              className="mt-4 border-2 border-dashed rounded-lg p-10 text-center text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); if (e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]); }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-lg mb-1">Перетащите список товаров</p>
              <p className="text-sm">.xlsx, .xls, .csv — колонка определится автоматически</p>
            </div>
          )}

          {/* Column picker */}
          {goodsPreview && (
            <div className="mt-4 border rounded-lg p-4 bg-amber-50/50 border-amber-200">
              <h3 className="font-semibold mb-2">Подтвердите колонку с названиями</h3>
              <div className="flex items-center gap-2 mb-3">
                <select className="border rounded-md px-3 py-2 text-sm bg-white" value={selectedNameCol} onChange={(e) => setSelectedNameCol(e.target.value)}>
                  {goodsPreview.headers.map((h) => <option key={h} value={h}>{h}{h === goodsPreview.detectedNameCol ? " ← авто" : ""}</option>)}
                </select>
                <Button size="sm" onClick={confirmColumn}><Check className="w-4 h-4 mr-1" />ОК</Button>
                <Button size="sm" variant="ghost" onClick={() => setGoodsPreview(null)}><X className="w-4 h-4 mr-1" />Отмена</Button>
              </div>
              <div className="overflow-x-auto rounded border bg-white">
                <table className="w-full text-xs">
                  <thead><tr className="bg-muted/30">{goodsPreview.headers.map((h) => <th key={h} className={`p-2 text-left whitespace-nowrap ${h === selectedNameCol ? "bg-primary/10 font-bold text-primary" : ""}`}>{h}</th>)}</tr></thead>
                  <tbody className="divide-y">{goodsPreview.sampleRows.map((row, idx) => <tr key={idx}>{goodsPreview.headers.map((h) => <td key={h} className={`p-2 max-w-48 truncate ${h === selectedNameCol ? "bg-primary/5 font-medium" : ""}`}>{String(row[h] ?? "").slice(0, 50)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress !== null && progress >= 0 && progress < 100 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-700">
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0">{progress}%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="flex gap-3">
          <Badge className="bg-emerald-600 text-white">✅ Совпадения: {summary.matched}</Badge>
          <Badge variant="secondary">🔶 На проверку: {summary.review}</Badge>
          <Badge variant="outline">❌ Нет: {summary.noMatch}</Badge>
        </div>
      )}

      {/* Results */}
      {results.filter((r) => r.candidates.length > 0).map((item, idx) => (
        <Card key={idx}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold">{item.input}</h3>
              <div className="flex gap-1">
                {decisions[`${item.input}-1`] === "confirmed" ? (
                  <Badge className="bg-emerald-600"><Check className="w-3 h-3 mr-1" />Подтверждено</Badge>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setDecisions((d) => ({ ...d, [`${item.input}-1`]: "confirmed" }))}><Check className="w-3 h-3 mr-1" />Подтвердить</Button>
                )}
                {decisions[`${item.input}-1`] === "rejected" ? (
                  <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Отклонено</Badge>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setDecisions((d) => ({ ...d, [`${item.input}-1`]: "rejected" }))}><X className="w-3 h-3 mr-1" />Отклонить</Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {item.candidates.map((c) => (
                <div key={c.rank} className={`rounded-lg border p-3 space-y-1.5 ${c.rank === 1 ? "border-emerald-300 bg-emerald-50/50" : c.rank === 2 ? "border-blue-200 bg-blue-50/30" : "border-muted"}`}>
                  <div className="flex items-center justify-between">
                    <Badge variant={c.rank === 1 ? "default" : "outline"} className={c.rank === 1 ? "bg-emerald-600" : ""}>
                      {c.rank === 1 ? "🥇" : c.rank === 2 ? "🥈" : "🥉"} {c.confidence}%
                    </Badge>
                    {c.sectionName && <span className="text-xs text-muted-foreground">{c.sectionName}</span>}
                  </div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">Код: {c.code}</p>
                  {c.price != null && <p className="text-sm font-bold text-emerald-700">{c.price.toLocaleString("ru-KZ")} ₸{c.unit ? ` / ${c.unit}` : ""}</p>}
                  {c.description && <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
