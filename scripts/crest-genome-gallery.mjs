import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  composeCrestGenome,
  createCrestGenomeContactSheet,
  validateCrestGenomeOutput
} from "../packages/domain/dist/crest-genome/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "apps", "web", "public", "review", "crest-genome");

const groups = [
  {
    id: "continuity-unity",
    title: "Continuity / Unity",
    themes: ["continuity", "unity"],
    symbols: ["tree", "knot", "roots", "ring"],
    file: "crest-genome-contact-sheet-continuity-unity.png"
  },
  {
    id: "memory-wisdom",
    title: "Memory / Wisdom",
    themes: ["memory", "wisdom"],
    symbols: ["book", "lantern", "north_star", "candle"],
    file: "crest-genome-contact-sheet-memory-wisdom.png"
  },
  {
    id: "resilience-journey",
    title: "Resilience / Journey",
    themes: ["resilience", "journey"],
    symbols: ["mountain", "compass", "north_star", "bridge"],
    file: "crest-genome-contact-sheet-resilience-journey.png"
  },
  {
    id: "gratitude-love",
    title: "Gratitude / Love / Unity",
    themes: ["gratitude", "love", "unity"],
    symbols: ["laurel", "ring", "knot", "ribbon"],
    file: "crest-genome-contact-sheet-gratitude-love.png"
  },
  {
    id: "protection-home",
    title: "Protection / Home / Belonging",
    themes: ["protection", "home", "belonging"],
    symbols: ["key", "shield", "branch", "bridge"],
    file: "crest-genome-contact-sheet-protection-home.png"
  }
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const allSamples = [];
const knownSignatures = new Set();

for (const group of groups) {
  const groupDir = path.join(outputDir, group.id);
  await mkdir(groupDir, { recursive: true });
  const buffers = [];
  for (let index = 1; index <= 50; index += 1) {
    const output = composeCrestGenome({
      meaning_themes: group.themes,
      selected_symbols: group.symbols,
      order_seed: `${group.id}-${index.toString().padStart(2, "0")}`,
      seed_salt: `review-v1-${group.id}-${index.toString().padStart(2, "0")}`,
      variant: index % 7 === 0 ? "print" : index % 5 === 0 ? "close" : "primary"
    });
    const quality = validateCrestGenomeOutput(output, knownSignatures);
    knownSignatures.add(output.visual_signature);
    const fileName = `${group.id}-${index.toString().padStart(2, "0")}.png`;
    await writeFile(path.join(groupDir, fileName), output.pngBuffer);
    buffers.push(output.pngBuffer);
    allSamples.push({
      group: group.id,
      title: group.title,
      file: `${group.id}/${fileName}`,
      template_id: output.manifest.template_id,
      frame_id: output.manifest.frame_id,
      field_layout_id: output.manifest.field_layout_id,
      main_symbol: output.manifest.primary_symbol_id,
      supporting_symbols: output.manifest.secondary_symbol_ids,
      themes: output.manifest.meaning_themes,
      seed: `${group.id}-${index.toString().padStart(2, "0")}`,
      visual_signature: output.visual_signature,
      quality
    });
  }
  await writeFile(path.join(outputDir, group.file), createCrestGenomeContactSheet(buffers, 10, 180));
}

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify({ generated_at: new Date().toISOString(), sample_count: allSamples.length, groups, samples: allSamples }, null, 2)}\n`);
await writeFile(path.join(outputDir, "index.html"), renderHtml(allSamples));

console.log(`Crest Genome gallery generated: ${outputDir}`);
console.log(`Samples: ${allSamples.length}`);

function renderHtml(samples) {
  const grouped = groups
    .map((group) => {
      const groupSamples = samples.filter((sample) => sample.group === group.id);
      return `<section>
  <div class="section-heading">
    <div>
      <p class="eyebrow">Crest Genome Review</p>
      <h2>${escapeHtml(group.title)}</h2>
    </div>
    <a href="./${group.file}">Open contact sheet</a>
  </div>
  <div class="grid">
    ${groupSamples
      .map(
        (sample) => `<article class="card">
      <a href="./${sample.file}"><img src="./${sample.file}" alt="${escapeHtml(sample.title)} crest sample" loading="lazy"></a>
      <dl>
        <div><dt>Template</dt><dd>${escapeHtml(sample.template_id)}</dd></div>
        <div><dt>Frame</dt><dd>${escapeHtml(sample.frame_id)}</dd></div>
        <div><dt>Main</dt><dd>${escapeHtml(sample.main_symbol)}</dd></div>
        <div><dt>Supporting</dt><dd>${escapeHtml(sample.supporting_symbols.join(", "))}</dd></div>
        <div><dt>Themes</dt><dd>${escapeHtml(sample.themes.join(", "))}</dd></div>
        <div><dt>Seed</dt><dd>${escapeHtml(sample.seed)}</dd></div>
        <div><dt>Signature</dt><dd>${escapeHtml(sample.visual_signature.slice(0, 18))}</dd></div>
      </dl>
    </article>`
      )
      .join("\n")}
  </div>
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MyKinLegacy Crest Genome Review</title>
  <style>
    :root { color-scheme: dark; --bg:#090807; --panel:#15110d; --line:#40301a; --gold:#d9ad5c; --ivory:#f3ead8; --muted:#b9a98b; }
    body { margin:0; background:radial-gradient(circle at top,#1a130b 0,#090807 48%,#050504 100%); color:var(--ivory); font:14px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { max-width:1180px; margin:0 auto; padding:48px 20px 24px; }
    h1 { margin:0; font-family:Georgia, serif; font-size:clamp(34px,5vw,64px); font-weight:500; letter-spacing:.01em; }
    h2 { margin:0; font-family:Georgia, serif; font-size:30px; font-weight:500; }
    .eyebrow { color:var(--gold); text-transform:uppercase; letter-spacing:.16em; font-size:12px; margin:0 0 10px; }
    .intro { max-width:760px; color:var(--muted); font-size:16px; }
    section { max-width:1180px; margin:0 auto; padding:28px 20px 54px; }
    .section-heading { display:flex; justify-content:space-between; gap:18px; align-items:end; border-top:1px solid var(--line); padding-top:28px; margin-bottom:18px; }
    a { color:var(--gold); text-decoration:none; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; }
    .card { background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015)); border:1px solid rgba(217,173,92,.28); border-radius:8px; padding:10px; box-shadow:0 18px 48px rgba(0,0,0,.28); }
    img { width:100%; display:block; border-radius:6px; background:#090807; }
    dl { margin:10px 0 0; display:grid; gap:5px; color:var(--muted); font-size:11px; }
    dt { color:var(--gold); float:left; min-width:70px; }
    dd { margin:0; word-break:break-word; }
    .note { border:1px solid var(--line); border-radius:8px; padding:14px; color:var(--muted); background:rgba(255,255,255,.03); }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Internal visual review only</p>
    <h1>MyKinLegacy Crest Genome Library V1</h1>
    <p class="intro">These 250 deterministic samples are not customer data and are not production artifacts. Review them for visual direction, symbolic clarity, repetition, density, and gift-worthiness.</p>
    <p class="note">Do not link from public navigation. No customer PII, order tokens, vault tokens, or secrets are included.</p>
  </header>
  ${grouped}
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
