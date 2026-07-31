import { Router, type IRouter } from "express";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  db,
  projectsTable,
  specListsTable,
  specItemsTable,
  projectCatalogLinksTable,
  catalogSourcesTable,
  catalogProductsTable,
  matchRunsTable,
  matchResultsTable,
  matchFeedbackTable,
  commercialOffersTable,
  commercialOfferLinesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { normalizeForMatching } from "../lib/kb-normalize.js";
import { parseSpecLines, parseSpecRows } from "../lib/kb-import.js";
import { matchSpecItemsToCatalog, statusFromScore } from "../lib/multi-matcher.js";
import { buildOfferLines, buildOfferCsv } from "../lib/offer-export.js";

const router: IRouter = Router();

async function resolveProjectId(rawId: string): Promise<number | null> {
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id)) return null;
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, id));
  return project?.id ?? null;
}

const SpecItemsBody = z.object({
  items: z.array(
    z.object({
      itemCode: z.string().nullable().optional(),
      itemName: z.string().min(1),
      description: z.string().nullable().optional(),
      quantity: z.number().nullable().optional(),
      categoryCode: z.string().nullable().optional(),
      categoryName: z.string().nullable().optional(),
    }),
  ).optional().default([]),
  lines: z.array(z.string()).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
});

const CatalogLinksBody = z.object({
  sourceIds: z.array(z.number().int().positive()),
});

const SelectMatchBody = z.object({
  resultId: z.number().int().positive(),
});

const ManualMatchBody = z.object({
  specItemId: z.number().int().positive(),
  catalogProductId: z.number().int().positive(),
});

const ReviewMatchBody = z.object({
  resultId: z.number().int().positive(),
  action: z.enum(["confirm", "reject"]),
  note: z.string().max(1000).optional(),
});

const ExportOfferBody = z.object({
  title: z.string().optional(),
  marginPercent: z.number().min(0).max(100).default(0),
});

// ─── Spec items ──────────────────────────────────────────────────────────────

router.get("/projects/:id/spec-items", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [list] = await db.select().from(specListsTable).where(eq(specListsTable.projectId, projectId));
  if (!list) {
    res.json({ list: null, items: [] });
    return;
  }

  const items = await db
    .select()
    .from(specItemsTable)
    .where(eq(specItemsTable.specListId, list.id))
    .orderBy(specItemsTable.sortOrder, specItemsTable.id);

  res.json({ list, items });
});

router.put("/projects/:id/spec-items", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = SpecItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let rows = parsed.data.items;
  if (parsed.data.lines?.length) {
    rows = [...rows, ...parseSpecLines(parsed.data.lines)];
  }
  if (parsed.data.rows?.length) {
    rows = [...rows, ...parseSpecRows(parsed.data.rows)];
  }
  if (rows.length === 0) {
    res.status(400).json({ error: "No spec items provided" });
    return;
  }

  let [list] = await db.select().from(specListsTable).where(eq(specListsTable.projectId, projectId));
  if (!list) {
    [list] = await db.insert(specListsTable).values({
      projectId,
      itemCount: rows.length,
      updatedAt: new Date(),
    }).returning();
  } else {
    await db.delete(specItemsTable).where(eq(specItemsTable.specListId, list.id));
    [list] = await db
      .update(specListsTable)
      .set({ itemCount: rows.length, updatedAt: new Date() })
      .where(eq(specListsTable.id, list.id))
      .returning();
  }

  const inserted = await db
    .insert(specItemsTable)
    .values(
      rows.map((row, idx) => ({
        specListId: list!.id,
        projectId,
        itemCode: row.itemCode ?? null,
        itemName: row.itemName,
        description: row.description ?? null,
        quantity: row.quantity ?? null,
        categoryCode: row.categoryCode ?? null,
        categoryName: row.categoryName ?? null,
        normalizedText: normalizeForMatching(row.itemCode, row.itemName, row.description),
        sortOrder: idx,
      })),
    )
    .returning();

  res.json({ list, items: inserted });
});

// ─── Catalog links ───────────────────────────────────────────────────────────

router.get("/projects/:id/catalog-links", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const links = await db
    .select({
      id: projectCatalogLinksTable.id,
      projectId: projectCatalogLinksTable.projectId,
      sourceId: projectCatalogLinksTable.sourceId,
      includeInMatching: projectCatalogLinksTable.includeInMatching,
      sortOrder: projectCatalogLinksTable.sortOrder,
      sourceName: catalogSourcesTable.name,
      sourceKind: catalogSourcesTable.kind,
      productCount: catalogSourcesTable.productCount,
    })
    .from(projectCatalogLinksTable)
    .innerJoin(catalogSourcesTable, eq(projectCatalogLinksTable.sourceId, catalogSourcesTable.id))
    .where(eq(projectCatalogLinksTable.projectId, projectId));

  res.json(links);
});

router.put("/projects/:id/catalog-links", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = CatalogLinksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(projectCatalogLinksTable).where(eq(projectCatalogLinksTable.projectId, projectId));

  if (parsed.data.sourceIds.length > 0) {
    await db.insert(projectCatalogLinksTable).values(
      parsed.data.sourceIds.map((sourceId, idx) => ({
        projectId,
        sourceId,
        includeInMatching: true,
        sortOrder: idx,
      })),
    );
  }

  const links = await db
    .select()
    .from(projectCatalogLinksTable)
    .where(eq(projectCatalogLinksTable.projectId, projectId));

  res.json(links);
});

// ─── Match run ───────────────────────────────────────────────────────────────

router.post("/projects/:id/match-run", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const specItems = await db
    .select()
    .from(specItemsTable)
    .where(eq(specItemsTable.projectId, projectId))
    .orderBy(specItemsTable.sortOrder);

  if (specItems.length === 0) {
    res.status(400).json({ error: "No spec items. Upload a spec list first." });
    return;
  }

  const links = await db
    .select({ sourceId: projectCatalogLinksTable.sourceId })
    .from(projectCatalogLinksTable)
    .where(
      and(
        eq(projectCatalogLinksTable.projectId, projectId),
        eq(projectCatalogLinksTable.includeInMatching, true),
      ),
    );

  const sourceIds = links.map((l) => l.sourceId);
  if (sourceIds.length === 0) {
    res.status(400).json({ error: "No catalogs linked. Select catalogs for this project." });
    return;
  }

  const products = await db
    .select({
      id: catalogProductsTable.id,
      sourceId: catalogProductsTable.sourceId,
      code: catalogProductsTable.code,
      name: catalogProductsTable.name,
      brand: catalogProductsTable.brand,
      model: catalogProductsTable.model,
      unit: catalogProductsTable.unit,
      price: catalogProductsTable.price,
    })
    .from(catalogProductsTable)
    .where(
      and(
        inArray(catalogProductsTable.sourceId, sourceIds),
        eq(catalogProductsTable.isActive, true),
      ),
    );

  if (products.length === 0) {
    res.status(400).json({ error: "Linked catalogs have no products. Import catalogs first." });
    return;
  }

  const [run] = await db
    .insert(matchRunsTable)
    .values({
      projectId,
      engineName: "jaccard_v1",
      itemsProcessed: specItems.length,
      finishedAt: new Date(),
    })
    .returning();

  const matchMap = matchSpecItemsToCatalog(specItems, products);
  const resultRows = [];

  for (const spec of specItems) {
    const candidates = matchMap.get(spec.id) ?? [];
    for (const c of candidates) {
      resultRows.push({
        runId: run.id,
        specItemId: spec.id,
        catalogProductId: c.catalogProductId,
        rank: c.rank,
        confidenceScore: c.confidenceScore,
        explanation: c.explanation,
        isSelected: c.rank === 1 && statusFromScore(c.confidenceScore) === "matched",
        matchedName: c.product.name,
        matchedPrice: c.product.price ?? null,
        matchedUnit: c.product.unit ?? null,
      });
    }
    if (candidates.length === 0) {
      resultRows.push({
        runId: run.id,
        specItemId: spec.id,
        catalogProductId: null,
        rank: 1,
        confidenceScore: 0,
        explanation: "No match found",
        isSelected: false,
        matchedName: null,
        matchedPrice: null,
        matchedUnit: null,
      });
    }
  }

  const inserted = await db.insert(matchResultsTable).values(resultRows).returning();

  res.json({ run, results: inserted });
});

router.get("/projects/:id/match-results", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [run] = await db
    .select()
    .from(matchRunsTable)
    .where(eq(matchRunsTable.projectId, projectId))
    .orderBy(desc(matchRunsTable.startedAt))
    .limit(1);

  if (!run) {
    res.json({ run: null, results: [], specItems: [] });
    return;
  }

  const results = await db
    .select()
    .from(matchResultsTable)
    .where(eq(matchResultsTable.runId, run.id))
    .orderBy(matchResultsTable.specItemId, matchResultsTable.rank);

  const specItems = await db
    .select()
    .from(specItemsTable)
    .where(eq(specItemsTable.projectId, projectId))
    .orderBy(specItemsTable.sortOrder);

  res.json({ run, results, specItems });
});

router.patch("/projects/:id/match-results/select", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = SelectMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(matchResultsTable)
    .where(eq(matchResultsTable.id, parsed.data.resultId));

  if (!target) {
    res.status(404).json({ error: "Match result not found" });
    return;
  }

  await db
    .update(matchResultsTable)
    .set({ isSelected: false })
    .where(
      and(
        eq(matchResultsTable.runId, target.runId),
        eq(matchResultsTable.specItemId, target.specItemId),
      ),
    );

  const [updated] = await db
    .update(matchResultsTable)
    .set({ isSelected: true, isManualOverride: true })
    .where(eq(matchResultsTable.id, parsed.data.resultId))
    .returning();

  res.json(updated);
});

const StandaloneMatchBody = z.object({
  sourceIds: z.array(z.number().int().positive()).min(1),
  items: z.array(z.record(z.string(), z.unknown())).min(1),
});

router.post("/standalone-match", async (req, res): Promise<void> => {
  const parsed = StandaloneMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const specItems = parseSpecRows(parsed.data.items).map((item, index) => ({
    ...item,
    id: index + 1,
  }));
  if (!specItems.length) {
    res.status(400).json({ error: "No specification items found in the uploaded file." });
    return;
  }
  const products = await db
    .select({
      id: catalogProductsTable.id,
      sourceId: catalogProductsTable.sourceId,
      code: catalogProductsTable.code,
      name: catalogProductsTable.name,
      brand: catalogProductsTable.brand,
      model: catalogProductsTable.model,
      unit: catalogProductsTable.unit,
      price: catalogProductsTable.price,
    })
    .from(catalogProductsTable)
    .where(and(inArray(catalogProductsTable.sourceId, parsed.data.sourceIds), eq(catalogProductsTable.isActive, true)));
  if (!products.length) {
    res.status(400).json({ error: "Selected catalogs contain no active products." });
    return;
  }
  const matches = matchSpecItemsToCatalog(specItems, products);
  res.json({
    items: specItems,
    results: specItems.flatMap((item) => (matches.get(item.id) ?? []).map((candidate) => ({
      itemId: item.id,
      itemName: item.itemName,
      ...candidate,
    }))),
  });
});

router.patch("/projects/:id/match-results/review", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const parsed = ReviewMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [target] = await db
    .select()
    .from(matchResultsTable)
    .where(eq(matchResultsTable.id, parsed.data.resultId));
  if (!target) {
    res.status(404).json({ error: "Match result not found" });
    return;
  }
  const [run] = await db
    .select()
    .from(matchRunsTable)
    .where(and(eq(matchRunsTable.id, target.runId), eq(matchRunsTable.projectId, projectId)));
  if (!run) {
    res.status(404).json({ error: "Match result does not belong to this project" });
    return;
  }

  if (parsed.data.action === "confirm") {
    await db
      .update(matchResultsTable)
      .set({ isSelected: false })
      .where(
        and(
          eq(matchResultsTable.runId, target.runId),
          eq(matchResultsTable.specItemId, target.specItemId),
        ),
      );
  }
  const [updated] = await db
    .update(matchResultsTable)
    .set({
      isSelected: parsed.data.action === "confirm",
      reviewStatus: parsed.data.action === "confirm" ? "confirmed" : "rejected",
      reviewedAt: new Date(),
      reviewNote: parsed.data.note ?? null,
      isManualOverride: true,
    })
    .where(eq(matchResultsTable.id, target.id))
    .returning();

  await db.insert(matchFeedbackTable).values({
    projectId,
    runId: target.runId,
    specItemId: target.specItemId,
    matchResultId: target.id,
    catalogProductId: target.catalogProductId,
    action: parsed.data.action,
    note: parsed.data.note ?? null,
  });
  res.json(updated);
});

router.get("/projects/:id/match-feedback", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const history = await db
    .select()
    .from(matchFeedbackTable)
    .where(eq(matchFeedbackTable.projectId, projectId))
    .orderBy(desc(matchFeedbackTable.createdAt));
  res.json(history);
});

router.post("/projects/:id/match-results/manual", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = ManualMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [run] = await db
    .select()
    .from(matchRunsTable)
    .where(eq(matchRunsTable.projectId, projectId))
    .orderBy(desc(matchRunsTable.startedAt))
    .limit(1);

  if (!run) {
    res.status(404).json({ error: "No match run found" });
    return;
  }

  const [product] = await db
    .select()
    .from(catalogProductsTable)
    .where(eq(catalogProductsTable.id, parsed.data.catalogProductId));

  if (!product) {
    res.status(404).json({ error: "Catalog product not found" });
    return;
  }

  await db
    .update(matchResultsTable)
    .set({ isSelected: false })
    .where(
      and(
        eq(matchResultsTable.runId, run.id),
        eq(matchResultsTable.specItemId, parsed.data.specItemId),
      ),
    );

  const [inserted] = await db
    .insert(matchResultsTable)
    .values({
      runId: run.id,
      specItemId: parsed.data.specItemId,
      catalogProductId: product.id,
      rank: 0,
      confidenceScore: 1,
      explanation: "Manual override",
      isSelected: true,
      isManualOverride: true,
      matchedName: product.name,
      matchedPrice: product.price ?? null,
      matchedUnit: product.unit ?? null,
    })
    .returning();

  res.json(inserted);
});

// ─── Commercial offer export ─────────────────────────────────────────────────

router.post("/projects/:id/commercial-offers/export", async (req, res): Promise<void> => {
  const projectId = await resolveProjectId(req.params.id);
  if (projectId === null) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const parsed = ExportOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  const specItems = await db
    .select()
    .from(specItemsTable)
    .where(eq(specItemsTable.projectId, projectId))
    .orderBy(specItemsTable.sortOrder);

  const [run] = await db
    .select()
    .from(matchRunsTable)
    .where(eq(matchRunsTable.projectId, projectId))
    .orderBy(desc(matchRunsTable.startedAt))
    .limit(1);

  if (!run || specItems.length === 0) {
    res.status(400).json({ error: "Run matching and save spec items before exporting an offer." });
    return;
  }

  const allResults = await db
    .select()
    .from(matchResultsTable)
    .where(and(eq(matchResultsTable.runId, run.id), eq(matchResultsTable.isSelected, true)));

  const productIds = allResults
    .map((r) => r.catalogProductId)
    .filter((id): id is number => id != null);

  const products = productIds.length
    ? await db.select().from(catalogProductsTable).where(inArray(catalogProductsTable.id, productIds))
    : [];

  const productMap = new Map(products.map((p) => [p.id, p]));

  const inputs = specItems.map((spec) => {
    const result = allResults.find((r) => r.specItemId === spec.id) ?? null;
    const product = result?.catalogProductId ? productMap.get(result.catalogProductId) ?? null : null;
    return { specItem: spec, result, product, marginPercent: parsed.data.marginPercent };
  });

  const { lines, totalAmount } = buildOfferLines(inputs);
  const title = parsed.data.title ?? `Commercial Offer — ${project?.name ?? "Project"}`;

  const [offer] = await db
    .insert(commercialOffersTable)
    .values({
      projectId,
      title,
      marginPercent: parsed.data.marginPercent,
      lineCount: lines.length,
      totalAmount,
    })
    .returning();

  await db.insert(commercialOfferLinesTable).values(
    lines.map((line, idx) => ({
      offerId: offer.id,
      specItemId: specItems[idx]?.id ?? null,
      catalogProductId: inputs[idx]?.product?.id ?? null,
      lineNumber: line.lineNumber,
      itemName: line.itemName,
      matchedName: line.matchedName,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
  );

  const csv = buildOfferCsv(project?.name ?? "Project", lines, totalAmount);

  res.json({ offer, lines, csv, filename: `offer-project-${projectId}.csv` });
});

export default router;
