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
      description: z.string().nullable().optional(),
      searchText: z.string().nullable().optional(),
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
    // Combine name + description + searchText for better matching
    const queryParts = [item.name, item.description, item.searchText].filter(Boolean).join(" ");
    const queryText = queryParts.slice(0, 300);

    if (!queryText.trim()) {
      noMatchCount++;
      results.push({ input: item.name, candidates: [] });
      continue;
    }

    const normalizedQuery = queryText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    try {
      // Step 1: Get top 10 rough candidates via ILIKE + FTS (reliable for Cyrillic)
      // Extract key words (2+ chars) for ILIKE matching
      const words = normalizedQuery.split(" ").filter((w: string) => w.length >= 2).slice(0, 5);
      const ilikeClauses = words.map((w: string) => `p.normalized_text ILIKE '%${w.replace(/'/g, "''")}%'`);
      const whereFilter = ilikeClauses.length > 0
        ? `(${ilikeClauses.join(" OR ")} OR to_tsvector('simple', COALESCE(p.normalized_text, '')) @@ plainto_tsquery('simple', '${normalizedQuery.replace(/'/g, "''")}'))`
        : `to_tsvector('simple', COALESCE(p.normalized_text, '')) @@ plainto_tsquery('simple', '${normalizedQuery.replace(/'/g, "''")}')`;

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
          COALESCE(similarity(p.normalized_text, ${normalizedQuery}), 0) AS score
        FROM kazniisa_products p
        WHERE p.version_id = ${current.id}
          AND p.is_group_header = false
          AND ${sql.raw(whereFilter)}
        ORDER BY similarity(p.normalized_text, ${normalizedQuery}) DESC
        LIMIT 10
      `);

      const rows = (candidates.rows ?? candidates ?? []) as any[];

      // Step 2: If we have candidates, ask StepFun to pick the best matches
      let finalCandidates = rows.slice(0, 3); // fallback: just use top 3 from pg_trgm
      let llmPicked = false;

      if (rows.length > 0 && process.env.STEPFUN_API_KEY) {
        try {
          const candidateList = rows.slice(0, 10).map((r: any, i: number) =>
            `${i + 1}. [${r.code}] ${r.name}`
          ).join("\n");

          const llmResp = await fetch("https://api.stepfun.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.STEPFUN_API_KEY}`,
            },
            body: JSON.stringify({
              model: "step-3.7-flash",
              messages: [
                { role: "system", content: "You are a product matching assistant. Given a requested item and a list of catalogue candidates, return ONLY the numbers (1-based) of the top 3 best matches, comma-separated. If fewer than 3 match, return fewer. If nothing matches well, return 'none'. Only output numbers or 'none', nothing else." },
                { role: "user", content: `Requested item: "${item.name}"\n${item.description ? `Description: ${item.description}\n` : ""}Catalogue candidates:\n${candidateList}` },
              ],
              max_tokens: 20,
              temperature: 0,
            }),
          });

          if (llmResp.ok) {
            const llmData = await llmResp.json();
            const answer = llmData.choices?.[0]?.message?.content?.trim() ?? "";
            if (answer && answer !== "none") {
              const picks = answer.match(/\d+/g)?.map(Number).filter((n: number) => n >= 1 && n <= rows.length) ?? [];
              if (picks.length > 0) {
                finalCandidates = picks.slice(0, 3).map((idx: number) => rows[idx - 1]);
                llmPicked = true;
              }
            }
          }
        } catch {
          // LLM failed, fall back to pg_trgm top 3
        }
      }

      const filtered = finalCandidates.filter((r: any) => r != null);

      if (filtered.length > 0 && llmPicked) {
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
          status: llmPicked ? "matched" : "review",
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
