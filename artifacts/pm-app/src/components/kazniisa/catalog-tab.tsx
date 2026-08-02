import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Section = { sectionCode: string; sectionName: string; count: number };
type Product = {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  cargoClass: number | null;
  weightKg: number | null;
  estimatedPrice: number | null;
  description: string | null;
  imageUrl: string | null;
  hasDetail: boolean;
  sectionName: string;
};

const PAGE_SIZE = 20;

export function CatalogTab() {
  const [sections, setSections] = useState<Section[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState<{ label: string; productCount: number } | null>(null);

  useEffect(() => {
    fetchSections();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [activeSection, page]);

  const fetchSections = async () => {
    try {
      const resp = await fetch("/api/kazniisa/sections");
      if (!resp.ok) return;
      const data = await resp.json();
      setSections(data.sections ?? []);
      setVersion(data.version);
    } catch {}
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (activeSection) params.set("section", activeSection);
      if (search) params.set("search", search);
      const resp = await fetch(`/api/kazniisa/products?${params}`);
      if (!resp.ok) return;
      const data = await resp.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
    } catch {} finally {
      setLoading(false);
    }
  };

  const doSearch = () => { setPage(0); fetchProducts(); };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Card>
      <CardContent className="p-0">
        {/* Version header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">
              {version ? version.label : "Каталог не загружен"}
            </h2>
            {version && <Badge variant="secondary">{version.productCount} позиций</Badge>}
          </div>
        </div>

        {/* Section filters */}
        {sections.length > 0 && (
          <div className="p-3 border-b flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => { setActiveSection(""); setPage(0); }}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                !activeSection ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              Все ({total})
            </button>
            {sections.map((s) => (
              <button
                key={s.sectionCode}
                onClick={() => { setActiveSection(s.sectionCode); setPage(0); }}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                  activeSection === s.sectionCode
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                {s.sectionCode} {s.sectionName} ({s.count})
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по коду или названию..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
            <p>Загрузка...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">{version ? "Ничего не найдено" : "Каталог пуст"}</p>
            {!version && <p className="text-sm">Импортируйте PDF для загрузки каталога</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left w-44 font-medium">Код</th>
                    <th className="p-3 text-left font-medium">Наименование</th>
                    <th className="p-3 text-left w-14 font-medium">Ед.</th>
                    <th className="p-3 text-right w-20 font-medium">Масса</th>
                    <th className="p-3 text-right w-32 font-medium">Цена, ₸</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-xs text-muted-foreground">
                        {p.hasDetail && <span className="mr-1">📷</span>}
                        {p.code}
                      </td>
                      <td className="p-3 font-medium">{p.name}</td>
                      <td className="p-3 text-center text-muted-foreground">{p.unit ?? "—"}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {p.weightKg ? `${p.weightKg} кг` : "—"}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {p.estimatedPrice ? p.estimatedPrice.toLocaleString("ru-KZ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
