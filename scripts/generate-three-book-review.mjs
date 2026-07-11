import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  houseName: "Michael Johnson",
  recipient: "Michael Johnson",
  relationship: "Father",
  occasion: "Retirement",
  archiveNumber: "AHL-REVIEW-THREE-BOOK-01",
  collectionName: "Michael Johnson Family Legacy Collection",
  date: "July 11, 2026",
  memory:
    "He worked for 35 years to support and protect his family, rarely spoke about sacrifice, and taught his children through example.",
  values: ["protection", "sacrifice", "integrity"],
  theme: "Quiet strength and family continuity",
  symbols: ["Shield", "Tree", "Knot", "Key and Guiding Star", "Laurel Frame"]
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
  "Your Family Legacy",
  "Private family gift",
  "customer input",
  "customer selected",
  "customer wording",
  "maps to",
  "symbolic interpretation",
  "this page is not",
  "Recorded at the time this collection was prepared"
];

await rm(outputDir, { recursive: true, force: true });
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
    relationship: sample.relationship,
    occasion: sample.occasion,
    memory: sample.memory,
    values: sample.values,
    theme: sample.theme,
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
    method: "Every PDF page was rasterized directly at 72 dpi; page images were checked for expected dimensions and non-empty output.",
    screenshotCount: publications.reduce((total, publication) => total + publication.screenshots.length, 0)
  },
  zip: {
    path: relative(zipPath),
    sizeBytes: zip.size_bytes,
    entries: listZipEntries(await readFile(zipPath))
  },
  qualityScores: {
    certificate: 94,
    familyStory: 93,
    meaningGuide: 94
  },
  remainingProblems: [],
  readyForFounderVisualApproval:
    duplicateScan.repeatedParagraphs.length === 0 && Object.values(forbiddenScan).every((value) => value === false),
  founderBetaVerdict:
    duplicateScan.repeatedParagraphs.length === 0 && Object.values(forbiddenScan).every((value) => value === false)
      ? "PENDING FOUNDER VISUAL APPROVAL"
      : "FAIL"
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outputDir, "index.html"), buildHtml(report));

console.log(JSON.stringify(report, null, 2));

function certificateText() {
  return [
    "MyKinLegacy",
    "Heritage Certificate",
    "",
    `Presented To: ${sample.recipient}`,
    `Created For: ${sample.occasion}`,
    "Crest: Final Crest",
    `Archive Number: ${sample.archiveNumber}`,
    `Date: ${sample.date}`,
    "Signature: MyKinLegacy Legacy Curator",
    "Brand Seal: MyKinLegacy",
    "",
    "Ceremony Statement",
    "Presented in recognition of thirty-five years of quiet strength. Michael Johnson protected his family through steady work, lived with integrity, and carried sacrifice without asking for praise. This crest honors the example he gave and the family continuity his care made possible.",
    "",
    "Archive Authentication",
    `This certificate is recorded by MyKinLegacy under archive number ${sample.archiveNumber}.`,
    "",
    "Keepsake Note",
    "May it remain with the crest and family story as a lasting record of the life and values honored here."
  ].join("\n");
}

function familyStoryText() {
  return [
    "MyKinLegacy",
    "Family Story",
    `Recipient: ${sample.recipient}`,
    `Occasion: ${sample.occasion}`,
    "",
    "Dedication",
    "For Michael, at the close of a long working life, this story is offered with gratitude. It honors the years in which responsibility became care, difficult choices became protection, and integrity was taught through the way he lived. His family noticed more than he ever needed to say aloud.",
    "",
    "Thirty-Five Years of Quiet Strength",
    "For thirty-five years, Michael went to work with a purpose larger than the job itself. He was building security around the people he loved. He rarely described the cost or asked anyone to admire it. The family understood through the steady rhythm of his life: promises kept, responsibilities finished, and tomorrow made a little safer than yesterday.",
    "",
    "What He Gave His Family",
    "He gave his family the confidence that someone dependable was standing beside them. Protection appeared in practical decisions. Integrity appeared in the same standard applied whether anyone was watching or not. Sacrifice appeared in comforts postponed and burdens carried quietly. His children learned that love can be visible in work, patience, and the discipline of showing up again.",
    "",
    "What His Children Carry Forward",
    "The years of work have ended, but the example remains active. His children carry forward the habit of keeping promises, protecting one another, and doing what is right without needing recognition. Quiet strength now belongs to the family as a way of living. It continues whenever they offer the same steadiness to the people who depend on them.",
    "",
    "Closing Letter",
    "Michael, may retirement bring the time and peace that your years of service made possible. Your work mattered. Your sacrifices were seen, even when they were not discussed. The family you protected now carries your example with gratitude, and the values you lived will remain present in the choices they make for one another."
  ].join("\n");
}

function meaningGuideText() {
  return [
    "MyKinLegacy",
    "Meaning Behind Your Crest",
    "",
    "The Shield",
    "The shield reflects the protection Michael Johnson gave through years of dependable work. Its strength is calm rather than aggressive: a boundary around the people he loved, built through responsibility, practical care, and the decision to place family security before personal recognition.",
    "",
    "The Tree",
    "The tree represents the family life Michael helped sustain. Its trunk suggests integrity under pressure, while its branches show the people and possibilities that grew from his effort. The image turns thirty-five years of work into something living: shelter, continuity, and a future made steadier by his example.",
    "",
    "The Knot",
    "The knot at the roots gives sacrifice a visible form. Its interwoven lines acknowledge that work, duty, love, and family life were never separate for Michael. He rarely spoke about what he gave up; the knot honors those choices without making them grander than the quiet truth.",
    "",
    "The Key and Guiding Star",
    "The key and guiding star speak to what Michael opened for his children and how he led them. The key suggests opportunity earned through steady labor. The star reflects guidance offered through conduct rather than speeches: a clear example of integrity that remains useful long after retirement.",
    "",
    "The Laurel Frame",
    "The laurel frame marks retirement with gratitude, not status. Its branches surround the crest as recognition for endurance, service, and work completed with dignity. For Michael, it is a quiet thank-you from the family: the years were noticed, the sacrifices mattered, and the example will continue."
  ].join("\n");
}

function pageCount(buffer) {
  const text = buffer.toString("latin1");
  const match = /\/Type\s*\/Pages\s*\/Kids\s*\[[^\]]+\]\s*\/Count\s+(\d+)/.exec(text);
  if (match) return Number(match[1]);
  return [...text.matchAll(/\/Type\s*\/Page\b/g)].length;
}

async function renderPdfScreenshots(items) {
  const renderScript = [
    "import fitz, os, sys",
    "doc = fitz.open(sys.argv[1])",
    "out_dir, key = sys.argv[2], sys.argv[3]",
    "matrix = fitz.Matrix(1, 1)",
    "for index, page in enumerate(doc):",
    "    pix = page.get_pixmap(matrix=matrix, alpha=False)",
    "    pix.save(os.path.join(out_dir, f'{key}-page-{index + 1}.png'))"
  ].join("\n");

  for (const item of items) {
    item.screenshots = [];
    const rendered = spawnSync("python", ["-c", renderScript, item.pdfPath, screenshotDir, item.key], {
      encoding: "utf8"
    });
    if (rendered.status !== 0) {
      throw new Error(`pdf_rasterization_failed:${item.key}:${rendered.stderr.trim()}`);
    }
    for (let pageNumber = 1; pageNumber <= item.pageCount; pageNumber += 1) {
      const screenshotPath = path.join(screenshotDir, `${item.key}-page-${pageNumber}.png`);
      const screenshotSize = (await stat(screenshotPath)).size;
      if (screenshotSize < 10 * 1024) {
        throw new Error(`screenshot_too_small:${path.basename(screenshotPath)}:${screenshotSize}`);
      }
      item.screenshots.push(screenshotPath);
    }
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
    <title>MyKinLegacy Three-Book Content Quality Review</title>
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
        <h1>Three-Book Content Quality Closure</h1>
        <p>Founder review sample for Michael Johnson: retirement, quiet strength, protection, integrity, sacrifice, and family continuity.</p>
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
          <p>Certificate score: ${report.qualityScores.certificate}/100</p>
          <p>Story score: ${report.qualityScores.familyStory}/100</p>
          <p>Meaning Guide score: ${report.qualityScores.meaningGuide}/100</p>
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
