const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const input = path.resolve(arg("--input", "codex_outputs/growth-v2/mission-005/production-read-only-evidence.json"));
const output = path.resolve(arg("--output", "outputs/mensskull-etsy-growth-v2/2026-08-13/mission-005"));
const TARGETS = new Set(["4432511462", "878616671"]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function csv(value) {
  if (value === null || value === undefined) return "UNKNOWN";
  const text = Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  const lines = [headers.map(csv).join(","), ...rows.map((row) => headers.map((key) => csv(row[key])).join(","))];
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return fs.readFileSync(file);
  let lastError;
  let buffer;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  if (!buffer) throw new Error(`Image download failed after 3 attempts: ${url}: ${lastError}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  return buffer;
}

async function main() {
  const evidence = JSON.parse(fs.readFileSync(input, "utf8"));
  if (!["API_HEALTHY", "API_RATE_LIMIT_RECOVERED"].includes(evidence.status)) {
    throw new Error(`Mission 005 production evidence is not healthy: ${evidence.status}`);
  }
  const dirs = ["SOURCE_IMAGES", "DERIVED_IMAGES", "D0_RAW", "POST_WRITE_RAW", "ROLLBACK"];
  for (const dir of dirs) fs.mkdirSync(path.join(output, dir), { recursive: true });
  fs.copyFileSync(input, path.join(output, "D0_RAW", "production-read-only-evidence.json"));

  const assetRows = [];
  const sourceRows = [];
  for (const listing of evidence.listings.filter((item) => TARGETS.has(String(item.listing_id)))) {
    writeJson(path.join(output, "D0_RAW", `${listing.listing_id}-listing.json`), listing.raw_listing);
    writeJson(path.join(output, "D0_RAW", `${listing.listing_id}-images.json`), listing.raw_images);
    writeJson(path.join(output, "D0_RAW", `${listing.listing_id}-inventory.json`), listing.inventory);
    const originals = [];
    for (const image of listing.images) {
      const extension = path.extname(new URL(image.url_fullxfull).pathname) || ".jpg";
      const filename = `rank_${String(image.rank).padStart(2, "0")}_${image.listing_image_id}${extension}`;
      const relative = path.join("SOURCE_IMAGES", String(listing.listing_id), "ORIGINAL_ETSY", filename);
      const absolute = path.join(output, relative);
      const buffer = await download(image.url_fullxfull, absolute);
      const row = {
        listing_id: listing.listing_id,
        listing_title: listing.title,
        asset_class: "CURRENT_ETSY_SOURCE_ASSET",
        listing_image_id: image.listing_image_id,
        rank: image.rank,
        full_width: image.full_width,
        full_height: image.full_height,
        alt_text: image.alt_text,
        url_fullxfull: image.url_fullxfull,
        local_path: absolute,
        sha256: sha256(buffer),
        bytes: buffer.length,
        downloaded_at: new Date().toISOString(),
      };
      assetRows.push(row);
      sourceRows.push({ ...row, source_tier: "A", truth_status: "VERIFIED_EXACT_LISTING" });
      originals.push(row);
    }
    const rollback = {
      mission: "ETSY_GROWTH_V2_005",
      listing_id: listing.listing_id,
      captured_at: listing.captured_at,
      method: "DELETE_EXPERIMENT_IMAGES_THEN_VERIFY_ORIGINAL_IDS_AND_ORDER",
      original_image_count: originals.length,
      original_images: originals.map((row) => ({
        listing_image_id: row.listing_image_id,
        rank: row.rank,
        local_path: row.local_path,
        sha256: row.sha256,
        url_fullxfull: row.url_fullxfull,
      })),
    };
    rollback.integrity_sha256 = sha256(Buffer.from(JSON.stringify(rollback)));
    writeJson(path.join(output, "ROLLBACK", `${listing.listing_id}-original-image-stack.json`), rollback);
  }

  const columns = [
    "listing_id", "listing_title", "asset_class", "listing_image_id", "rank", "full_width", "full_height",
    "alt_text", "url_fullxfull", "local_path", "sha256", "bytes", "downloaded_at",
  ];
  writeCsv(path.join(output, "ETSY_GROWTH_V2_005_CURRENT_ETSY_ASSETS.csv"), columns, assetRows);
  writeCsv(
    path.join(output, "ETSY_GROWTH_V2_005_SOURCE_ASSET_MANIFEST.csv"),
    [...columns, "source_tier", "truth_status"],
    sourceRows,
  );
  writeJson(path.join(output, "SOURCE_IMAGES", "download-summary.json"), {
    mission: "ETSY_GROWTH_V2_005",
    downloaded_at: new Date().toISOString(),
    source: "CURRENT_ETSY_SOURCE_ASSET",
    listing_count: 2,
    image_count: assetRows.length,
    integrity_sha256: sha256(Buffer.from(JSON.stringify(assetRows))),
  });
  process.stdout.write(`${JSON.stringify({ output, images: assetRows.length }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
