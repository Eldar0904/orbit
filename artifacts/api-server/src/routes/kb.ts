import { Router, type IRouter } from "express";
import { eq, and, ilike, or, sql, inArray } from "drizzle-orm";
import {
  db,
  suppliersTable,
  catalogSourcesTable,
  catalogVersionsTable,
  catalogProductsTable,
} from "@workspace/db";
import { z } from "zod/v4";
import { buildProductNormalizedText } from "../lib/kb-normalize.js";
import { parseCatalogRows, type ParsedCatalogRow } from "../lib/kb-import.js";
import { searchSuppliersForItems } from "../lib/supplier-search.js";

const router: IRouter = Router();

const SupplierBody = z.object({
  name: z.string().min(1),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  sourceType: z.string().optional(),
});

const SourceBody = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  kind: z.enum(["government", "supplier", "internal"]).optional(),
  supplierId: z.number().int().positive().nullable().optional(),
});

const ImportBody = z.object({
  versionLabel: z.string().optional(),
  mode: z.enum(["upsert", "replace"]).default("upsert"),
  items: z.array(
    z.object({
      code: z.string().nullable().optional(),
      name: z.string().min(1),
      brand: z.string().nullable().optional(),
      model: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      technicalSpecs: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      price: z.number().nullable().optional(),
      categoryCode: z.string().nullable().optional(),
      categoryName: z.string().nullable().optional(),
    }),
  ).min(1),
});

const SupplierSearchBody = z.object({
  items: z.array(z.object({
    itemName: z.string().min(1),
    description: z.string().optional(),
  })).min(1).max(20),
  createCatalogSource: z.boolean().optional(),
});

async function upsertProducts(
  sourceId: number,
  versionId: number,
  items: ParsedCatalogRow[],
  mode: "upsert" | "replace",
): Promise<number> {
  if (mode === "replace") {
    await db
      .delete(catalogProductsTable)
      .where(eq(catalogProductsTable.sourceId, sourceId));

    // Replacement is the standalone upload path. Bulk insert keeps this
    // serverless request well below Vercel's 30-second function timeout.
    if (items.length > 0) {
      await db.insert(catalogProductsTable).values(
        items.map((item) => ({
          sourceId,
          versionId,
          code: item.code ?? null,
          name: item.name,
          brand: item.brand ?? null,
          model: item.model ?? null,
          description: item.description ?? null,
          technicalSpecs: item.technicalSpecs ?? null,
          unit: item.unit ?? null,
          price: item.price ?? null,
          categoryCode: item.categoryCode ?? null,
          categoryName: item.categoryName ?? null,
          normalizedText: buildProductNormalizedText(item),
        })),
      );
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(catalogProductsTable)
        .where(and(eq(catalogProductsTable.sourceId, sourceId), eq(catalogProductsTable.isActive, true)));
      await db
        .update(catalogSourcesTable)
        .set({ productCount: total, updatedAt: new Date() })
        .where(eq(catalogSourcesTable.id, sourceId));
      return items.length;
    }
  }

  let count = 0;
  for (const item of items) {
    const normalizedText = buildProductNormalizedText(item);
    const existing = item.code
      ? await db
          .select({ id: catalogProductsTable.id })
          .from(catalogProductsTable)
          .where(
            and(
              eq(catalogProductsTable.sourceId, sourceId),
              eq(catalogProductsTable.code, item.code),
            ),
          )
          .limit(1)
      : [];

    if (existing.length > 0) {
      await db
        .update(catalogProductsTable)
        .set({
          versionId,
          name: item.name,
          brand: item.brand ?? null,
          model: item.model ?? null,
          description: item.description ?? null,
          technicalSpecs: item.technicalSpecs ?? null,
          unit: item.unit ?? null,
          price: item.price ?? null,
          categoryCode: item.categoryCode ?? null,
          categoryName: item.categoryName ?? null,
          normalizedText,
          updatedAt: new Date(),
        })
        .where(eq(catalogProductsTable.id, existing[0].id));
    } else {
      await db.insert(catalogProductsTable).values({
        sourceId,
        versionId,
        code: item.code ?? null,
        name: item.name,
        brand: item.brand ?? null,
        model: item.model ?? null,
        description: item.description ?? null,
        technicalSpecs: item.technicalSpecs ?? null,
        unit: item.unit ?? null,
        price: item.price ?? null,
        categoryCode: item.categoryCode ?? null,
        categoryName: item.categoryName ?? null,
        normalizedText,
      });
    }
    count++;
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(catalogProductsTable)
    .where(and(eq(catalogProductsTable.sourceId, sourceId), eq(catalogProductsTable.isActive, true)));

  await db
    .update(catalogSourcesTable)
    .set({ productCount: total, updatedAt: new Date() })
    .where(eq(catalogSourcesTable.id, sourceId));

  return count;
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

router.get("/kb/suppliers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(suppliersTable).orderBy(suppliersTable.name);
  res.json(rows);
});

router.post("/kb/suppliers", async (req, res): Promise<void> => {
  const parsed = SupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(suppliersTable).values({
    ...parsed.data,
    sourceType: parsed.data.sourceType ?? "manual",
    updatedAt: new Date(),
  }).returning();
  res.status(201).json(row);
});

router.patch("/kb/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = SupplierBody.partial().safeParse(req.body);
  if (!parsed.success || Number.isNaN(id)) {
    res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message });
    return;
  }
  const [row] = await db
    .update(suppliersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(suppliersTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(row);
});

router.delete("/kb/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(suppliersTable).where(eq(suppliersTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.sendStatus(204);
});

// ─── Catalog sources ─────────────────────────────────────────────────────────

router.get("/kb/sources", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(catalogSourcesTable)
    .where(eq(catalogSourcesTable.isArchived, false))
    .orderBy(catalogSourcesTable.name);
  res.json(rows);
});

router.post("/kb/sources", async (req, res): Promise<void> => {
  const parsed = SourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(catalogSourcesTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    kind: parsed.data.kind ?? "supplier",
    supplierId: parsed.data.supplierId ?? null,
    updatedAt: new Date(),
  }).returning();
  res.status(201).json(row);
});

router.patch("/kb/sources/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const parsed = SourceBody.partial().extend({
    isEnabled: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success || Number.isNaN(id)) {
    res.status(400).json({ error: parsed.success ? "Invalid id" : parsed.error.message });
    return;
  }
  const [row] = await db
    .update(catalogSourcesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(catalogSourcesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Source not found" });
    return;
  }
  res.json(row);
});

router.post("/kb/sources/:id/import", async (req, res): Promise<void> => {
  const sourceId = parseInt(req.params.id, 10);
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success || Number.isNaN(sourceId)) {
    res.status(400).json({ error: parsed.success ? "Invalid source id" : parsed.error.message });
    return;
  }

  const [source] = await db.select().from(catalogSourcesTable).where(eq(catalogSourcesTable.id, sourceId));
  if (!source) {
    res.status(404).json({ error: "Source not found" });
    return;
  }

  const versionLabel = parsed.data.versionLabel ?? new Date().toISOString().slice(0, 7);
  let [version] = await db
    .select()
    .from(catalogVersionsTable)
    .where(and(eq(catalogVersionsTable.sourceId, sourceId), eq(catalogVersionsTable.label, versionLabel)));

  if (!version) {
    await db
      .update(catalogVersionsTable)
      .set({ isCurrent: false })
      .where(eq(catalogVersionsTable.sourceId, sourceId));
    [version] = await db
      .insert(catalogVersionsTable)
      .values({ sourceId, label: versionLabel, isCurrent: true })
      .returning();
  }

  const imported = await upsertProducts(sourceId, version.id, parsed.data.items, parsed.data.mode);
  const [updated] = await db.select().from(catalogSourcesTable).where(eq(catalogSourcesTable.id, sourceId));
  res.json({ source: updated, version, imported });
});

router.post("/kb/sources/:id/import-parse", async (req, res): Promise<void> => {
  const parsed = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const items = parseCatalogRows(parsed.data.rows);
  res.json({ items, count: items.length });
});

router.get("/kb/sources/:id/products", async (req, res): Promise<void> => {
  const sourceId = parseInt(req.params.id, 10);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);

  if (Number.isNaN(sourceId)) {
    res.status(400).json({ error: "Invalid source id" });
    return;
  }

  const conditions = [eq(catalogProductsTable.sourceId, sourceId), eq(catalogProductsTable.isActive, true)];
  if (search) {
    conditions.push(
      or(
        ilike(catalogProductsTable.name, `%${search}%`),
        ilike(catalogProductsTable.code, `%${search}%`),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(catalogProductsTable)
    .where(and(...conditions))
    .limit(limit);

  res.json(rows);
});

router.get("/kb/products/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length < 2) {
    res.json([]);
    return;
  }
  const sourceIds = typeof req.query.sourceIds === "string"
    ? req.query.sourceIds.split(",").map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n))
    : [];

  const conditions = [
    eq(catalogProductsTable.isActive, true),
    or(
      ilike(catalogProductsTable.name, `%${q}%`),
      ilike(catalogProductsTable.code, `%${q}%`),
    )!,
  ];
  if (sourceIds.length > 0) {
    conditions.push(inArray(catalogProductsTable.sourceId, sourceIds));
  }

  const rows = await db
    .select()
    .from(catalogProductsTable)
    .where(and(...conditions))
    .limit(30);

  res.json(rows);
});

// ─── AI supplier search ──────────────────────────────────────────────────────

router.post("/kb/supplier-search", async (req, res): Promise<void> => {
  const parsed = SupplierSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hits = await searchSuppliersForItems(parsed.data.items);

  if (parsed.data.createCatalogSource) {
    for (const hit of hits) {
      if (hit.source !== "gemini") continue;
      let [supplier] = await db
        .select()
        .from(suppliersTable)
        .where(eq(suppliersTable.name, hit.supplierName))
        .limit(1);
      if (!supplier) {
        [supplier] = await db.insert(suppliersTable).values({
          name: hit.supplierName,
          website: hit.website,
          notes: hit.notes,
          sourceType: "ai",
          updatedAt: new Date(),
        }).returning();
      }

      const sourceName = `${hit.supplierName} (AI)`;
      let [source] = await db
        .select()
        .from(catalogSourcesTable)
        .where(eq(catalogSourcesTable.name, sourceName))
        .limit(1);

      if (!source) {
        [source] = await db.insert(catalogSourcesTable).values({
          name: sourceName,
          kind: "supplier",
          supplierId: supplier.id,
          description: "Created from AI supplier search",
          updatedAt: new Date(),
        }).returning();
      }

      const [version] = await db
        .insert(catalogVersionsTable)
        .values({ sourceId: source.id, label: "ai-import", isCurrent: true })
        .returning();

      await db.insert(catalogProductsTable).values({
        sourceId: source.id,
        versionId: version.id,
        name: hit.productName,
        normalizedText: buildProductNormalizedText({ name: hit.productName }),
      });

      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(catalogProductsTable)
        .where(eq(catalogProductsTable.sourceId, source.id));

      await db
        .update(catalogSourcesTable)
        .set({ productCount: total, updatedAt: new Date() })
        .where(eq(catalogSourcesTable.id, source.id));
    }
  }

  res.json({ hits });
});

export default router;
