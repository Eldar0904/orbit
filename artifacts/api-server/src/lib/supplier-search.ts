import { z } from "zod/v4";

const SupplierSearchItemSchema = z.object({
  itemName: z.string().min(1),
  description: z.string().optional(),
});

export type SupplierSearchItem = z.infer<typeof SupplierSearchItemSchema>;

export interface SupplierSearchHit {
  itemName: string;
  supplierName: string;
  productName: string;
  website: string | null;
  notes: string;
  source: "gemini" | "demo";
}

/**
 * Search suppliers via Gemini + Google Search when GEMINI_API_KEY is set.
 * Falls back to demo placeholders so the UI flow works in dev.
 */
export async function searchSuppliersForItems(
  items: SupplierSearchItem[],
): Promise<SupplierSearchHit[]> {
  const parsed = z.array(SupplierSearchItemSchema).min(1).max(20).parse(items);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return parsed.map((item) => ({
      itemName: item.itemName,
      supplierName: "Demo Supplier (configure GEMINI_API_KEY)",
      productName: item.itemName,
      website: null,
      notes: "Set GEMINI_API_KEY on the API server for live AI supplier search.",
      source: "demo" as const,
    }));
  }

  const hits: SupplierSearchHit[] = [];

  for (const item of parsed) {
    try {
      const query = encodeURIComponent(
        `${item.itemName} ${item.description ?? ""} поставщик Казахстан закупка`,
      );
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Find B2B suppliers for fitout/furniture item: "${item.itemName}". Return JSON only: {"supplierName":"","productName":"","website":"","notes":""}. Focus on Kazakhstan/CIS market.`,
                },
              ],
            },
          ],
          tools: [{ google_search: {} }],
        }),
      });

      if (!res.ok) {
        hits.push(demoHit(item.itemName, `Gemini error ${res.status}`));
        continue;
      }

      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJson = JSON.parse(jsonMatch[0]) as {
          supplierName?: string;
          productName?: string;
          website?: string;
          notes?: string;
        };
        hits.push({
          itemName: item.itemName,
          supplierName: parsedJson.supplierName || "Unknown supplier",
          productName: parsedJson.productName || item.itemName,
          website: parsedJson.website || null,
          notes: parsedJson.notes || "",
          source: "gemini",
        });
      } else {
        hits.push(demoHit(item.itemName, text.slice(0, 200)));
      }

      await sleep(500);
    } catch (err) {
      hits.push(demoHit(item.itemName, err instanceof Error ? err.message : "Search failed"));
    }
  }

  return hits;
}

function demoHit(itemName: string, notes: string): SupplierSearchHit {
  return {
    itemName,
    supplierName: "Search pending",
    productName: itemName,
    website: null,
    notes,
    source: "demo",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
