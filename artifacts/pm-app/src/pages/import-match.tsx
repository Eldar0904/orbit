import { useRef, useState, useMemo, useEffect } from "react";
import { Download, Play, Upload, X, Check, Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { read, utils, write } from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCatalogSources, useCreateCatalogSource } from "@/lib/kb-api";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────────────────────────

type CatalogProduct = {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  technicalSpecs: string | null;
  unit: string | null;
  price: number | null;
  categoryName: string | null;
};

type MatchCandidate = {
  itemId: number;
  itemName: string;
  rank: number;
  confidenceScore: number;
  explanation: string;
  product: CatalogProduct & { categoryIcon?: string };
};

type GoodsPreview = {
  headers: string[];
  detectedNameCol: string;
  sampleRows: Record<string, unknown>[];
  allRows: Record<string, unknown>[];
  fileName: string;
};

// ─── Categories ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all", label: "Все", icon: "📚" },
  { id: "digital", label: "Цифровое", icon: "🖥️", pattern: /компьютер|монитор|ноутбук|принтер|проектор|интерактив|цифров|системный блок|моноблок|планшет|сервер|мфу|сканер|экран.*проек/i },
  { id: "furniture", label: "Мебель", icon: "🪑", pattern: /стол(?!овая)|стул|шкаф|стеллаж|парт[аы]|кресл|мебел|тумб|полк[аи]|кровать|диван|скамь|гардероб/i },
  { id: "didactics", label: "Дидактика", icon: "📚", pattern: /дидактич|учебн|плакат|пособи|набор.*обуч|методич|демонстрац|наглядн|азбук|глобус/i },
  { id: "sensors", label: "Датчики", icon: "🔬", pattern: /датчик|лаборатор|микроскоп|прибор|измерител|осциллограф|реактив|пробирк|весы.*лаб/i },
  { id: "play", label: "Игровое", icon: "🎮", pattern: /игров|манеж|конструктор|горк[аи]|качел|песочниц|игрушк|куклы|батут|лабиринт/i },
  { id: "music", label: "Музыка", icon: "🎵", pattern: /музык|пиани|синтезатор|гитар|барабан|скрипк|флейт|бубен|металлофон/i },
  { id: "sport", label: "Спорт", icon: "🏋️", pattern: /спорт|тренаж|мат(?:ы|ов).*гимнаст|мяч|скакалк|обруч|турник|брус|канат/i },
  { id: "books", label: "Книги", icon: "📖", pattern: /книг[аи]|энциклопед|сказк|рассказ|хрестоматия|букварь|атлас|словарь/i },
  { id: "other", label: "Прочее", icon: "📦" },
];

function detectCategory(name: string): { id: string; label: string; icon: string } {
  for (const cat of CATEGORIES) {
    if (cat.id === "all" || cat.id === "other") continue;
    if ("pattern" in cat && cat.pattern!.test(name)) return cat;
  }
  return CATEGORIES[CATEGORIES.length - 1]; // "Прочее"
}

// ─── Smart column heuristic ─────────────────────────────────────────────────

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
      const lenScore = len >= 6 && len <= 150 ? len : len > 150 ? 40 : 0;
      const hasCyrillic = /[\u0400-\u04FF]/.test(val) ? 1.3 : 1.0;
      score += lenScore * hasCyrillic;
    }
    const uniqueRatio = new Set(sample.map((r) => String(r[key] ?? "").trim())).size / Math.max(sample.length, 1);
    score *= Math.min(uniqueRatio * 1.5, 1.0);
    if (score > bestScore) { bestScore = score; bestKey = key; }
  }
  return bestKey;
}

// ─── Page ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ImportMatchPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sources } = useCatalogSources();
  const createSource = useCreateCatalogSource();

  // Catalogue state — loaded from Supabase
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeSourceId, setActiveSourceId] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState<number | null>(null);

  // Goods list state
  const [goodsItems, setGoodsItems] = useState<{ itemName: string; itemCode: string | null }[]>([]);
  const [goodsFileName, setGoodsFileName] = useState("");
  const [goodsPreview, setGoodsPreview] = useState<GoodsPreview | null>(null);
  const [selectedNameCol, setSelectedNameCol] = useState("");

  // Match results
  const [results, setResults] = useState<MatchCandidate[]>([]);
  const [decisions, setDecisions] = useState<Record<number, "confirmed" | "rejected">>({});
  const [loading, setLoading] = useState(false);
  const [matchProgress, setMatchProgress] = useState<number | null>(null);

  // Refs
  const catalogRef = useRef<HTMLInputElement>(null);
  const goodsRef = useRef<HTMLInputElement>(null);

  // ─── Load catalogue from Supabase on mount ────────────────────────────

  useEffect(() => {
    if (sources?.length) {
      setActiveSourceId(sources[0].id);
      setCatalogLoading(false);
      fetchCatalogPage(0, sources[0].id);
    } else {
      setCatalogLoading(false);
    }
  }, [sources]); // eslint-disable-line

  const fetchCatalogPage = async (page: number, srcId?: number) => {
    const sid = srcId ?? activeSourceId;
    if (!sid) return;
    setCatalogLoading(true);
    try {
      const resp = await fetch(`/api/kb/sources/${sid}/products?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&search=${encodeURIComponent(catalogSearch)}`);
      if (!resp.ok) throw new Error("Failed to load");
      const data = await resp.json();
      const rows = Array.isArray(data) ? data : data.products ?? data.rows ?? [];
      const products: CatalogProduct[] = rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        code: r.code ?? null,
        description: r.description ?? null,
        technicalSpecs: r.technicalSpecs ?? r.technical_specs ?? null,
        unit: r.unit ?? null,
        price: r.price ?? null,
        categoryName: r.categoryName ?? r.category_name ?? null,
      }));
      for (const p of products) {
        if (!p.categoryName) {
          const cat = detectCategory(p.name);
          p.categoryName = cat.label;
        }
      }
      setCatalogProducts(products);
      setCatalogPage(page);
    } catch (err) {
      // silent
    } finally {
      setCatalogLoading(false);
    }
  };

  // ─── Filtered catalogue ─────────────────────────────────────────────────

  // Client-side category filter on the already-fetched page
  const filteredCatalog = useMemo(() => {
    if (activeCategory === "all") return catalogProducts;
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    if (!cat) return catalogProducts;
    return catalogProducts.filter((p) => p.categoryName === cat.label);
  }, [catalogProducts, activeCategory]);

  // With server-side pagination, we show whatever the server returned
  const pagedCatalog = filteredCatalog;
  const hasMore = catalogProducts.length >= PAGE_SIZE; // if we got a full page, there may be more

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: catalogProducts.length };
    for (const cat of CATEGORIES) {
      if (cat.id === "all") continue;
      counts[cat.id] = catalogProducts.filter((p) => p.categoryName === cat.label).length;
    }
    return counts;
  }, [catalogProducts]);

  // ─── Upload / refresh catalogue ─────────────────────────────────────────

  const uploadCatalog = async (file: File) => {
    try {
      const workbook = read(await file.arrayBuffer(), { type: "array" });
      const raw = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      if (!raw.length) throw new Error("Empty file");

      const headers = Object.keys(raw[0]);
      const find = (...names: string[]) => headers.find((h) => names.some((n) => h.toLowerCase().includes(n.toLowerCase())));

      const nameKey = find("наименование", "название", "name", "item", "product", "товар") ?? headers[1] ?? headers[0];
      const codeKey = find("код", "code", "артикул", "sku", "шифр");
      const descKey = find("описание", "description", "характеристик", "specification", "техн");
      const unitKey = find("единица", "unit", "ед.", "uom");
      const priceKey = find("сметная", "цена", "price", "cost", "стоимость");

      // Track group headers for category assignment
      let currentGroup = "";
      const items: any[] = [];

      for (const row of raw) {
        const name = String(row[nameKey] ?? "").trim();
        if (!name) continue;
        const code = codeKey ? String(row[codeKey] ?? "").trim() || null : null;
        const price = priceKey ? Number.parseFloat(String(row[priceKey] ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || null : null;
        const unit = unitKey ? String(row[unitKey] ?? "").trim() || null : null;
        const desc = descKey ? String(row[descKey] ?? "").trim() || null : null;

        // Detect group headers: has code but no price/unit
        if (code && !price && !unit) {
          currentGroup = name;
          continue; // Don't store group headers as products
        }

        const cat = detectCategory(`${name} ${currentGroup}`);
        items.push({
          name,
          code,
          description: desc,
          unit,
          price,
          categoryCode: cat.id,
          categoryName: cat.label,
        });
      }

      if (!items.length) throw new Error("No products found in this file.");

      // Persist to backend
      const sourceName = file.name.replace(/\.[^.]+$/, "");
      const source = sources?.find((s) => s.name === sourceName)
        ?? await createSource.mutateAsync({ name: sourceName });
      setActiveSourceId(source.id);

      const batchSize = 50;
      setImportProgress(0);
      for (let offset = 0; offset < items.length; offset += batchSize) {
        const batch = items.slice(offset, offset + batchSize);
        const resp = await fetch(`/api/kb/sources/${source.id}/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch, mode: offset === 0 ? "replace" : "upsert" }),
        });
        if (!resp.ok) throw new Error(`Import batch failed`);
        setImportProgress(Math.round(((offset + batch.length) / items.length) * 100));
      }
      setImportProgress(100);
      await queryClient.invalidateQueries({ queryKey: ["kb", "sources"] });

      // Update local state immediately
      setCatalogProducts(items.map((item, idx) => ({ id: idx + 1, ...item, technicalSpecs: null })));
      setCatalogPage(0);
      toast({ title: `Каталог обновлён: ${items.length} позиций` });
    } catch (error) {
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Import failed" });
    } finally {
      setImportProgress(null);
    }
  };

  // ─── Upload goods list ──────────────────────────────────────────────────

  const uploadGoodsList = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = read(e.target?.result, { type: "array" });
        const raw = utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        if (!raw.length) throw new Error("Empty file");
        const headers = Object.keys(raw[0]);
        const detectedNameCol = detectNameColumn(raw) ?? headers[0];
        setGoodsPreview({ headers, detectedNameCol, sampleRows: raw.slice(0, 5), allRows: raw, fileName: file.name });
        setSelectedNameCol(detectedNameCol);
      } catch (error) {
        toast({ variant: "destructive", title: error instanceof Error ? error.message : "Cannot read file" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmColumnSelection = () => {
    if (!goodsPreview || !selectedNameCol) return;
    const { allRows, fileName, headers } = goodsPreview;
    const codeKey = headers.find((h) => /код|code|артикул|sku|шифр/i.test(h));
    const items = allRows
      .map((row) => ({
        itemName: String(row[selectedNameCol] ?? "").trim(),
        itemCode: codeKey ? String(row[codeKey] ?? "").trim() || null : null,
      }))
      .filter((item) => item.itemName.length >= 3);
    if (!items.length) { toast({ variant: "destructive", title: "Нет данных в выбранной колонке" }); return; }
    setGoodsItems(items);
    setGoodsFileName(fileName);
    setGoodsPreview(null);
    setResults([]);
    setDecisions({});
    toast({ title: `Список загружен: ${items.length} позиций` });
  };

  // ─── Run matching ───────────────────────────────────────────────────────

  const runMatching = async () => {
    if (!goodsItems.length || !activeSourceId) {
      toast({ variant: "destructive", title: "Загрузите список товаров для подбора" });
      return;
    }
    setLoading(true);
    setResults([]);
    setMatchProgress(0);
    try {
      const batchSize = 25;
      const allResults: MatchCandidate[] = [];
      for (let offset = 0; offset < goodsItems.length; offset += batchSize) {
        const batch = goodsItems.slice(offset, offset + batchSize);
        const rows = batch.map((item) => ({ itemName: item.itemName, itemCode: item.itemCode }));
        const resp = await fetch("/api/standalone-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceIds: [activeSourceId], items: rows }),
        });
        if (!resp.ok) {
          let errMsg = "Unknown error";
          try { const errBody = await resp.json(); errMsg = errBody.error || errMsg; } catch {}
          throw new Error(`Ошибка подбора: ${errMsg}`);
        }
        const data = await resp.json();
        if (data.results) allResults.push(...data.results);
        setMatchProgress(Math.round(((offset + batch.length) / goodsItems.length) * 100));
      }
      setResults(allResults);
      setMatchProgress(100);
      toast({ title: `Подбор завершён: ${allResults.length} совпадений` });
    } catch (error) {
      setMatchProgress(null);
      toast({ variant: "destructive", title: error instanceof Error ? error.message : "Matching failed" });
    } finally {
      setLoading(false);
    }
  };

  // ─── Export ─────────────────────────────────────────────────────────────

  const exportResults = () => {
    const exportRows = results
      .filter((r) => decisions[r.itemId] !== "rejected")
      .map((r) => ({
        "Позиция из списка": r.itemName,
        "Ранг": r.rank,
        "Совпадение %": Math.round(r.confidenceScore * 100),
        "Код (Казниса)": r.product.code ?? "",
        "Наименование (каталог)": r.product.name,
        "Тех. описание": r.product.technicalSpecs ?? r.product.description ?? "",
        "Цена, тенге": r.product.price ?? "",
        "Ед. изм.": r.product.unit ?? "",
        "Статус": decisions[r.itemId] ?? "pending",
      }));
    const sheet = utils.json_to_sheet(exportRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, sheet, "Подбор товаров");
    const buf = write(workbook, { type: "array", bookType: "xlsx" });
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `подбор_${goodsFileName.replace(/\.[^.]+$/, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Grouped results ────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const map = new Map<number, MatchCandidate[]>();
    for (const r of results) {
      if (!map.has(r.itemId)) map.set(r.itemId, []);
      map.get(r.itemId)!.push(r);
    }
    return Array.from(map.entries()).map(([itemId, candidates]) => ({
      itemId,
      itemName: candidates[0].itemName,
      candidates: candidates.sort((a, b) => a.rank - b.rank),
    }));
  }, [results]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏛️ Каталог КазНИИСА</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => catalogRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            {catalogProducts.length ? "Обновить каталог" : "Загрузить каталог"}
          </Button>
          <input ref={catalogRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadCatalog(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </div>

      {importProgress !== null && (
        <div className="flex items-center gap-2 text-sm text-blue-700">
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
          </div>
          <span className="shrink-0">{importProgress}%</span>
        </div>
      )}

      {/* ── SECTION 1: Catalogue with category tabs ──────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {/* Category tabs */}
          <div className="p-3 border-b flex items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setCatalogPage(0); }}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {cat.icon} {cat.label}
                {categoryCounts[cat.id] > 0 && (
                  <span className="ml-1 text-xs opacity-70">({categoryCounts[cat.id]})</span>
                )}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="p-3 border-b">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по каталогу..."
                className="pl-9"
                value={catalogSearch}
                onChange={(e) => { setCatalogSearch(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") fetchCatalogPage(0); }}
                onBlur={() => fetchCatalogPage(0)}
              />
            </div>
          </div>

          {catalogLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
              <p>Загрузка каталога...</p>
            </div>
          ) : catalogProducts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <p className="text-lg mb-2">Каталог пуст</p>
              <p className="text-sm mb-4">Загрузите файл Казниса (.xlsx) для начала работы</p>
              <Button onClick={() => catalogRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />Загрузить каталог
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-3 text-left w-40 font-medium">Код</th>
                      <th className="p-3 text-left font-medium">Наименование</th>
                      <th className="p-3 text-left font-medium max-w-xs">Описание</th>
                      <th className="p-3 text-left w-16 font-medium">Ед.</th>
                      <th className="p-3 text-right w-32 font-medium">Цена, ₸</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedCatalog.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs text-muted-foreground">{p.code ?? "—"}</td>
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{p.description ?? "—"}</td>
                        <td className="p-3 text-center">{p.unit ?? "—"}</td>
                        <td className="p-3 text-right font-medium">{p.price ? p.price.toLocaleString("ru-KZ") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(catalogPage > 0 || hasMore) && (
                <div className="p-3 border-t flex items-center justify-between text-sm text-muted-foreground">
                  <span>Страница {catalogPage + 1}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" disabled={catalogPage === 0} onClick={() => fetchCatalogPage(catalogPage - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={!hasMore} onClick={() => fetchCatalogPage(catalogPage + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 2: Goods list drop zone ──────────────────────────────── */}
      {catalogProducts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-lg">📋 Подбор товаров</h2>
                {goodsItems.length > 0 && (
                  <>
                    <Badge variant="secondary">{goodsItems.length} позиций</Badge>
                    <span className="text-sm text-muted-foreground">{goodsFileName}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => goodsRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  {goodsItems.length ? "Другой список" : "Загрузить список"}
                </Button>
                <input ref={goodsRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadGoodsList(e.target.files[0]); e.target.value = ""; }} />
                {goodsItems.length > 0 && (
                  <Button onClick={runMatching} disabled={loading}>
                    <Play className="w-4 h-4 mr-2" />
                    {loading ? "Подбор..." : "Запустить подбор"}
                  </Button>
                )}
              </div>
            </div>

            {goodsItems.length === 0 && !goodsPreview && (
              <div
                className="mt-4 border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => goodsRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); if (e.dataTransfer.files[0]) uploadGoodsList(e.dataTransfer.files[0]); }}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-lg mb-1">Перетащите список товаров сюда</p>
                <p className="text-sm">Любой формат (.xlsx, .xls, .csv) — колонка определится автоматически</p>
              </div>
            )}

            {/* Column preview */}
            {goodsPreview && (
              <div className="mt-4 border rounded-lg p-4 bg-amber-50/50 border-amber-200">
                <h3 className="font-semibold mb-2">Подтвердите колонку с названиями товаров</h3>
                <div className="flex items-center gap-2 mb-4">
                  <select
                    className="border rounded-md px-3 py-2 text-sm bg-white"
                    value={selectedNameCol}
                    onChange={(e) => setSelectedNameCol(e.target.value)}
                  >
                    {goodsPreview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}{h === goodsPreview.detectedNameCol ? " ← (авто)" : ""}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={confirmColumnSelection}>
                    <Check className="w-4 h-4 mr-1" />Подтвердить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setGoodsPreview(null)}>
                    <X className="w-4 h-4 mr-1" />Отмена
                  </Button>
                </div>
                <div className="overflow-x-auto rounded border bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        {goodsPreview.headers.map((h) => (
                          <th key={h} className={`p-2 text-left whitespace-nowrap ${h === selectedNameCol ? "bg-primary/10 font-bold text-primary" : ""}`}>
                            {h}{h === selectedNameCol && " ✓"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {goodsPreview.sampleRows.map((row, idx) => (
                        <tr key={idx}>
                          {goodsPreview.headers.map((h) => (
                            <td key={h} className={`p-2 max-w-48 truncate ${h === selectedNameCol ? "bg-primary/5 font-medium" : ""}`}>
                              {String(row[h] ?? "").slice(0, 60)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Первые 5 строк. Выделенная колонка используется для подбора.</p>
              </div>
            )}

            {matchProgress !== null && matchProgress >= 0 && matchProgress < 100 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${matchProgress}%` }} />
                  </div>
                  <span className="shrink-0">{matchProgress}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── SECTION 3: Match results ─────────────────────────────────────── */}
      {grouped.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">🎯 Результаты подбора</h2>
                <p className="text-sm text-muted-foreground">
                  3 лучших совпадения из каталога для каждой позиции
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={exportResults}>
                <Download className="w-4 h-4 mr-2" />Скачать XLSX
              </Button>
            </div>

            <div className="divide-y">
              {grouped.map(({ itemId, itemName, candidates }) => (
                <div key={itemId} className="p-4 hover:bg-muted/10">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-semibold text-base">{itemName}</h3>
                    <div className="flex gap-1 shrink-0">
                      {decisions[itemId] === "confirmed" ? (
                        <Badge className="bg-emerald-600"><Check className="w-3 h-3 mr-1" />Подтверждено</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setDecisions((d) => ({ ...d, [itemId]: "confirmed" }))}><Check className="w-3 h-3 mr-1" />Подтвердить</Button>
                      )}
                      {decisions[itemId] === "rejected" ? (
                        <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Отклонено</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setDecisions((d) => ({ ...d, [itemId]: "rejected" }))}><X className="w-3 h-3 mr-1" />Отклонить</Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {candidates.map((c) => {
                      const cat = detectCategory(c.product.name);
                      return (
                        <div
                          key={c.rank}
                          className={`rounded-lg border p-3 space-y-2 ${
                            c.rank === 1 ? "border-emerald-300 bg-emerald-50/50"
                            : c.rank === 2 ? "border-blue-200 bg-blue-50/30"
                            : "border-muted bg-muted/10"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant={c.rank === 1 ? "default" : "outline"} className={c.rank === 1 ? "bg-emerald-600" : ""}>
                              {c.rank === 1 ? "🥇" : c.rank === 2 ? "🥈" : "🥉"} {Math.round(c.confidenceScore * 100)}%
                            </Badge>
                            <span className="text-xs">{cat.icon} {cat.label}</span>
                          </div>
                          <p className="font-medium text-sm leading-snug">{c.product.name}</p>
                          {c.product.code && <p className="text-xs font-mono text-muted-foreground">Код: {c.product.code}</p>}
                          {c.product.price != null && (
                            <p className="text-sm font-bold text-emerald-700">
                              {c.product.price.toLocaleString("ru-KZ")} ₸{c.product.unit ? ` / ${c.product.unit}` : ""}
                            </p>
                          )}
                          {(c.product.description || c.product.technicalSpecs) && (
                            <p className="text-xs text-muted-foreground line-clamp-3">{c.product.technicalSpecs || c.product.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground/60 italic">{c.explanation}</p>
                        </div>
                      );
                    })}
                    {candidates.length === 0 && (
                      <p className="text-sm text-muted-foreground col-span-3 italic py-4 text-center">Совпадений не найдено</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
