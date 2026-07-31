import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useCatalogSources,
  useProjectSpecItems,
  useSaveSpecItems,
  useProjectCatalogLinks,
  useSaveCatalogLinks,
  useRunMatch,
  useMatchResults,
  useSelectMatch,
  useReviewMatch,
  useExportOffer,
  useSupplierSearch,
  type MatchResultRow,
  type SpecItem,
  parseExcelToRows,
} from "@/lib/kb-api";
import {
  Play,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  Search,
  Clock,
  Upload,
  Check,
  X,
} from "lucide-react";
import { Link } from "wouter";

function MatchStatusBadge({ score }: { score: number }) {
  const { t } = useTranslation();
  const status = score >= 0.55 ? "matched" : score >= 0.3 ? "partial" : "unmatched";
  if (status === "matched")
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
        <CheckCircle2 className="w-3 h-3" /> {t("sourcing.matchItems.statusMatched")}
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
        <AlertCircle className="w-3 h-3" /> {t("sourcing.matchItems.statusPartial")}
      </Badge>
    );
  return (
    <Badge className="bg-slate-50 text-slate-500 border-slate-200 gap-1">
      <CircleDashed className="w-3 h-3" /> {t("sourcing.matchItems.statusNoMatch")}
    </Badge>
  );
}

function UpcomingPhaseCard({ title, description, comingSoon }: { title: string; description: string; comingSoon: string }) {
  return (
    <Card className="border-border/50 shadow-sm border-dashed bg-muted/20">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Clock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-sm tracking-tight">{title}</h3>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{comingSoon}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcurementTab({ projectId }: { projectId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [specText, setSpecText] = useState("");
  const [marginPercent, setMarginPercent] = useState("0");
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [supplierQuery, setSupplierQuery] = useState("");

  const { data: sources } = useCatalogSources();
  const { data: specData } = useProjectSpecItems(projectId);
  const { data: links } = useProjectCatalogLinks(projectId);
  const { data: matchData } = useMatchResults(projectId);

  const saveSpec = useSaveSpecItems(projectId);
  const saveLinks = useSaveCatalogLinks(projectId);
  const runMatch = useRunMatch(projectId);
  const selectMatch = useSelectMatch(projectId);
  const reviewMatch = useReviewMatch(projectId);
  const exportOffer = useExportOffer(projectId);
  const supplierSearch = useSupplierSearch();

  const linkedIds = links?.map((l) => l.sourceId) ?? selectedSources;

  const handleSaveSpec = () => {
    const lines = specText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast({ variant: "destructive", title: t("sourcing.matchItems.enterOneItem") });
      return;
    }
    saveSpec.mutate(
      { lines },
      {
        onSuccess: () => toast({ title: t("sourcing.matchItems.itemsSaved", { count: lines.length }) }),
        onError: (e) => toast({ variant: "destructive", title: e.message }),
      },
    );
  };

  const handleSpecUpload = async (file: File) => {
    try {
      const rows = await parseExcelToRows(await file.arrayBuffer());
      saveSpec.mutate(
        { rows },
        {
          onSuccess: () =>
            toast({ title: t("sourcing.matchItems.itemsSaved", { count: rows.length }) }),
          onError: (e) => toast({ variant: "destructive", title: e.message }),
        },
      );
    } catch (error) {
      toast({
        variant: "destructive",
        title: error instanceof Error ? error.message : "Could not read spreadsheet",
      });
    }
  };

  const handleSaveLinks = () => {
    const ids = selectedSources.length ? selectedSources : linkedIds;
    saveLinks.mutate(ids, {
      onSuccess: () => toast({ title: t("catalogs.linksSaved") }),
      onError: (e) => toast({ variant: "destructive", title: e.message }),
    });
  };

  const handleRunMatch = () => {
    runMatch.mutate(undefined, {
      onSuccess: () => toast({ title: t("sourcing.matchItems.matchComplete") }),
      onError: (e) => toast({ variant: "destructive", title: e.message }),
    });
  };

  const handleExport = () => {
    const margin = parseFloat(marginPercent) || 0;
    exportOffer.mutate(margin, {
      onSuccess: async (data) => {
        const { utils, write } = await import("xlsx");
        const sheet = utils.json_to_sheet(
          data.lines.map((line) => ({
            "#": line.lineNumber,
            "Specification item": line.itemName,
            "Matched product": line.matchedName,
            Quantity: line.quantity,
            Unit: line.unit,
            "Unit price": line.unitPrice,
            Total: line.lineTotal,
          })),
        );
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, sheet, "Commercial offer");
        const bytes = write(workbook, { type: "array", bookType: "xlsx" });
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename.replace(/\.csv$/i, ".xlsx");
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: t("sourcing.buildOffer.exported") });
      },
      onError: (e) => toast({ variant: "destructive", title: e.message }),
    });
  };

  const handleSupplierSearch = () => {
    const items = supplierQuery.split("\n").map((l) => l.trim()).filter(Boolean).map((itemName) => ({ itemName }));
    if (!items.length) return;
    supplierSearch.mutate(
      { items: items.slice(0, 10), createCatalogSource: true },
      {
        onSuccess: (data) => toast({ title: t("sourcing.findSuppliers.found", { count: data.hits.length }) }),
        onError: (e) => toast({ variant: "destructive", title: e.message }),
      },
    );
  };

  const specItems = matchData?.specItems ?? specData?.items ?? [];
  const results = matchData?.results ?? [];

  const groupedResults = specItems.map((spec) => ({
    spec,
    candidates: results.filter((r) => r.specItemId === spec.id).sort((a, b) => a.rank - b.rank),
    selected: results.find((r) => r.specItemId === spec.id && r.isSelected),
  }));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t("sourcing.subtitle")}{" "}
        <Link href="/catalogs" className="text-primary underline-offset-2 hover:underline">
          {t("catalogs.title")}
        </Link>
      </p>

      {/* Spec list */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-sm uppercase text-muted-foreground">{t("sourcing.matchItems.specItems")}</h3>
          {specData?.list && (
            <p className="text-xs text-muted-foreground font-mono">
              {t("sourcing.matchItems.itemsCount", { count: specData.list.itemCount })}
            </p>
          )}
          <Textarea
            placeholder={t("sourcing.matchItems.specPlaceholder")}
            value={specText}
            onChange={(e) => setSpecText(e.target.value)}
            rows={5}
            className="font-mono text-sm"
          />
          <Button size="sm" onClick={handleSaveSpec} disabled={saveSpec.isPending}>
            {t("sourcing.matchItems.saveSpec")}
          </Button>
          <Label className="inline-flex ml-2">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleSpecUpload(file);
                event.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" asChild>
              <span><Upload className="w-4 h-4 mr-2" />Upload Excel</span>
            </Button>
          </Label>
        </CardContent>
      </Card>

      {/* Catalog selection */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-sm uppercase text-muted-foreground">{t("catalogs.projectCatalogs")}</h3>
          {!sources?.length ? (
            <p className="text-sm text-muted-foreground">
              {t("catalogs.noSources")} —{" "}
              <Link href="/catalogs" className="text-primary underline">{t("catalogs.title")}</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => {
                const checked = (selectedSources.length ? selectedSources : linkedIds).includes(s.id);
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`src-${s.id}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSelectedSources((prev) => {
                          const base = prev.length ? prev : [...linkedIds];
                          return v ? [...new Set([...base, s.id])] : base.filter((id) => id !== s.id);
                        });
                      }}
                    />
                    <Label htmlFor={`src-${s.id}`} className="text-sm flex-1 cursor-pointer">
                      {s.name} <span className="text-muted-foreground font-mono text-xs">({s.productCount})</span>
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleSaveLinks} disabled={saveLinks.isPending}>
              {t("catalogs.saveLinks")}
            </Button>
            <Button size="sm" onClick={handleRunMatch} disabled={runMatch.isPending}>
              {runMatch.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {t("sourcing.matchItems.runMatch")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Match results */}
      {groupedResults.length > 0 && matchData?.run && (
        <Card className="border-border/50 shadow-sm overflow-hidden">
          <div className="bg-muted/30 px-5 py-3 border-b border-border">
            <h3 className="font-bold text-sm uppercase text-muted-foreground">{t("sourcing.matchItems.results")}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2 text-left">{t("sourcing.matchItems.colSpecItem")}</th>
                  <th className="px-4 py-2 text-left">{t("sourcing.matchItems.colBestMatch")}</th>
                  <th className="px-4 py-2 w-20">{t("sourcing.matchItems.colScore")}</th>
                  <th className="px-4 py-2">{t("sourcing.matchItems.colStatus")}</th>
                  <th className="px-4 py-2">{t("sourcing.matchItems.select")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {groupedResults.map(({ spec, candidates, selected }) => (
                  <SpecResultRow
                    key={spec.id}
                    spec={spec}
                    candidates={candidates}
                    selected={selected}
                    onSelect={(id) => selectMatch.mutate(id)}
                    onReview={(resultId, action) => reviewMatch.mutate({ resultId, action })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Commercial offer export */}
      {matchData?.run && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-bold text-sm uppercase text-muted-foreground">{t("sourcing.buildOffer.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("sourcing.buildOffer.description")}</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">{t("sourcing.buildOffer.margin")}</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-24"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(e.target.value)}
                />
              </div>
              <Button onClick={handleExport} disabled={exportOffer.isPending}>
                <Download className="w-4 h-4 mr-2" />
                {t("sourcing.buildOffer.export")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Supplier search */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-bold text-sm uppercase text-muted-foreground">{t("sourcing.findSuppliers.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("sourcing.findSuppliers.description")}</p>
          <Textarea
            placeholder={t("sourcing.findSuppliers.placeholder")}
            value={supplierQuery}
            onChange={(e) => setSupplierQuery(e.target.value)}
            rows={3}
            className="font-mono text-sm"
          />
          <Button size="sm" onClick={handleSupplierSearch} disabled={supplierSearch.isPending}>
            <Search className="w-4 h-4 mr-2" />
            {supplierSearch.isPending ? t("sourcing.findSuppliers.searching") : t("sourcing.findSuppliers.search")}
          </Button>
          {supplierSearch.data?.hits && supplierSearch.data.hits.length > 0 && (
            <ul className="space-y-2 pt-2">
              {supplierSearch.data.hits.map((hit, i) => (
                <li key={i} className="text-sm p-2 rounded border border-border">
                  <p className="font-medium">{hit.itemName}</p>
                  <p className="text-muted-foreground">{hit.supplierName} — {hit.productName}</p>
                  {hit.notes && <p className="text-xs text-muted-foreground mt-1">{hit.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <UpcomingPhaseCard
        title={t("sourcing.procurementPhase.title")}
        description={t("sourcing.procurementPhase.description")}
        comingSoon={t("sourcing.procurementPhase.comingSoon")}
      />
    </div>
  );
}

function SpecResultRow({
  spec,
  candidates,
  selected,
  onSelect,
  onReview,
}: {
  spec: SpecItem;
  candidates: MatchResultRow[];
  selected?: MatchResultRow;
  onSelect: (id: number) => void;
  onReview: (id: number, action: "confirm" | "reject") => void;
}) {
  const best = selected ?? candidates[0];
  const score = best?.confidenceScore ?? 0;

  return (
    <tr className="hover:bg-muted/20">
      <td className="px-4 py-3 font-medium max-w-xs">
        <span className="line-clamp-2">{spec.itemName}</span>
      </td>
      <td className="px-4 py-3 text-muted-foreground max-w-xs">
        {best?.matchedName ?? "—"}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-center">{Math.round(score * 100)}%</td>
      <td className="px-4 py-3">
        <MatchStatusBadge score={score} />
        {best?.reviewStatus !== "pending" && (
          <p className="mt-1 text-[10px] uppercase text-muted-foreground">{best?.reviewStatus}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {candidates.slice(0, 3).map((c) => (
            <label key={c.id} className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                name={`spec-${spec.id}`}
                checked={c.isSelected}
                onChange={() => onSelect(c.id)}
              />
              <span className="truncate max-w-[120px]">{c.matchedName ?? "—"}</span>
            </label>
          ))}
          {best && (
            <div className="flex gap-1 mt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => onReview(best.id, "confirm")}
              >
                <Check className="w-3 h-3 mr-1" />Confirm
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-destructive"
                onClick={() => onReview(best.id, "reject")}
              >
                <X className="w-3 h-3 mr-1" />Reject
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
