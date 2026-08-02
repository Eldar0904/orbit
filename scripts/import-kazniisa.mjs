/**
 * Import КазНИИСА catalogue from JSON into Supabase.
 * Plain Node.js — no tsx/TypeScript needed.
 *
 * Usage:
 *   node scripts/import-kazniisa.mjs ./kazniisa_catalogue.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
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
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set. Check your .env file.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

function normalize(product) {
  const parts = [product.code, product.name, product.group_name].filter(Boolean);
  return parts
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: node scripts/import-kazniisa.mjs <path-to-json>");
    process.exit(1);
  }

  const fullPath = path.resolve(jsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`📄 Reading ${fullPath}...`);
  const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  console.log(`✅ Loaded: ${data.total_items} items, version: "${data.version}"`);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Mark all existing versions as not current
    await client.query("UPDATE kazniisa_versions SET is_current = false");

    // Create new version
    const versionResult = await client.query(
      `INSERT INTO kazniisa_versions (label, pdf_filename, is_current, product_count)
       VALUES ($1, $2, true, $3) RETURNING id`,
      [data.version, data.pdf_filename, data.products.length],
    );
    const versionId = versionResult.rows[0].id;
    console.log(`📦 Created version #${versionId}: "${data.version}"`);

    // Insert products in batches
    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < data.products.length; i += batchSize) {
      const batch = data.products.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];

      batch.forEach((p, idx) => {
        const offset = idx * 14;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`,
        );
        values.push(
          versionId,
          p.code,
          p.name,
          p.unit || null,
          p.cargo_class || null,
          p.weight_kg || null,
          p.estimated_price || null,
          p.retail_price || null,
          p.section_code,
          p.section_name,
          p.group_code || null,
          p.group_name || null,
          normalize(p),
          p.is_group_header,
        );
      });

      await client.query(
        `INSERT INTO kazniisa_products
         (version_id, code, name, unit, cargo_class, weight_kg, estimated_price, retail_price, section_code, section_name, group_code, group_name, normalized_text, is_group_header)
         VALUES ${placeholders.join(", ")}`,
        values,
      );

      inserted += batch.length;
      if (inserted % 500 === 0 || inserted === data.products.length) {
        console.log(`  📝 ${inserted}/${data.products.length} inserted`);
      }
    }

    await client.query("COMMIT");
    console.log(`\n🎉 Done! ${inserted} products imported as version #${versionId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Import failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
