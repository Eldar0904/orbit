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

// ─── AI Analyze: Summarize & categorize uploaded list ────────────────────────

const AnalyzeBody = z.object({
  filename: z.string().min(1),
  items: z.array(
    z.object({
      name: z.string().min(1),
      code: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      quantity: z.number().nullable().optional(),
    }),
  ).min(1),
});

router.post("/kazniisa/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!process.env.STEPFUN_API_KEY) {
    res.status(500).json({ error: "STEPFUN_API_KEY not configured" });
    return;
  }

  // Get available sections for context
  const [current] = await db
    .select()
    .from(kazniisaVersionsTable)
    .where(eq(kazniisaVersionsTable.isCurrent, true))
    .limit(1);

  const sections = current ? await db
    .select({
      sectionCode: kazniisaProductsTable.sectionCode,
      sectionName: kazniisaProductsTable.sectionName,
      count: sql<number>`count(*)::int`,
    })
    .from(kazniisaProductsTable)
    .where(and(
      eq(kazniisaProductsTable.versionId, current.id),
      eq(kazniisaProductsTable.isGroupHeader, false),
    ))
    .groupBy(kazniisaProductsTable.sectionCode, kazniisaProductsTable.sectionName) : [];

  const sectionList = sections.map(s => `- ${s.sectionCode}: ${s.sectionName} (${s.count} товаров)`).join("\n");

  // Build item list for AI (truncate if huge)
  const itemList = parsed.data.items.slice(0, 100).map((item, i) =>
    `${i + 1}. ${item.name}${item.quantity ? ` (${item.quantity} шт)` : ""}`
  ).join("\n");

  try {
    const llmResp = await fetch("https://api.stepfun.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.STEPFUN_API_KEY}`,
      },
      body: JSON.stringify({
        model: "step-3.7-flash",
        messages: [
          {
            role: "system",
            content: `You are a procurement analyst. Analyze the uploaded item list and respond in JSON format:
{
  "summary": "Brief description of the list (1-2 sentences, in Russian)",
  "organizationType": "kindergarten|school|university|hospital|office|other",
  "organizationTypeLabel": "Human-readable label in Russian (e.g. Детский сад)",
  "listType": "procurement|inventory|supplier_offer|internal_request|other",
  "listTypeLabel": "Human-readable label in Russian",
  "totalItems": number,
  "groups": [
    {
      "name": "Group name in Russian (e.g. Мебель детская)",
      "items": [indices of items, 0-based],
      "suggestedSection": "КазНИИСА section code or null",
      "suggestedSectionName": "section name or null"
    }
  ]
}

Available КазНИИСА catalogue sections:
${sectionList}

Group items by their functional category. Map each group to the most relevant КазНИИСА section.
Respond ONLY with valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `File: "${parsed.data.filename}"\n\nItems:\n${itemList}`
          },
        ],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    if (!llmResp.ok) {
      const errText = await llmResp.text();
      console.error("[analyze] StepFun error:", llmResp.status, errText);
      res.status(502).json({ error: `AI service error: ${llmResp.status}` });
      return;
    }

    const llmData = await llmResp.json();
    const content = llmData.choices?.[0]?.message?.content?.trim() ?? "";

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const analysis = JSON.parse(jsonStr);

    res.json({
      filename: parsed.data.filename,
      items: parsed.data.items,
      analysis,
    });
  } catch (err: any) {
    console.error("[analyze] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI Search: Find matches within a category for a group of items ─────────

const SearchBody = z.object({
  items: z.array(z.string()).min(1),
  sectionCode: z.string().nullable().optional(),
});

router.post("/kazniisa/ai-search", async (req, res): Promise<void> => {
  const parsed = SearchBody.safeParse(req.body);
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
    res.status(400).json({ error: "No catalogue loaded" });
    return;
  }

  // Get catalogue items from the suggested section (or all if no section)
  const conditions: any[] = [
    eq(kazniisaProductsTable.versionId, current.id),
    eq(kazniisaProductsTable.isGroupHeader, false),
  ];
  if (parsed.data.sectionCode) {
    conditions.push(eq(kazniisaProductsTable.sectionCode, parsed.data.sectionCode));
  }

  const catalogueItems = await db
    .select({ id: kazniisaProductsTable.id, code: kazniisaProductsTable.code, name: kazniisaProductsTable.name, unit: kazniisaProductsTable.unit, estimatedPrice: kazniisaProductsTable.estimatedPrice })
    .from(kazniisaProductsTable)
    .where(and(...conditions))
    .orderBy(kazniisaProductsTable.code);

  if (catalogueItems.length === 0) {
    res.json({ matches: [], message: "No products in this section" });
    return;
  }

  // Build catalogue list for AI (chunk if large)
  const catList = catalogueItems.map((p, i) =>
    `${i + 1}. [${p.code}] ${p.name} (${p.unit ?? "шт"}, ${p.estimatedPrice ?? "—"} тг)`
  ).join("\n");

  const itemList = parsed.data.items.map((name, i) => `${i + 1}. ${name}`).join("\n");

  if (!process.env.STEPFUN_API_KEY) {
    res.status(500).json({ error: "STEPFUN_API_KEY not configured" });
    return;
  }

  try {
    const llmResp = await fetch("https://api.stepfun.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.STEPFUN_API_KEY}`,
      },
      body: JSON.stringify({
        model: "step-3.7-flash",
        messages: [
          {
            role: "system",
            content: `You are a product matching assistant for КазНИИСА catalogue. Match requested items to catalogue products.

Respond in JSON format:
{
  "matches": [
    {
      "inputIndex": 0,
      "inputName": "original item name",
      "catalogueIndex": number (1-based from catalogue list),
      "confidence": "high"|"medium"|"low",
      "reason": "Brief explanation in Russian why this matches"
    }
  ],
  "unmatched": [indices of items with no good match],
  "notes": "Optional notes in Russian about the matching"
}

Rules:
- Match each input item to the BEST catalogue item (only one match per input)
- "high" = exact or near-exact product match
- "medium" = same type but different spec/size
- "low" = loosely related, user should verify
- If nothing in the catalogue fits, put the index in "unmatched"
- Respond ONLY with valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Items to match:\n${itemList}\n\nCatalogue (${catalogueItems.length} products):\n${catList}`
          },
        ],
        max_tokens: 3000,
        temperature: 0,
      }),
    });

    if (!llmResp.ok) {
      const errText = await llmResp.text();
      console.error("[ai-search] StepFun error:", llmResp.status, errText);
      res.status(502).json({ error: `AI service error: ${llmResp.status}` });
      return;
    }

    const llmData = await llmResp.json();
    const content = llmData.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonStr = content.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const result = JSON.parse(jsonStr);

    // Enrich matches with full product data
    const enriched = (result.matches ?? []).map((m: any) => {
      const catItem = catalogueItems[m.catalogueIndex - 1];
      return {
        ...m,
        product: catItem ?? null,
      };
    });

    res.json({
      matches: enriched,
      unmatched: result.unmatched ?? [],
      notes: result.notes ?? null,
    });
  } catch (err: any) {
    console.error("[ai-search] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
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
