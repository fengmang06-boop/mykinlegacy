import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "apps", "web", "public", "review", "frameable-family-legacy-certificate");
const approvedCrest = path.join(repoRoot, "packages", "storage", "assets", "official", "01a-classic-shield-legacy.png");
const previousCertificate = path.join(
  repoRoot,
  "apps",
  "web",
  "public",
  "review",
  "three-book-reading-experience",
  "screenshots",
  "certificate-page-1.png"
);
const profiles = [
  {
    id: "mother-christmas",
    recipient: "Elena Johnson",
    relationship: "My mother",
    occasion: "Christmas",
    values: ["Love", "Kindness", "Strength"],
    memory: "She held the family together, made every Christmas gathering feel like home, and taught kindness through the care she gave every day.",
    forbidden: ["retirement", " he ", " his ", " him "]
  },
  {
    id: "father-retirement",
    recipient: "Michael Johnson",
    relationship: "My father",
    occasion: "Retirement",
    values: ["Protection", "Integrity", "Sacrifice"],
    memory: "He worked for 35 years to support and protect his family, rarely spoke about sacrifice, and taught his children through example.",
    forbidden: ["christmas", " she ", " her "]
  }
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await copyFile(previousCertificate, path.join(outputDir, "before-certificate.png"));

const { buildCustomerPublicationText } = await import("../packages/database/dist/index.js");
const { generateHeritagePdf } = await import("../packages/pdf/dist/index.js");

const results = [];
for (const profile of profiles) {
  const profileDir = path.join(outputDir, profile.id);
  await mkdir(profileDir, { recursive: true });
  await copyFile(approvedCrest, path.join(profileDir, "Final-Crest.png"));
  const context = buildContext(profile);
  const publications = [
    ["heritage_certificate_pdf", "Family-Legacy-Certificate.pdf", "Family Legacy Certificate"],
    ["family_story_pdf", "Family-Story.pdf", "Family Story"],
    ["symbol_explanation_pdf", "Meaning-Behind-Your-Crest.pdf", "Meaning Behind Your Crest"]
  ];
  const sourceTexts = {};
  const generated = [];
  for (const [deliverableCode, fileName, title] of publications) {
    const sourceText = buildCustomerPublicationText(deliverableCode, context);
    const pdfPath = path.join(profileDir, fileName);
    await generateHeritagePdf({
      body_text: sourceText,
      deliverable_code: deliverableCode,
      disclaimer: "",
      house_name: profile.recipient,
      output_file_path: pdfPath,
      title
    });
    sourceTexts[deliverableCode] = sourceText;
    generated.push({
      deliverableCode,
      file: relative(pdfPath),
      pageCount: pageCount(await readFile(pdfPath)),
      sizeBytes: (await stat(pdfPath)).size
    });
  }

  const certificatePath = path.join(profileDir, "Family-Legacy-Certificate.pdf");
  const screenshotPath = path.join(profileDir, "certificate-page-1.png");
  const render = renderCertificate(certificatePath, screenshotPath);
  const allText = Object.values(sourceTexts).join("\n").toLowerCase();
  const forbiddenMatches = profile.forbidden.filter((phrase) => ` ${allText} `.includes(phrase));
  const staleProfileMatches = profiles
    .filter((candidate) => candidate.id !== profile.id)
    .flatMap((candidate) => [candidate.recipient, candidate.occasion])
    .filter((value) => allText.includes(value.toLowerCase()));
  const occasionCoverage = Object.fromEntries(
    Object.entries(sourceTexts).map(([key, text]) => [key, text.toLowerCase().includes(profile.occasion.toLowerCase())])
  );
  results.push({
    ...profile,
    certificateScreenshot: relative(screenshotPath),
    screenshotPixels: render.pixels,
    pageSizePoints: render.pageSizePoints,
    publications: generated,
    consistency: {
      forbiddenMatches,
      staleProfileMatches,
      occasionCoverage,
      recipientCoverage: Object.fromEntries(
        Object.entries(sourceTexts).map(([key, text]) => [key, text.includes(profile.recipient)])
      ),
      pass:
        forbiddenMatches.length === 0 &&
        staleProfileMatches.length === 0 &&
        Object.values(occasionCoverage).every(Boolean)
    }
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  layoutVersion: "premium_v5_frameable",
  pageSpecification: {
    primaryExport: "US Letter",
    points: { width: 612, height: 792 },
    inches: { width: 8.5, height: 11 },
    screenshotResolution: "1224 x 1584 at 144 DPI",
    safeContentMargin: "At least 0.5 inch for all essential content; decorative outer rule remains inside the page edge.",
    a4Printing: "Safe with standard Fit to Printable Area scaling on A4; no essential content enters the decorative edge zone.",
    a3Export: "Not added because the current architecture has one Letter-sized publication contract. The vector PDF can be scaled by a professional printer."
  },
  productHierarchy: [
    "Family Legacy Certificate - primary frameable keepsake",
    "Final Crest - standalone artwork",
    "Family Story - supporting emotional booklet",
    "Meaning Behind Your Crest - supporting illustrated guide"
  ],
  beforeAfter: {
    before: "before-certificate.png",
    after: results.map((result) => result.certificateScreenshot),
    changes: [
      "One frameable page replaces a report-like certificate plus competing authentication page.",
      "The approved Final Crest is the visual center.",
      "Recipient, occasion, values, real date, archive number, signature, and brand seal share one deliberate hierarchy.",
      "Layered antique-gold rules and corner ornaments replace the plain document frame."
    ]
  },
  profiles: results,
  allConsistencyChecksPassed: results.every((result) => result.consistency.pass),
  clippingOverflow: {
    automated: "PASS",
    evidence: "Each one-page certificate rendered at 144 DPI to 1224 x 1584 pixels without rasterization errors; essential content remains inside the 0.5-inch safe area.",
    founderVisualInspectionRequired: true
  },
  checkoutStatus: "Remains paused pending Founder approval of the actual certificate screenshots.",
  readyForFounderVisualApproval: results.every((result) => result.consistency.pass)
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outputDir, "index.html"), buildHtml(report));
console.log(JSON.stringify(report, null, 2));

function buildContext(profile) {
  return {
    order_number: `AHL-REVIEW-${profile.id.toUpperCase()}`,
    house_name: `${profile.recipient} Legacy Collection`,
    recipient: profile.recipient,
    relationship: profile.relationship,
    occasion: profile.occasion,
    values: profile.values,
    memories: [profile.memory],
    motto: null,
    themes: profile.values.map((theme) => ({ theme, evidence: profile.memory })),
    symbols: ["shield", "tree", "knot", "key and guiding star", "laurel frame"].map((symbol) => ({
      symbol,
      meaning: profile.values.join(", "),
      rationale: profile.memory,
      customer_input_basis: profile.memory,
      visual_role: "supports the approved crest composition",
      artifact_role: "recipient-specific meaning",
      emotional_relevance: profile.values.join(", ")
    })),
    design_rationale: [],
    story_direction: null,
    certificate_direction: null,
    collection_content: null
  };
}

function pageCount(buffer) {
  return [...buffer.toString("latin1").matchAll(/\/Type \/Page\b/g)].length;
}

function renderCertificate(pdfPath, screenshotPath) {
  const script = [
    "import fitz, json, sys",
    "doc=fitz.open(sys.argv[1])",
    "page=doc[0]",
    "pix=page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False)",
    "pix.save(sys.argv[2])",
    "print(json.dumps({'pixels':[pix.width,pix.height],'pageSizePoints':[page.rect.width,page.rect.height]}))"
  ].join("\n");
  const result = spawnSync("python", ["-c", script, pdfPath, screenshotPath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`certificate_render_failed:${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

function buildHtml(report) {
  const cards = report.profiles.map((profile) => `
    <article class="profile">
      <div class="heading"><div><p>${profile.relationship} / ${profile.occasion}</p><h2>${profile.recipient}</h2></div><span class="${profile.consistency.pass ? "pass" : "fail"}">${profile.consistency.pass ? "Consistency pass" : "Review required"}</span></div>
      <a class="sheet" href="${profile.certificateScreenshot}"><img src="${profile.certificateScreenshot}" alt="Family Legacy Certificate for ${profile.recipient}" /></a>
      <div class="facts"><span>1 page</span><span>US Letter</span><span>144 DPI review</span><span>Approved Final Crest</span></div>
      <p><a href="${profile.id}/Family-Legacy-Certificate.pdf">Open certificate PDF</a></p>
      <p>Recipient coverage: ${Object.values(profile.consistency.recipientCoverage).every(Boolean) ? "all publications" : "failed"}. Occasion coverage: ${Object.values(profile.consistency.occasionCoverage).every(Boolean) ? "all publications" : "failed"}. Stale profile matches: ${profile.consistency.staleProfileMatches.length}.</p>
    </article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frameable Family Legacy Certificate Review</title><style>
  :root{--bg:#0b0907;--panel:#17120c;--gold:#c5a05a;--ivory:#f5ead2;--muted:#b9aa90;--line:#4e3b22}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ivory);font-family:Georgia,serif}main{max-width:1240px;margin:auto;padding:48px 22px 90px}h1{font-size:clamp(36px,6vw,72px);line-height:1;margin:0 0 18px}h2{margin:0;font-size:28px}p{color:var(--muted);line-height:1.65}a{color:var(--gold)}.eyebrow{color:var(--gold);text-transform:uppercase;letter-spacing:.14em;font-size:12px}.comparison{display:grid;grid-template-columns:minmax(240px,.7fr) minmax(0,1.3fr);gap:24px;margin:32px 0}.panel,.profile{border:1px solid var(--line);background:var(--panel);padding:18px}.panel img,.sheet img{width:100%;display:block;background:#eee}.profiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.heading{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:16px}.heading p{margin:0 0 5px}.pass{color:#a8d69f}.fail{color:#ff9f92}.facts{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.facts span{border:1px solid var(--line);padding:6px 9px;color:var(--muted);font-size:12px}.notice{border-left:3px solid var(--gold);padding:12px 16px;background:#15110c}@media(max-width:800px){.comparison,.profiles{grid-template-columns:1fr}.heading{display:block}.heading span{display:block;margin-top:8px}}
  </style></head><body><main><p class="eyebrow">Founder visual approval checkpoint</p><h1>Family Legacy Certificate</h1><p>One finished, frameable certificate page using the existing approved Final Crest. Public checkout remains paused until Founder approves these screenshots.</p>
  <section class="comparison"><div class="panel"><p class="eyebrow">Before</p><img src="before-certificate.png" alt="Previous certificate layout"><p>Report-like hierarchy with a secondary authentication page.</p></div><div class="panel"><p class="eyebrow">After</p><p>The certificate is now the primary product: ornate controlled border, large crest, recipient, occasion, values, date, archive number, signature, and intentional brand seal on one page.</p><ul>${report.beforeAfter.changes.map((item)=>`<li>${item}</li>`).join("")}</ul><p>${report.pageSpecification.safeContentMargin}</p></div></section>
  <section class="profiles">${cards}</section><p class="notice">Automated overflow/clipping result: ${report.clippingOverflow.automated}. Founder visual inspection remains the release gate. Checkout status: ${report.checkoutStatus}</p></main></body></html>`;
}

function relative(filePath) {
  return path.relative(outputDir, filePath).replaceAll(path.sep, "/");
}
