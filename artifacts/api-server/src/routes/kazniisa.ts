import { Router, type IRouter } from "express";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";
import {
  db,
  kazniisaVersionsTable,
  kazniisaProductsTable,
  kazniisaMatchSessionsTable,
  kazniisaMatchResultsTable,
} from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

// ─── Sections (distinct section codes from current version) ─────────────────

router.get("/kazniisa/sections", async (_req, res): Promise<void> => {
  const [current] = await db
    .select()
    .from(kazniisaVersionsTable)
    .where(eq(kazniisaVersionsTable.isCurrent, true))
    .limit(1);

  if (!current) {
    res.json({ version: null, sections: [] });
    return;
  }

  const sections = await db
    .select({
      sectionCode: kazniisaProductsTable.sectionCode,
      sectionName: kazniisaProductsTable.sectionName,
      count: sql<number>`count(*)::int`,
    })
    .from(kazniisaProductsTable)
    .where(
      and(
        eq(kazniisaProductsTable.versionId, current.id),
        eq(kazniisaProductsTable.isGroupHeader, false),
      ),
    )
    .groupBy(kazniisaProductsTable.sectionCode, kazniisaProductsTable.sectionName);

  res.json({ version: current, sections });
});

// ─── Products (paginated, filterable) ───────────────────────────────────────

router.get("/kazniisa/products", async (req, res): Promise<void> => {
  const [current] = await db
    .select()
    .from(kazniisaVersionsTable)
    .where(eq(kazniisaVersionsTable.isCurrent, true))
    .limit(1);

  if (!current) {
    res.json({ products: [], total: 0 });
    return;
  }

  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const section = typeof req.query.section === "string" ? req.query.section.trim() : "";
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

  const conditions = [
    eq(kazniisaProductsTable.versionId, current.id),
    eq(kazniisaProductsTable.isGroupHeader, false),
  ];

  if (section) {
    conditions.push(eq(kazniisaProductsTable.sectionCode, section));
  }

  if (search) {
    conditions.push(
      or(
        ilike(kazniisaProductsTable.name, `%${search}%`),
        ilike(kazniisaProductsTable.code, `%${search}%`),
      )!,
    );
  }

  const products = await db
    .select()
    .from(kazniisaProductsTable)
    .where(and(...conditions))
    .orderBy(kazniisaProductsTable.code)
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(kazniisaProductsTable)
    .where(and(...conditions));

  res.json({ products, total });
});

// ─── Single product by code ─────────────────────────────────────────────────

router.get("/kazniisa/products/:code", async (req, res): Promise<void> => {
  const [current] = await db
    .select()
    .from(kazniisaVersionsTable)
    .where(eq(kazniisaVersionsTable.isCurrent, true))
    .limit(1);

  if (!current) {
    res.status(404).json({ error: "No catalogue loaded" });
    return;
  }

  const [product] = await db
    .select()
    .from(kazniisaProductsTable)
    .where(
      and(
        eq(kazniisaProductsTable.versionId, current.id),
        eq(kazniisaProductsTable.code, req.params.code),
      ),
    );

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(product);
});

// ─── Match endpoint ─────────────────────────────────────────────────────────

const MatchBody = z.object({
  filename: z.string().min(1),
  items: z.array(
    z.object({
      name: z.string().min(1),
      code: z.string().nullable().optional(),
    }),
  ).min(1),
});

router.post("/kazniisa/match", async (req, res): Promise<void> => {
  const parsed = MatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(kazniisaVersionsTable)
    .where(eq(kazniisaVersionsTable.isCurrent, true))
    .limit(1);

  if (!current) {
    res.status(400).json({ error: "No catalogue loaded. Import a PDF first." });
    return;
  }

  // Create session
  const [session] = await db
    .insert(kazniisaMatchSessionsTable)
    .values({
      versionId: current.id,
      filename: parsed.data.filename,
      itemCount: parsed.data.items.length,
    })
    .returning();

  let matchedCount = 0;
  let reviewCount = 0;
  let noMatchCount = 0;

  const results: any[] = [];

  for (const item of parsed.data.items) {
    const normalizedQuery = item.name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalizedQuery) {
      noMatchCount++;
      results.push({ input: item.name, candidates: [] });
      continue;
    }

    const safeCode = item.code?.trim().toLowerCase() ?? "";
    const hasCode = safeCode.length > 0;

    try {
      const candidates = await db.execute<{
        id: number;
        code: string;
        name: string;
        unit: string | null;
        weight_kg: number | null;
        estimated_price: number | null;
        description: string | null;
        image_url: string | null;
        section_name: string | null;
        score: number;
      }>(sql`
        SELECT
          p.id, p.code, p.name, p.unit, p.weight_kg, p.estimated_price,
          p.description, p.image_url, p.section_name,
          (
            COALESCE(similarity(p.normalized_text, ${normalizedQuery}), 0) * 0.55
            + LEAST(COALESCE(ts_rank(
                to_tsvector('simple', COALESCE(p.normalized_text, '')),
                plainto_tsquery('simple', ${normalizedQuery})
              ), 0) * 2.5, 1.0) * 0.30
            + CASE WHEN ${hasCode} AND p.code IS NOT NULL
                   AND lower(trim(p.code)) = ${safeCode}
              THEN 1.0 ELSE 0.0 END * 0.15
          ) AS score
        FROM kazniisa_products p
        WHERE p.version_id = ${current.id}
          AND p.is_group_header = false
          AND (
            p.normalized_text % ${normalizedQuery}
            OR to_tsvector('simple', COALESCE(p.normalized_text, ''))
               @@ plainto_tsquery('simple', ${normalizedQuery})
            ${hasCode ? sql`OR lower(trim(p.code)) = ${safeCode}` : sql``}
          )
        ORDER BY score DESC
        LIMIT 3
      `);

      const rows = (candidates.rows ?? candidates ?? []) as any[];
      const filtered = rows.filter((r: any) => r.score >= 0.70);

      if (filtered.length > 0 && filtered[0].score >= 0.90) {
        matchedCount++;
      } else if (filtered.length > 0) {
        reviewCount++;
      } else {
        noMatchCount++;
      }

      // Save results to DB
      for (const [idx, row] of filtered.entries()) {
        await db.insert(kazniisaMatchResultsTable).values({
          sessionId: session.id,
          inputName: item.name,
          inputCode: item.code ?? null,
          rank: (idx + 1) as any,
          productId: row.id,
          confidence: row.score,
          status: row.score >= 0.90 ? "matched" : "review",
        });
      }

      if (filtered.length === 0) {
        await db.insert(kazniisaMatchResultsTable).values({
          sessionId: session.id,
          inputName: item.name,
          inputCode: item.code ?? null,
          rank: 1,
          productId: null,
          confidence: 0,
          status: "no_match",
        });
      }

      results.push({
        input: item.name,
        candidates: filtered.map((row: any, idx: number) => ({
          rank: idx + 1,
          productId: row.id,
          code: row.code,
          name: row.name,
          unit: row.unit,
          price: row.estimated_price,
          description: row.description,
          imageUrl: row.image_url,
          sectionName: row.section_name,
          confidence: Math.round(row.score * 100),
        })),
      });
    } catch (err: any) {
      noMatchCount++;
      results.push({ input: item.name, candidates: [], error: err.message?.slice(0, 100) });
    }
  }

  // Update session counts
  await db
    .update(kazniisaMatchSessionsTable)
    .set({ matchedCount, reviewCount, noMatchCount })
    .where(eq(kazniisaMatchSessionsTable.id, session.id));

  res.json({
    sessionId: session.id,
    filename: parsed.data.filename,
    total: parsed.data.items.length,
    matched: matchedCount,
    review: reviewCount,
    noMatch: noMatchCount,
    results,
  });
});

// ─── Match sessions (history) ───────────────────────────────────────────────

router.get("/kazniisa/sessions", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(kazniisaMatchSessionsTable)
    .orderBy(desc(kazniisaMatchSessionsTable.createdAt))
    .limit(50);
  res.json(sessions);
});

router.get("/kazniisa/sessions/:id/results", async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.id, 10);
  if (Number.isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const results = await db
    .select()
    .from(kazniisaMatchResultsTable)
    .where(eq(kazniisaMatchResultsTable.sessionId, sessionId))
    .orderBy(kazniisaMatchResultsTable.id);

  res.json(results);
});

// ─── Update match decision ──────────────────────────────────────────────────

const DecisionBody = z.object({
  decision: z.enum(["confirmed", "rejected"]),
});

router.patch("/kazniisa/results/:id", async (req, res): Promise<void> => {
  const resultId = parseInt(req.params.id, 10);
  const parsed = DecisionBody.safeParse(req.body);
  if (Number.isNaN(resultId) || !parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [updated] = await db
    .update(kazniisaMatchResultsTable)
    .set({ userDecision: parsed.data.decision })
    .where(eq(kazniisaMatchResultsTable.id, resultId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Result not found" });
    return;
  }

  res.json(updated);
});

// ─── Versions ───────────────────────────────────────────────────────────────

router.get("/kazniisa/versions", async (_req, res): Promise<void> => {
  const versions = await db
    .select()
    .from(kazniisaVersionsTable)
    .orderBy(desc(kazniisaVersionsTable.importedAt));
  res.json(versions);
});

export default router;
