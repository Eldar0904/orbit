/**
 * Import КазНИИСА catalogue from JSON into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-kazniisa.ts ./path/to/kazniisa_catalogue.json
 *
 * Or from the API server directory:
 *   npx tsx ../../scripts/import-kazniisa.ts ../../kazniisa_catalogue.json
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Product {
  code: string;
  name: string;
  unit: string | null;
  cargo_class: number | null;
  weight_kg: number | null;
  estimated_price: number | null;
  retail_price: number | null;
  section_code: string;
  section_name: string;
  group_code: string;
  group_name: string;
  is_group_header: boolean;
}

interface CatalogueData {
  version: string;
  pdf_filename: string;
  total_items: number;
  products: Product[];
}

function normalize(product: Product): string {
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
    console.error("Usage: npx tsx scripts/import-kazniisa.ts <path-to-json>");
    process.exit(1);
  }

  const fullPath = path.resolve(jsonPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`Reading ${fullPath}...`);
  const data: CatalogueData = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  console.log(`Loaded: ${data.total_items} items, version: "${data.version}"`);

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
    console.log(`Created version #${versionId}: "${data.version}"`);

    // Insert products in batches
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < data.products.length; i += batchSize) {
      const batch = data.products.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];

      batch.forEach((p, idx) => {
        const offset = idx * 14;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`,
        );
        values.push(
          versionId,
          p.code,
          p.name,
          p.unit,
          p.cargo_class,
          p.weight_kg,
          p.estimated_price,
          p.retail_price,
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
        console.log(`  ${inserted}/${data.products.length} inserted`);
      }
    }

    await client.query("COMMIT");
    console.log(`\n✅ Done! ${inserted} products imported as version #${versionId}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
