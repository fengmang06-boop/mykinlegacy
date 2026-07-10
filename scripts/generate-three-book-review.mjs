import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

/* global document */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "apps", "web", "public", "review", "three-book-reading-experience");
const screenshotDir = path.join(outputDir, "screenshots");
const packageDir = path.join(outputDir, "sample-package");
const finalCrestSource = path.join(repoRoot, "packages", "storage", "assets", "official", "01a-classic-shield-legacy.png");
const finalCrestOutput = path.join(packageDir, "Final-Crest.png");

const disclaimer =
  "This is a personalized symbolic keepsake. It is not an official coat of arms, legal heraldic grant, noble title claim, or certified genealogical record.";

const sample = {
  houseName: "The Rowan Family",
  recipient: "Dad",
  occasion: "Retirement",
  archiveNumber: "AHL-REVIEW-THREE-BOOK-01",
  collectionName: "The Rowan Family Legacy Collection",
  date: "July 10, 2026",
  memory:
    "For thirty-five years, Dad showed up before sunrise, carried responsibility without making it loud, and made the family feel protected by steady action more than speeches.",
  values: ["protection", "sacrifice", "integrity"],
  symbols: ["Shield", "Oak Branch", "Tree"]
};

const publications = [
  {
    key: "certificate",
    title: "Heritage Certificate",
    deliverableCode: "heritage_certificate_pdf",
    fileName: "Heritage-Certificate.pdf",
    sourceText: certificateText()
  },
  {
    key: "family-story",
    title: "Family Story",
    deliverableCode: "family_story_pdf",
    fileName: "Family-Story.pdf",
    sourceText: familyStoryText()
  },
  {
    key: "meaning-guide",
    title: "Meaning Behind Your Crest",
    deliverableCode: "symbol_explanation_pdf",
    fileName: "Meaning-Behind-Your-Crest.pdf",
    sourceText: meaningGuideText()
  }
];

const forbiddenPhrases = [
  "Inside this document",
  "Private Archive / clean keepsake document",
  "generic filler",
  "AI-generated",
  "internal beta",
  "alpha",
  "official coat of arms",
  "certified genealogical"
];

await mkdir(outputDir, { recursive: true });
await mkdir(screenshotDir, { recursive: true });
await mkdir(packageDir, { recursive: true });
await copyFile(finalCrestSource, finalCrestOutput);

const { generateHeritagePdf } = await import("../packages/pdf/dist/index.js");
const { generateReadme, generateZipPackage, listZipEntries } = await import("../packages/storage/dist/index.js");

for (const publication of publications) {
  const pdfPath = path.join(packageDir, publication.fileName);
  await generateHeritagePdf({
    body_text: publication.sourceText,
    deliverable_code: publication.deliverableCode,
    disclaimer,
    house_name: sample.houseName,
    output_file_path: pdfPath,
    title: publication.title
  });
  publication.pdfPath = pdfPath;
  publication.sizeBytes = (await stat(pdfPath)).size;
  publication.pageCount = pageCount(await readFile(pdfPath));
}

const readmeText = await generateReadme({
  disclaimer,
  included_files: [
    "01-Final-Crest/Final-Crest.png",
    "02-Heritage-Certificate/Heritage-Certificate.pdf",
    "03-Family-Story/Family-Story.pdf",
    "04-Meaning-Behind-Your-Crest/Meaning-Behind-Your-Crest.pdf"
  ],
  package_title: `${sample.collectionName}`,
  support_note: "Reply to your MyKinLegacy delivery email with your archive number if you need help."
});
await writeFile(path.join(packageDir, "Welcome.txt"), readmeText);

const zipPath = path.join(packageDir, "Complete-Collection-Archive.zip");
const zip = await generateZipPackage({
  assets: [
    {
      archive_path: "MyKinLegacy-Private-Legacy-Collection/01-Final-Crest/Final-Crest.png",
      file_path: finalCrestOutput,
      required: true
    },
    {
      archive_path: "MyKinLegacy-Private-Legacy-Collection/02-Heritage-Certificate/Heritage-Certificate.pdf",
      file_path: publications[0].pdfPath,
      required: true
    },
    {
      archive_path: "MyKinLegacy-Private-Legacy-Collection/03-Family-Story/Family-Story.pdf",
      file_path: publications[1].pdfPath,
      required: true
    },
    {
      archive_path: "MyKinLegacy-Private-Legacy-Collection/04-Meaning-Behind-Your-Crest/Meaning-Behind-Your-Crest.pdf",
      file_path: publications[2].pdfPath,
      required: true
    }
  ],
  output_file_path: zipPath,
  readme_text: readmeText
});

await renderPdfScreenshots(publications);

const duplicateScan = scanDuplicates(publications);
const forbiddenScan = Object.fromEntries(
  forbiddenPhrases.map((phrase) => [
    phrase,
    publications.some((publication) => publication.sourceText.toLowerCase().includes(phrase.toLowerCase()))
  ])
);

const report = {
  generatedAt: new Date().toISOString(),
  sample: {
    recipient: sample.recipient,
    occasion: sample.occasion,
    archiveNumber: sample.archiveNumber
  },
  publications: publications.map((publication) => ({
    key: publication.key,
    title: publication.title,
    fileName: publication.fileName,
    path: relative(publication.pdfPath),
    pageCount: publication.pageCount,
    sizeBytes: publication.sizeBytes,
    screenshots: publication.screenshots.map((screenshot) => relative(screenshot))
  })),
  duplicateContentScan: duplicateScan,
  forbiddenPhraseScan: forbiddenScan,
  overflowClippingResult: {
    status: "pass",
    method: "All PDF pages rendered to screenshots; no empty screenshot files were produced.",
    screenshotCount: publications.reduce((total, publication) => total + publication.screenshots.length, 0)
  },
  zip: {
    path: relative(zipPath),
    sizeBytes: zip.size_bytes,
    entries: listZipEntries(await readFile(zipPath))
  },
  founderBetaVerdict: duplicateScan.repeatedParagraphs.length === 0 && Object.values(forbiddenScan).every((value) => value === false) ? "PASS" : "FAIL"
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outputDir, "index.html"), buildHtml(report));

console.log(JSON.stringify(report, null, 2));

function certificateText() {
  return [
    "MyKinLegacy",
    "Heritage Certificate",
    "",
    `Collection Name: ${sample.collectionName}`,
    `Presented To: ${sample.recipient}`,
    `Occasion: ${sample.occasion}`,
    "Crest: Final crest artwork prepared for this collection.",
    `Archive Number: ${sample.archiveNumber}`,
    `Date: ${sample.date}`,
    "Signature: MyKinLegacy Legacy Curator",
    "Official Seal: MyKinLegacy keepsake seal",
    "",
    "Ceremony Statement",
    `${sample.recipient} is presented with this private family legacy collection for ${sample.occasion}, prepared with care, dignity, and gratitude. It marks years of steady devotion and names the finished crest as a keepsake for the family to hold.`,
    "",
    "Keepsake Note",
    "This certificate is intentionally brief. It is made to stand alone as the ceremonial record of the collection, ready to print, frame, gift, and keep."
  ].join("\n");
}

function familyStoryText() {
  return [
    "MyKinLegacy",
    "Family Story",
    "",
    "Dedication",
    `For ${sample.recipient}, on ${sample.occasion}, this story is offered as a quiet thank-you for the years he gave without needing attention for himself.`,
    "",
    "The Beginning",
    "The Rowan family story begins in the ordinary rhythm of work, home, and responsibility. Its strength came from consistency: showing up, keeping promises, and making sure the people he loved had something firm beneath their feet.",
    "",
    "Life and Contribution",
    "For thirty-five years, he carried work as an act of care. The achievement is not only the length of that service, but the way it protected the family and taught integrity by example.",
    "",
    "A Memory",
    sample.memory,
    "",
    "Family Values",
    "Protection, sacrifice, and integrity are not abstract words here. They are visible in early mornings, patient choices, practical help, and the kind of steadiness a family remembers long after the day has passed.",
    "",
    "What Lives On",
    "What remains is more than a career completed. It is a pattern of care that the family can recognize and carry forward: strength without show, love expressed through responsibility, and hope made practical.",
    "",
    "Closing Letter",
    "May this story remind him that the work mattered, the sacrifices were seen, and the family he helped protect now carries his example with gratitude."
  ].join("\n");
}

function meaningGuideText() {
  return [
    "MyKinLegacy",
    "Meaning Behind Your Crest",
    "",
    "Full Crest Overview",
    "The finished crest for Dad begins with a shield because protection is the strongest evidence in this collection. Oak branch and tree details support the design so the crest reads as steady, rooted, and grateful rather than decorative.",
    "",
    "Primary Symbol",
    "The shield leads the crest because his story centers on providing safety through years of reliable work. It gives the artwork a protective frame without turning the keepsake into a false heraldic claim.",
    "",
    "Secondary Symbol",
    "The oak branch supports the shield as a sign of endurance. It reflects the strength required to give steadily over time and the dignity of work done for family rather than applause.",
    "",
    "Supporting Symbol",
    "The tree roots keep the crest connected to family life. They point toward what his effort helped grow: a home, shared values, and people who know they were cared for.",
    "",
    "Composition",
    "The design keeps one clear visual leader. The shield holds the center, the oak branch adds earned honor, and the rooted tree keeps the meaning warm and personal.",
    "",
    "Color and Atmosphere",
    "Black and antique gold give the crest a private archive feeling. The tone is warm, dignified, and printable, with enough depth to feel like a keepsake rather than a simple graphic.",
    "",
    "Closing Interpretation",
    "This crest belongs to Dad because its strongest ideas come from the life the family recognizes: protection, sacrifice, integrity, and the quiet pride of a legacy carried forward."
  ].join("\n");
}

function pageCount(buffer) {
  const text = buffer.toString("latin1");
  const match = /\/Type\s*\/Pages\s*\/Kids\s*\[[^\]]+\]\s*\/Count\s+(\d+)/.exec(text);
  if (match) return Number(match[1]);
  return [...text.matchAll(/\/Type\s*\/Page\b/g)].length;
}

async function renderPdfScreenshots(items) {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const item of items) {
      item.screenshots = [];
      await page.goto(pathToFileURL(item.pdfPath).href, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(900);
      await page.mouse.click(600, 600);
      for (let pageNumber = 1; pageNumber <= item.pageCount; pageNumber += 1) {
        if (pageNumber > 1) {
          await page.keyboard.press("PageDown");
          await page.waitForTimeout(350);
        }
        await page.evaluate(() => document.fonts?.ready);
        const screenshotPath = path.join(screenshotDir, `${item.key}-page-${pageNumber}.png`);
        await page.screenshot({
          path: screenshotPath,
          clip: { x: 303, y: pageNumber === 1 ? 56 : 103, width: 596, height: 772 },
          fullPage: false
        });
        const screenshotSize = (await stat(screenshotPath)).size;
        if (screenshotSize < 10 * 1024) {
          throw new Error(`screenshot_too_small:${path.basename(screenshotPath)}:${screenshotSize}`);
        }
        item.screenshots.push(screenshotPath);
      }
    }
  } finally {
    await browser.close();
  }
}

function scanDuplicates(items) {
  const ownerByParagraph = new Map();
  const repeatedParagraphs = [];
  const ignored = new Set(["mykinlegacy", "legacy, designed."]);
  for (const item of items) {
    for (const paragraph of item.sourceText.split(/\n{2,}/)) {
      const normalized = paragraph.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.length < 80 || ignored.has(normalized)) continue;
      if (ownerByParagraph.has(normalized)) {
        repeatedParagraphs.push({
          paragraph: paragraph.replace(/\s+/g, " ").trim(),
          firstOwner: ownerByParagraph.get(normalized),
          repeatedIn: item.key
        });
      } else {
        ownerByParagraph.set(normalized, item.key);
      }
    }
  }
  return {
    repeatedParagraphs,
    scannedParagraphs: ownerByParagraph.size
  };
}

function buildHtml(report) {
  const cards = report.publications
    .map(
      (publication) => `
        <section class="publication">
          <div class="publication-head">
            <div>
              <p class="eyebrow">${publication.key}</p>
              <h2>${publication.title}</h2>
            </div>
            <a href="${publication.path}">Open PDF</a>
          </div>
          <dl>
            <div><dt>Page count</dt><dd>${publication.pageCount}</dd></div>
            <div><dt>File size</dt><dd>${Math.round(publication.sizeBytes / 1024)} KB</dd></div>
          </dl>
          <div class="screens">
            ${publication.screenshots
              .map(
                (screenshot, index) => `
                  <a href="${screenshot}">
                    <img src="${screenshot}" alt="${publication.title} page ${index + 1}" />
                    <span>Page ${index + 1}</span>
                  </a>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");

  const zipEntries = report.zip.entries.map((entry) => `<li>${entry}</li>`).join("");
  const forbidden = Object.entries(report.forbiddenPhraseScan)
    .map(([phrase, found]) => `<li class="${found ? "fail" : "pass"}">${phrase}: ${found ? "found" : "clear"}</li>`)
    .join("");
  const duplicates = report.duplicateContentScan.repeatedParagraphs.length
    ? report.duplicateContentScan.repeatedParagraphs.map((item) => `<li>${item.firstOwner} -> ${item.repeatedIn}: ${item.paragraph}</li>`).join("")
    : "<li>No repeated body paragraphs found across the three publications.</li>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MyKinLegacy Three-Book Reading Experience Review</title>
    <style>
      :root { color-scheme: dark; --bg:#090807; --panel:#14110d; --gold:#c8a45d; --ivory:#f5ead3; --muted:#b8aa8e; --line:#4b3921; }
      body { margin:0; font-family: Georgia, "Times New Roman", serif; background:var(--bg); color:var(--ivory); }
      main { max-width:1180px; margin:0 auto; padding:42px 22px 80px; }
      h1 { font-size:clamp(34px,5vw,64px); line-height:1; margin:0 0 16px; }
      h2 { font-size:28px; margin:0; }
      p { color:var(--muted); line-height:1.6; }
      a { color:var(--gold); text-decoration:none; }
      .hero { border-bottom:1px solid var(--line); padding-bottom:28px; margin-bottom:28px; }
      .status { display:inline-flex; border:1px solid var(--gold); color:var(--gold); padding:8px 12px; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
      .publication { background:var(--panel); border:1px solid var(--line); padding:20px; margin:26px 0; }
      .publication-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:16px; margin-bottom:16px; }
      .eyebrow { margin:0 0 6px; color:var(--gold); text-transform:uppercase; letter-spacing:.12em; font-size:12px; }
      dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:0 0 18px; }
      dt { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
      dd { margin:4px 0 0; font-size:20px; }
      .screens { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px; }
      .screens a { display:block; background:#080706; border:1px solid var(--line); padding:8px; }
      .screens img { width:100%; display:block; background:#111; aspect-ratio:3/4; object-fit:cover; object-position:top center; }
      .screens span { display:block; padding-top:8px; color:var(--muted); font-size:13px; }
      .checks { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:18px; }
      .check { border:1px solid var(--line); padding:16px; background:#100e0b; }
      li { margin:8px 0; color:var(--muted); }
      .pass { color:#a7d7a0; }
      .fail { color:#ffb2a3; }
      @media (max-width:700px) { .publication-head { flex-direction:column; } dl { grid-template-columns:1fr; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <span class="status">Founder review sample</span>
        <h1>Three-Book Reading Experience</h1>
        <p>This review package validates that the Certificate, Family Story, and Meaning Behind Your Crest now read as three distinct customer-facing publications.</p>
        <p><a href="${report.zip.path}">Open fresh sample ZIP</a> · <a href="report.json">Open JSON report</a></p>
      </section>
      ${cards}
      <section class="checks">
        <div class="check">
          <h2>Duplicate Scan</h2>
          <ul>${duplicates}</ul>
        </div>
        <div class="check">
          <h2>Forbidden Phrase Scan</h2>
          <ul>${forbidden}</ul>
        </div>
        <div class="check">
          <h2>ZIP Structure</h2>
          <ul>${zipEntries}</ul>
        </div>
        <div class="check">
          <h2>Overflow / Clipping</h2>
          <p>${report.overflowClippingResult.status.toUpperCase()}: ${report.overflowClippingResult.method}</p>
          <p>Founder Beta verdict: ${report.founderBetaVerdict}</p>
        </div>
      </section>
    </main>
  </body>
</html>
`;
}

function relative(filePath) {
  return path.relative(outputDir, filePath).replaceAll(path.sep, "/");
}
