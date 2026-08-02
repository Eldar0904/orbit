import { useRef, useState } from "react";
import { Upload, Sparkles, Search, Check, X, ChevronRight, FileText, Building2, Table } from "lucide-react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type ParsedItem = {
  name: string;
  code?: string | null;
  description?: string | null;
  quantity?: number | null;
};

type AnalysisGroup = {
  name: string;
  itemNums: number[];
  section: string | null;
};

type Analysis = {
  summary: string;
  orgType: string;
  listType: string;
  groups: AnalysisGroup[];
};

type MatchResult = {
  inputIndex: number;
  inputName: string;
  catalogueIndex: number;
  confidence: "high" | "medium" | "low";
  reason: string;
  product: {
    id: number;
    code: string;
    name: string;
    unit: string | null;
    estimatedPrice: number | null;
  } | null;
};

type GroupMatchState = {
  matches: MatchResult[];
  unmatched: number[];
  notes: string | null;
  confirmed: Set<number>;
  rejected: Set<number>;
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
      if (val.length > 10) score += 2;
      if (/[а-яА-ЯёЁ]/.test(val)) score += 2;
      if (val.length > 5 && val.length < 200) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}

// ─── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: number }) {
  const steps = ["Загрузка", "Просмотр", "Анализ", "Подбор"];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
            i + 1 === step ? "bg-primary text-primary-foreground" :
            i + 1 < step ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
          }`}>
            {i + 1 < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className={`text-sm ${i + 1 === step ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
          {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MatchingTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [nameCol, setNameCol] = useState<string>("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [groupMatches, setGroupMatches] = useState<Record<number, GroupMatchState>>({});

  // ─── File Upload & Parse ────────────────────────────────────────────────

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsedRows = utils.sheet_to_json<Record<string, unknown>>(ws);

      if (parsedRows.length === 0) {
        toast({ title: "Пустой файл", variant: "destructive" });
        return;
      }

      const keys = Object.keys(parsedRows[0]);
      const detectedCol = detectNameColumn(parsedRows) ?? keys[0];

      setHeaders(keys);
      setRows(parsedRows);
      setNameCol(detectedCol);
      setFileName(file.name);

      // Build items from detected name column
      const parsed: ParsedItem[] = parsedRows
        .map((row) => ({
          name: String(row[detectedCol] ?? "").trim(),
          quantity: typeof row["кол-во"] === "number" ? row["кол-во"] :
                    typeof row["количество"] === "number" ? row["количество"] :
                    typeof row["Количество"] === "number" ? row["Количество"] :
                    typeof row["qty"] === "number" ? row["qty"] : null,
        }))
        .filter((item) => item.name.length > 2);

      setItems(parsed);
      setStep(2);

      toast({ title: `Загружено: ${parsedRows.length} строк, ${keys.length} колонок` });
    } catch (err: any) {
      toast({ title: "Ошибка чтения файла", description: err.message, variant: "destructive" });
    }
  }

  // ─── AI Analysis ────────────────────────────────────────────────────────

  async function analyzeList() {
    setLoading(true);
    try {
      const resp = await fetch("/api/kazniisa/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: fileName, items }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setAnalysis(data.analysis);
      setStep(3);
    } catch (err: any) {
      toast({ title: "Ошибка анализа", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ─── AI Search for a group ──────────────────────────────────────────────

  async function searchGroup(groupIdx: number) {
    if (!analysis) return;
    const group = analysis.groups[groupIdx];
    const groupItems = group.itemNums.map((n) => items[n - 1]?.name).filter(Boolean);

    setActiveGroup(groupIdx);
    setLoading(true);
    setStep(4);

    try {
      const resp = await fetch("/api/kazniisa/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: groupItems,
          sectionCode: group.section,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setGroupMatches((prev) => ({
        ...prev,
        [groupIdx]: {
          matches: data.matches ?? [],
          unmatched: data.unmatched ?? [],
          notes: data.notes,
          confirmed: new Set(),
          rejected: new Set(),
        },
      }));
    } catch (err: any) {
      toast({ title: "Ошибка поиска", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function confirmMatch(groupIdx: number, inputIndex: number) {
    setGroupMatches((prev) => {
      const state = prev[groupIdx];
      if (!state) return prev;
      const confirmed = new Set(state.confirmed);
      confirmed.add(inputIndex);
      const rejected = new Set(state.rejected);
      rejected.delete(inputIndex);
      return { ...prev, [groupIdx]: { ...state, confirmed, rejected } };
    });
  }

  function rejectMatch(groupIdx: number, inputIndex: number) {
    setGroupMatches((prev) => {
      const state = prev[groupIdx];
      if (!state) return prev;
      const rejected = new Set(state.rejected);
      rejected.add(inputIndex);
      const confirmed = new Set(state.confirmed);
      confirmed.delete(inputIndex);
      return { ...prev, [groupIdx]: { ...state, confirmed, rejected } };
    });
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <StepIndicator step={step} />

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 hover:border-primary/50 transition-colors">
          <Upload className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Загрузите список товаров</p>
          <p className="text-sm text-muted-foreground mb-4">Excel или CSV файл со списком для подбора</p>
          <Button onClick={() => fileInputRef.current?.click()}>
            Выбрать файл
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* Step 2: Table Preview */}
      {step === 2 && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Table className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-medium">{fileName}</h3>
                <p className="text-sm text-muted-foreground">
                  {rows.length} строк · {headers.length} колонок · Колонка наименований: <span className="font-medium text-foreground">{nameCol}</span>
                </p>
              </div>
            </div>
            <Button onClick={analyzeList} disabled={loading}>
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? "Анализ..." : "🤖 Анализировать"}
            </Button>
          </div>

          {/* Data Table */}
          <div className="border rounded-lg overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-10">#</th>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-left text-xs font-medium whitespace-nowrap ${
                        h === nameCol ? "text-primary bg-primary/5" : "text-muted-foreground"
                      }`}
                    >
                      {h}
                      {h === nameCol && " ✓"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                    {headers.map((h) => (
                      <td
                        key={h}
                        className={`px-3 py-1.5 whitespace-nowrap max-w-[300px] truncate ${
                          h === nameCol ? "font-medium" : ""
                        }`}
                      >
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Проверьте данные и нажмите «Анализировать» для AI-категоризации
          </p>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Sparkles className="w-8 h-8 text-primary animate-pulse mb-3" />
          <p className="text-sm text-muted-foreground">
            {step === 3 || (step === 2 && loading) ? "AI анализирует список..." : "AI ищет соответствия..."}
          </p>
        </div>
      )}

      {/* Step 3: Analysis Results */}
      {step === 3 && analysis && !loading && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{fileName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{analysis.summary}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                <Badge variant="secondary" className="gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {analysis.orgType}
                </Badge>
                <Badge variant="secondary">{analysis.listType}</Badge>
                <Badge variant="outline">{items.length} позиций</Badge>
                <Badge variant="outline">{analysis.groups.length} групп</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Groups */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Группы товаров:</h3>
            {analysis.groups.map((group, idx) => {
              const matchState = groupMatches[idx];
              const confirmedCount = matchState?.confirmed.size ?? 0;
              const total = group.itemNums.length;

              return (
                <Card key={idx} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{group.name}</span>
                          <Badge variant="outline" className="text-xs">{total} шт</Badge>
                          {confirmedCount > 0 && (
                            <Badge className="bg-green-500 text-xs">{confirmedCount}/{total} ✓</Badge>
                          )}
                        </div>
                        {group.section && (
                          <p className="text-xs text-muted-foreground mt-1">
                            → КазНИИСА: {group.section}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => searchGroup(idx)}
                        disabled={loading}
                      >
                        <Search className="w-4 h-4 mr-1" />
                        Найти
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Back to table button */}
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              ← Вернуться к таблице
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Match Results */}
      {step === 4 && activeGroup !== null && groupMatches[activeGroup] && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{analysis?.groups[activeGroup]?.name}</h3>
              {groupMatches[activeGroup].notes && (
                <p className="text-sm text-muted-foreground mt-0.5">{groupMatches[activeGroup].notes}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setStep(3); setActiveGroup(null); }}>
              ← Назад к группам
            </Button>
          </div>

          {/* Matches */}
          <div className="space-y-2">
            {groupMatches[activeGroup].matches.map((match, idx) => {
              const isConfirmed = groupMatches[activeGroup].confirmed.has(match.inputIndex);
              const isRejected = groupMatches[activeGroup].rejected.has(match.inputIndex);

              return (
                <Card key={idx} className={`transition-all ${
                  isConfirmed ? "border-green-300 bg-green-50 dark:bg-green-950/20" :
                  isRejected ? "border-red-200 bg-red-50/50 dark:bg-red-950/10 opacity-60" : ""
                }`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{match.inputName}</div>
                        {match.product && (
                          <div className="mt-1 pl-3 border-l-2 border-primary/30">
                            <div className="text-sm">
                              <span className="font-mono text-xs text-muted-foreground">{match.product.code}</span>
                              {" "}{match.product.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {match.product.estimatedPrice && (
                                <span className="text-xs text-muted-foreground">{match.product.estimatedPrice.toLocaleString()} тг</span>
                              )}
                              <Badge variant={match.confidence === "high" ? "default" : match.confidence === "medium" ? "secondary" : "outline"} className="text-xs">
                                {match.confidence === "high" ? "Точно" : match.confidence === "medium" ? "Похоже" : "Неточно"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{match.reason}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant={isConfirmed ? "default" : "ghost"}
                          className="w-7 h-7"
                          onClick={() => confirmMatch(activeGroup, match.inputIndex)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant={isRejected ? "destructive" : "ghost"}
                          className="w-7 h-7"
                          onClick={() => rejectMatch(activeGroup, match.inputIndex)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Unmatched */}
          {groupMatches[activeGroup].unmatched.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Не найдено в каталоге ({groupMatches[activeGroup].unmatched.length}):
                </p>
                <div className="space-y-1">
                  {groupMatches[activeGroup].unmatched.map((itemIdx) => {
                    const group = analysis?.groups[activeGroup];
                    const realIdx = group?.itemNums[itemIdx] ? group.itemNums[itemIdx] - 1 : undefined;
                    const itemName = realIdx !== undefined ? items[realIdx]?.name : `Item ${itemIdx}`;
                    return (
                      <div key={itemIdx} className="text-sm text-muted-foreground">• {itemName}</div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
