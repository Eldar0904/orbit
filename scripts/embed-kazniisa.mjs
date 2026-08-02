/**
 * Embed all КазНИИСА products using Jina AI embeddings.
 * Stores vectors in Supabase pgvector column.
 *
 * Usage:
 *   node scripts/embed-kazniisa.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
const JINA_API_KEY = process.env.JINA_API_KEY;

if (!DATABASE_URL) { console.error("❌ DATABASE_URL not set"); process.exit(1); }
if (!JINA_API_KEY) { console.error("❌ JINA_API_KEY not set in .env"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function embedBatch(texts) {
  const resp = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "jina-embeddings-v5-text-small",
      input: texts,
      task: "retrieval.passage",
      dimensions: 1024,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Jina API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  return data.data.map((d) => d.embedding);
}

function buildEmbedText(product) {
  return [product.code, product.name, product.group_name]
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);
}

async function main() {
  const client = await pool.connect();

  try {
    // Get all products without embeddings from current version
    const { rows: products } = await client.query(`
      SELECT p.id, p.code, p.name, p.group_name
      FROM kazniisa_products p
      JOIN kazniisa_versions v ON p.version_id = v.id
      WHERE v.is_current = true
        AND p.is_group_header = false
        AND p.embedding IS NULL
      ORDER BY p.id
    `);

    console.log(`📦 Found ${products.length} products to embed`);

    if (products.length === 0) {
      console.log("✅ All products already have embeddings!");
      return;
    }

    const batchSize = 50; // Jina allows up to 2048 per batch, but let's be gentle
    let embedded = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const texts = batch.map(buildEmbedText);

      try {
        const embeddings = await embedBatch(texts);

        // Update each product with its embedding
        for (let j = 0; j < batch.length; j++) {
          const vecStr = `[${embeddings[j].join(",")}]`;
          await client.query(
            `UPDATE kazniisa_products SET embedding = $1::vector WHERE id = $2`,
            [vecStr, batch[j].id],
          );
        }

        embedded += batch.length;
        if (embedded % 200 === 0 || embedded === products.length) {
          console.log(`  📝 ${embedded}/${products.length} embedded`);
        }
      } catch (err) {
        console.error(`  ⚠️ Batch ${i}-${i + batchSize} failed: ${err.message}`);
        // Wait and retry once
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const embeddings = await embedBatch(texts);
          for (let j = 0; j < batch.length; j++) {
            const vecStr = `[${embeddings[j].join(",")}]`;
            await client.query(
              `UPDATE kazniisa_products SET embedding = $1::vector WHERE id = $2`,
              [vecStr, batch[j].id],
            );
          }
          embedded += batch.length;
          console.log(`  ✅ Retry succeeded: ${embedded}/${products.length}`);
        } catch (retryErr) {
          console.error(`  ❌ Retry failed: ${retryErr.message}. Skipping batch.`);
        }
      }

      // Small delay to respect rate limits
      if (i + batchSize < products.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    console.log(`\n🎉 Done! ${embedded} products embedded.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
