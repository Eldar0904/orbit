import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCatalogSources,
  useCreateCatalogSource,
  useImportCatalog,
  useSuppliers,
  useCreateSupplier,
  useRemoveCatalogSource,
} from "@/lib/kb-api";
import { useToast } from "@/hooks/use-toast";
import { Database, Upload, Plus, Package, Trash2 } from "lucide-react";

function parseCatalogFromBuffer(buffer: ArrayBuffer) {
  const wb = xlsxRead(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: Record<string, unknown>[] = xlsxUtils.sheet_to_json(ws, { defval: "" });
  if (raw.length === 0) {
    const rows: unknown[][] = xlsxUtils.sheet_to_json(ws, { header: 1, defval: "" });
    return rows
      .map((r) => String(r[0] ?? "").trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }
  const headers = Object.keys(raw[0]);
  const findCol = (...c: string[]) =>
    headers.find((h) => c.some((x) => h.toLowerCase().includes(x.toLowerCase()))) ?? headers[0];
  const nameCol = findCol("name", "наименование", "название", "товар", "item");
  const codeCol = findCol("code", "код", "артикул");
  const priceCol = findCol("price", "цена", "стоимость");
  const unitCol = findCol("unit", "ед", "единица");
  return raw
    .map((row) => {
      const name = String(row[nameCol] ?? "").trim();
      if (!name) return null;
      const priceRaw = priceCol ? String(row[priceCol] ?? "") : "";
      const price = priceRaw ? parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
      return {
        name,
        code: codeCol ? String(row[codeCol] ?? "").trim() || null : null,
        unit: unitCol ? String(row[unitCol] ?? "").trim() || null : null,
        price: price != null && !Number.isNaN(price) ? price : null,
      };
    })
    .filter(Boolean) as { name: string; code?: string | null; unit?: string | null; price?: number | null }[];
}

export default function CatalogsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: sources, isLoading } = useCatalogSources();
  const { data: suppliers } = useSuppliers();
  const createSource = useCreateCatalogSource();
  const createSupplier = useCreateSupplier();
  const removeSource = useRemoveCatalogSource();
  const [newSourceName, setNewSourceName] = useState("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [importSourceId, setImportSourceId] = useState<number | null>(null);
  const importCatalog = useImportCatalog(importSourceId ?? 0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreateSource = () => {
    if (!newSourceName.trim()) return;
    createSource.mutate(
      { name: newSourceName.trim(), kind: "supplier" },
      {
        onSuccess: () => {
          toast({ title: t("catalogs.sourceCreated") });
          setNewSourceName("");
        },
        onError: (e) => toast({ variant: "destructive", title: e.message }),
      },
    );
  };

  const handleCreateSupplier = () => {
    if (!newSupplierName.trim()) return;
    createSupplier.mutate(
      { name: newSupplierName.trim() },
      {
        onSuccess: () => {
          toast({ title: t("catalogs.supplierCreated") });
          setNewSupplierName("");
        },
        onError: (e) => toast({ variant: "destructive", title: e.message }),
      },
    );
  };

  const handleImport = async (file: File) => {
    if (!importSourceId) {
      toast({ variant: "destructive", title: t("catalogs.selectSourceFirst") });
      return;
    }
    const buffer = await file.arrayBuffer();
    const items = parseCatalogFromBuffer(buffer);
    if (items.length === 0) {
      toast({ variant: "destructive", title: t("catalogs.noItemsInFile") });
      return;
    }
    importCatalog.mutate(items, {
      onSuccess: (data) => {
        toast({ title: t("catalogs.imported", { count: data.imported }) });
      },
      onError: (e) => toast({ variant: "destructive", title: e.message }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Database className="w-8 h-8 text-primary" />
          {t("catalogs.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">{t("catalogs.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-sm uppercase text-muted-foreground">{t("catalogs.sources")}</h2>
            <div className="flex gap-2">
              <Input
                placeholder={t("catalogs.newSourcePlaceholder")}
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
              <Button size="sm" onClick={handleCreateSource} disabled={createSource.isPending}>
                <Plus className="w-4 h-4 mr-1" />
                {t("common.add")}
              </Button>
            </div>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : sources && sources.length > 0 ? (
              <ul className="space-y-2">
                {sources.map((s) => (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      importSourceId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                    }`}
                    onClick={() => setImportSourceId(s.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.kind}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0"><Badge variant="secondary" className="font-mono">{s.productCount}</Badge><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Remove catalogue" onClick={(event) => { event.stopPropagation(); if (window.confirm(`Remove catalogue ${s.name}?`)) removeSource.mutate(s.id); }}><Trash2 className="w-3.5 h-3.5" /></Button></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("catalogs.noSources")}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-sm uppercase text-muted-foreground">{t("catalogs.import")}</h2>
            <p className="text-sm text-muted-foreground">{t("catalogs.importHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={!importSourceId || importCatalog.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {importCatalog.isPending ? t("common.creating") : t("catalogs.uploadCatalog")}
            </Button>
            {importSourceId && (
              <p className="text-xs text-muted-foreground">
                {t("catalogs.importTarget")}: {sources?.find((s) => s.id === importSourceId)?.name}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <h2 className="font-bold text-sm uppercase text-muted-foreground">{t("catalogs.suppliers")}</h2>
          <div className="flex gap-2 max-w-md">
            <Input
              placeholder={t("catalogs.newSupplierPlaceholder")}
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
            />
            <Button size="sm" onClick={handleCreateSupplier} disabled={createSupplier.isPending}>
              <Plus className="w-4 h-4 mr-1" />
              {t("common.add")}
            </Button>
          </div>
          {suppliers && suppliers.length > 0 ? (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suppliers.map((s) => (
                <li key={s.id} className="p-3 rounded-lg border border-border text-sm">
                  <p className="font-medium">{s.name}</p>
                  {s.website && <p className="text-xs text-muted-foreground truncate">{s.website}</p>}
                  <Badge variant="outline" className="mt-1 text-[10px]">{s.sourceType}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("catalogs.noSuppliers")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
