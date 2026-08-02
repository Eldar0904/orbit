import { useRef, useState, useEffect } from "react";
import { Upload, Send, Check, X, Table, Bot, User, Loader2 } from "lucide-react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type MatchResult = {
  inputIndex: number;
  inputName: string;
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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  matches?: MatchResult[];
  unmatched?: number[];
  notes?: string;
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

// ─── Main Component ─────────────────────────────────────────────────────────

export function MatchingTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // File state
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [nameCol, setNameCol] = useState<string>("");
  const [items, setItems] = useState<string[]>([]);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      const itemNames = parsedRows
        .map((row) => String(row[detectedCol] ?? "").trim())
        .filter((name) => name.length > 2);

      setItems(itemNames);

      // Welcome message from AI
      setMessages([{
        role: "assistant",
        content: `Загружен файл **${file.name}** — ${parsedRows.length} строк, ${keys.length} колонок.\n\nКолонка наименований: **${detectedCol}** (${itemNames.length} позиций).\n\nНапишите категорию для поиска, например:\n- «мебель детская»\n- «оборудование игровое 521-1»\n- «найди стулья»\n\nЯ найду соответствия в каталоге КазНИИСА.`,
      }]);

      toast({ title: `Загружено: ${parsedRows.length} строк` });
    } catch (err: any) {
      toast({ title: "Ошибка чтения файла", description: err.message, variant: "destructive" });
    }
  }

  // ─── Send message to AI ─────────────────────────────────────────────────

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      // Extract section code if user mentions one (e.g. "521-1")
      const sectionMatch = text.match(/\b(52[12]-[12])\b/);
      const sectionCode = sectionMatch?.[1] ?? null;

      // Filter items by user's query keywords (simple client-side pre-filter)
      const keywords = text.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
      let filteredItems = items;
      if (keywords.length > 0 && items.length > 20) {
        filteredItems = items.filter((item) =>
          keywords.some((kw) => item.toLowerCase().includes(kw))
        );
        // If filter is too strict, send all
        if (filteredItems.length === 0) filteredItems = items.slice(0, 20);
      }
      // Cap at 20 items to keep within token limits
      filteredItems = filteredItems.slice(0, 20);

      const resp = await fetch("/api/kazniisa/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: filteredItems,
          sectionCode,
          query: text,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.notes ?? (data.matches?.length > 0
          ? `Найдено ${data.matches.length} соответствий:`
          : "Не нашёл подходящих товаров в каталоге. Попробуйте другие ключевые слова или укажите раздел (521-1, 521-2, 522-1, 522-2)."),
        matches: data.matches,
        unmatched: data.unmatched,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Ошибка: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function confirmItem(key: string) {
    setConfirmed((prev) => new Set([...prev, key]));
    setRejected((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }

  function rejectItem(key: string) {
    setRejected((prev) => new Set([...prev, key]));
    setConfirmed((prev) => { const n = new Set(prev); n.delete(key); return n; });
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  // No file uploaded yet
  if (rows.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
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
      </div>
    );
  }

  // File loaded — two-panel layout: table + chat
  return (
    <div className="flex h-[calc(100vh-200px)] gap-4 p-4">
      {/* Left: Data Table */}
      <div className="w-1/2 flex flex-col border rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
          <Table className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{fileName}</span>
          <Badge variant="outline" className="text-xs ml-auto">{rows.length} строк</Badge>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">#</th>
                {headers.map((h) => (
                  <th
                    key={h}
                    className={`px-2 py-1.5 text-left font-medium whitespace-nowrap ${
                      h === nameCol ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {h}{h === nameCol ? " ✓" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                  {headers.map((h) => (
                    <td
                      key={h}
                      className={`px-2 py-1 whitespace-nowrap max-w-[200px] truncate ${
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
      </div>

      {/* Right: AI Chat */}
      <div className="w-1/2 flex flex-col border rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">AI Подбор</span>
          {confirmed.size > 0 && (
            <Badge className="bg-green-500 text-xs ml-auto">{confirmed.size} подтверждено</Badge>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === "user" ? "order-first" : ""}`}>
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                }`}>
                  {msg.content.split("\n").map((line, j) => (
                    <p key={j} className={j > 0 ? "mt-1" : ""}>
                      {line.split(/(\*\*.*?\*\*)/).map((part, k) =>
                        part.startsWith("**") && part.endsWith("**")
                          ? <strong key={k}>{part.slice(2, -2)}</strong>
                          : part
                      )}
                    </p>
                  ))}
                </div>

                {/* Match results */}
                {msg.matches && msg.matches.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {msg.matches.map((match, idx) => {
                      const key = `${i}-${idx}`;
                      const isConfirmed = confirmed.has(key);
                      const isRejected = rejected.has(key);

                      return (
                        <Card key={idx} className={`text-xs transition-all ${
                          isConfirmed ? "border-green-300 bg-green-50 dark:bg-green-950/20" :
                          isRejected ? "opacity-40" : ""
                        }`}>
                          <CardContent className="p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{match.inputName}</div>
                                {match.product && (
                                  <div className="mt-0.5 text-muted-foreground">
                                    <span className="font-mono">{match.product.code}</span>
                                    {" "}{match.product.name}
                                    {match.product.estimatedPrice && (
                                      <span className="ml-1">• {match.product.estimatedPrice.toLocaleString()} тг</span>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant={match.confidence === "high" ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                                    {match.confidence === "high" ? "✓" : match.confidence === "medium" ? "~" : "?"}
                                  </Badge>
                                  <span className="text-muted-foreground">{match.reason}</span>
                                </div>
                              </div>
                              <div className="flex gap-0.5 shrink-0">
                                <Button size="icon" variant={isConfirmed ? "default" : "ghost"} className="w-6 h-6" onClick={() => confirmItem(key)}>
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant={isRejected ? "destructive" : "ghost"} className="w-6 h-6" onClick={() => rejectItem(key)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                Ищу в каталоге...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Найди мебель в 521-1..."
              className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
