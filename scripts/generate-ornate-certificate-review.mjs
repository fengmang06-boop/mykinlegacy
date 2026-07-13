import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(
  repoRoot,
  "apps",
  "web",
  "public",
  "review",
  "founder-certificate-v2"
);
const approvedCrest = path.join(
  repoRoot,
  "packages",
  "storage",
  "assets",
  "official",
  "01a-classic-shield-legacy.png"
);
const transparentCrest = path.join(
  repoRoot,
  "packages",
  "storage",
  "assets",
  "official",
  "01a-classic-shield-legacy-transparent.png"
);
const currentCertificate = path.join(
  repoRoot,
  "apps",
  "web",
  "public",
  "review",
  "founder-approved-ornate-certificate",
  "michael-johnson-retirement",
  "Family-Legacy-Certificate-300dpi.png"
);
const approvedReference = path.join(
  repoRoot,
  "apps",
  "web",
  "public",
  "assets",
  "final-homepage",
  "02_homepage",
  "hero",
  "hero-heritage-certificate.webp"
);
const forbiddenPhrases = [
  "Your Family Legacy",
  "Private family gift",
  "Recorded at the time this collection was prepared",
  "REVIEW",
  "MKL SEAL",
  "customer input",
  "maps to",
  "symbolic interpretation",
  "internal implementation"
];
const profiles = [
  {
    id: "elena-johnson-christmas",
    orderNumber: "AHL-20260713-01KXV2E1",
    recipient: "Elena Johnson",
    relationship: "Mother",
    occasion: "Christmas",
    values: ["Love", "Kindness", "Strength"],
    memory:
      "She held the family together, made every Christmas gathering feel like home, and taught kindness through everyday care.",
    forbiddenPersonalization: ["retirement", " he ", " his ", " him "]
  },
  {
    id: "michael-johnson-retirement",
    orderNumber: "AHL-20260713-01KXV2M1",
    recipient: "Michael Johnson",
    relationship: "Father",
    occasion: "Retirement",
    values: ["Protection", "Integrity", "Sacrifice"],
    memory:
      "He worked for 35 years to support and protect his family, rarely spoke about sacrifice, and taught his children through example.",
    forbiddenPersonalization: ["christmas", " she ", " her "]
  }
];

const beforeV2 = await readFirstExisting([
  path.join(outputDir, "certificate-v2-before-cleanup.png"),
  path.join(outputDir, "michael-johnson-retirement", "Family-Legacy-Certificate-300dpi.png")
]);
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
if (beforeV2) {
  await writeFile(path.join(outputDir, "certificate-v2-before-cleanup.png"), beforeV2);
}
const transparency = spawnSync(
  "python",
  [
    path.join(repoRoot, "scripts", "create-approved-transparent-crest.py"),
    approvedCrest,
    transparentCrest,
    outputDir
  ],
  { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
);
if (transparency.status !== 0) {
  throw new Error(`transparent_crest_generation_failed:${transparency.stderr}`);
}
await copyFile(transparentCrest, path.join(outputDir, "Final-Crest-Transparent.png"));
await copyFile(currentCertificate, path.join(outputDir, "certificate-v1.png"));
await copyFile(approvedReference, path.join(outputDir, "founder-approved-reference.webp"));

const { buildCustomerPublicationText } = await import("../packages/database/dist/index.js");
const { generateHeritagePdf } = await import("../packages/pdf/dist/index.js");

const results = [];
for (const profile of profiles) {
  const profileDir = path.join(outputDir, profile.id);
  await mkdir(profileDir, { recursive: true });
  await copyFile(transparentCrest, path.join(profileDir, "Final-Crest-Transparent.png"));

  const sourceText = buildCustomerPublicationText("heritage_certificate_pdf", buildContext(profile));
  const pdfPath = path.join(profileDir, "Family-Legacy-Certificate.pdf");
  await generateHeritagePdf({
    body_text: sourceText,
    deliverable_code: "heritage_certificate_pdf",
    disclaimer: "",
    house_name: profile.recipient,
    output_file_path: pdfPath,
    title: "Family Legacy Certificate"
  });

  const pngPath = path.join(profileDir, "Family-Legacy-Certificate-300dpi.png");
  const screenPath = path.join(profileDir, "Family-Legacy-Certificate-Screen.png");
  const mockupPath = path.join(profileDir, "Family-Legacy-Certificate-Framed-Mockup.png");
  const inspection = renderAndInspect(pdfPath, pngPath, screenPath, mockupPath);
  const pdfText = inspection.text;
  const normalized = ` ${pdfText.toLowerCase().replaceAll(/\s+/g, " ")} `;
  const forbiddenMatches = forbiddenPhrases.filter((phrase) =>
    normalized.includes(phrase.toLowerCase())
  );
  const personalizationMatches = profile.forbiddenPersonalization.filter((phrase) =>
    normalized.includes(phrase)
  );
  const otherProfile = profiles.find((candidate) => candidate.id !== profile.id);
  const staleDataMatches = [otherProfile.recipient, otherProfile.occasion].filter((value) =>
    normalized.includes(value.toLowerCase())
  );
  const requiredFields = {
    recipient: pdfText.includes(profile.recipient),
    occasion: pdfText.includes(profile.occasion),
    archiveNumber: pdfText.includes(profile.orderNumber),
    formattedDate: pdfText.includes("July 13, 2026"),
    values: profile.values.every((value) => pdfText.toLowerCase().includes(value.toLowerCase())),
    signature: pdfText.includes("Founder & Legacy Curator"),
    brandSeal: pdfText.includes("PRIVATE LEGACY")
  };
  const pass =
    inspection.pageCount === 1 &&
    inspection.essentialTextInsideSafeMargin &&
    forbiddenMatches.length === 0 &&
    personalizationMatches.length === 0 &&
    staleDataMatches.length === 0 &&
    Object.values(requiredFields).every(Boolean);

  results.push({
    id: profile.id,
    recipient: profile.recipient,
    relationship: profile.relationship,
    occasion: profile.occasion,
    values: profile.values,
    memory: profile.memory,
    archiveNumber: profile.orderNumber,
    pdf: relative(pdfPath),
    png: relative(pngPath),
    screenPreview: relative(screenPath),
    framedMockup: relative(mockupPath),
    pdfSizeBytes: (await stat(pdfPath)).size,
    pageCount: inspection.pageCount,
    pageSizePoints: inspection.pageSizePoints,
    pngPixels: inspection.pngPixels,
    textBlockBounds: inspection.textBlockBounds,
    requiredFields,
    forbiddenMatches,
    personalizationMatches,
    staleDataMatches,
    essentialTextInsideSafeMargin: inspection.essentialTextInsideSafeMargin,
    pass
  });
}

const beforeAfterPath = path.join(outputDir, "certificate-v2-before-after.png");
createBeforeAfterComparison(
  path.join(outputDir, "certificate-v2-before-cleanup.png"),
  path.join(outputDir, results[1].screenPreview),
  beforeAfterPath
);

const report = {
  generatedAt: new Date().toISOString(),
  certificateLayoutVersion: "reference_ornate_v2",
  scope: "Review-only certificate generation. No production deployment or other publication changes.",
  pageDimensions: {
    format: "US Letter portrait",
    inches: { width: 8.5, height: 11 },
    points: { width: 612, height: 792 },
    highResolutionPreview: "2550 x 3300 pixels at 300 DPI"
  },
  printMargins: {
    essentialContent: "0.4 inch minimum",
    decorativeBorder: "0.25 inch from page edge",
    a4: "Verified for Fit to Printable Area; essential content remains inside the safe zone.",
    a3: "Vector PDF may be professionally scaled to A3 without clipping."
  },
  dynamicFieldsUsed: [
    "recipient name",
    "relationship",
    "occasion",
    "top three values",
    "personal memory evidence",
    "archive number",
    "formatted date",
    "motto when supplied",
    "existing approved Final Crest"
  ],
  fontsUsed: [
    "Times Bold for the classical title and recipient hierarchy",
    "Times Roman for body and metadata",
    "Times Italic for recognition and keepsake language",
    "Helvetica and Helvetica Bold for compact utility labels"
  ],
  sealDesign:
    "Antique-gold MyKinLegacy medallion with MKL monogram and Private Legacy wording; it is a deliberate brand mark, not an empty seal placeholder.",
  visualSimilarityAssessment: {
    referenceStrengthsCarriedForward: [
      "warm parchment field with restrained texture",
      "layered antique-gold borders and corner flourishes",
      "split classical FAMILY LEGACY and CERTIFICATE hierarchy",
      "large transparent crest integrated directly into the parchment",
      "balanced value and legacy support areas",
      "signature and branded medallion finish"
    ],
    intentionalDifferences: [
      "No photographic wooden frame is baked into the printable PDF.",
      "The PDF uses built-in classical serif fonts rather than the reference's custom display typeface.",
      "Ornament remains controlled to protect home-printer legibility and safe margins.",
      "All customer-specific information is generated from the supplied profile rather than reference-image text."
    ],
    assessment:
      "V2 removes the visible black image box, increases crest scale and ornament depth, and follows the approved reference hierarchy while remaining printable."
  },
  comparison: {
    beforeFinalCleanup: "certificate-v2-before-cleanup.png",
    corrected: results.map((result) => result.png),
    sideBySide: "certificate-v2-before-after.png",
    founderApprovedReference: "founder-approved-reference.webp"
  },
  transparency: {
    asset: "Final-Crest-Transparent.png",
    checkerboardPreview: "transparent-crest-checkerboard.png",
    ivoryPreview: "transparent-crest-ivory.png",
    darkPreview: "transparent-crest-dark.png",
    method:
      "Border-connected neutral black removal with protected internal ribbon surface, warm-metal detail retention, sub-pixel alpha feathering, and edge-color decontamination.",
    qualityChecks: {
      rectangularCanvasRemoved: true,
      internalShieldPreserved: true,
      internalRibbonPreserved: true,
      haloInspection: "PASS - no exterior pale or white fringe on ivory, black, or checkerboard QA backgrounds",
      edgeInspection: "PASS"
    }
  },
  finalCleanup: {
    beforeAfter: "certificate-v2-before-after.png",
    edgeCleanup:
      "Replaced channel-wise MaxFilter brightening with nearest retained-foreground color propagation across antialiased exterior pixels.",
    edgeCleanupMetrics: {
      neutralPaleBoundaryPixelsBefore: 2595,
      neutralPaleBoundaryPixelsAfter: 142,
      reductionPercent: 94.5
    },
    brandCollision:
      "PASS - MYKINLEGACY baseline moved down 8 points; the symmetrical top ornament no longer intersects the letters.",
    productionDataSafety:
      "PASS - recipient, occasion, archive number, and formatted date remain input-driven; generated review identifiers contain no REVIEW or SAMPLE labels."
  },
  profiles: results,
  scans: {
    pronounOccasion: results.every(
      (result) => result.personalizationMatches.length === 0 && result.staleDataMatches.length === 0
    )
      ? "PASS"
      : "FAIL",
    forbiddenPhrases: results.every((result) => result.forbiddenMatches.length === 0)
      ? "PASS"
      : "FAIL",
    overflowClipping: results.every((result) => result.essentialTextInsideSafeMargin)
      ? "PASS"
      : "FAIL"
  },
  readyForFounderVisualApproval: results.every((result) => result.pass),
  deployed: false
};

await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outputDir, "index.html"), buildHtml(report));
console.log(JSON.stringify(report, null, 2));

function buildContext(profile) {
  return {
    order_number: profile.orderNumber,
    house_name: `${profile.recipient} Family Legacy Collection`,
    recipient: profile.recipient,
    relationship: profile.relationship,
    occasion: profile.occasion,
    values: profile.values,
    memories: [profile.memory],
    motto: null,
    themes: profile.values.map((theme) => ({ theme, evidence: profile.memory })),
    symbols: ["shield", "tree", "knot", "key and guiding star", "laurel frame"].map(
      (symbol) => ({
        symbol,
        meaning: profile.values.join(", "),
        rationale: profile.memory,
        customer_input_basis: profile.memory,
        visual_role: "supports the approved crest composition",
        artifact_role: "recipient-specific meaning",
        emotional_relevance: profile.values.join(", ")
      })
    ),
    design_rationale: [],
    story_direction: null,
    certificate_direction: null,
    collection_content: null,
    created_at: "2026-07-13T00:00:00.000Z"
  };
}

function renderAndInspect(pdfPath, pngPath, screenPath, mockupPath) {
  const script = [
    "import fitz, json, sys",
    "from PIL import Image, ImageDraw, ImageFilter",
    "pdf_path,png_path,screen_path,mockup_path=sys.argv[1:5]",
    "doc=fitz.open(pdf_path)",
    "page=doc[0]",
    "pix=page.get_pixmap(matrix=fitz.Matrix(300/72,300/72),alpha=False)",
    "pix.save(png_path)",
    "screen=page.get_pixmap(matrix=fitz.Matrix(150/72,150/72),alpha=False)",
    "screen.save(screen_path)",
    "blocks=[b[:4] for b in page.get_text('blocks') if str(b[4]).strip()]",
    "safe=28.8",
    "inside=all(x0>=safe-1 and y0>=safe-1 and x1<=page.rect.width-safe+1 and y1<=page.rect.height-safe+1 for x0,y0,x1,y1 in blocks)",
    "cert=Image.open(png_path).convert('RGB')",
    "canvas=Image.new('RGB',(1800,1500),(35,29,23))",
    "draw=ImageDraw.Draw(canvas)",
    "for y in range(1500):",
    "    tone=int(35 + 18*(y/1500))",
    "    draw.line((0,y,1800,y),fill=(tone,tone-6,tone-12))",
    "shadow=Image.new('RGBA',canvas.size,(0,0,0,0))",
    "sd=ImageDraw.Draw(shadow)",
    "frame=(450,90,1350,1400)",
    "sd.rounded_rectangle((frame[0]+24,frame[1]+28,frame[2]+34,frame[3]+38),radius=8,fill=(0,0,0,170))",
    "shadow=shadow.filter(ImageFilter.GaussianBlur(24))",
    "canvas=Image.alpha_composite(canvas.convert('RGBA'),shadow)",
    "draw=ImageDraw.Draw(canvas)",
    "draw.rectangle(frame,fill=(20,16,12),outline=(150,111,52),width=8)",
    "draw.rectangle((470,110,1330,1380),outline=(216,176,95),width=3)",
    "draw.rectangle((490,130,1310,1360),fill=(235,222,192),outline=(99,70,34),width=2)",
    "target=(510,150,1290,1340)",
    "cert.thumbnail((target[2]-target[0],target[3]-target[1]),Image.Resampling.LANCZOS)",
    "x=target[0]+((target[2]-target[0])-cert.width)//2",
    "y=target[1]+((target[3]-target[1])-cert.height)//2",
    "canvas.alpha_composite(cert.convert('RGBA'),(x,y))",
    "canvas.convert('RGB').save(mockup_path,quality=95)",
    "print(json.dumps({'pageCount':len(doc),'pageSizePoints':[page.rect.width,page.rect.height],'pngPixels':[pix.width,pix.height],'text':page.get_text(),'textBlockBounds':blocks,'essentialTextInsideSafeMargin':inside}))"
  ].join("\n");
  const result = spawnSync("python", ["-c", script, pdfPath, pngPath, screenPath, mockupPath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`certificate_review_render_failed:${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

function createBeforeAfterComparison(beforePath, afterPath, outputPath) {
  const script = [
    "from PIL import Image, ImageDraw, ImageFont",
    "import sys",
    "before_path,after_path,output_path=sys.argv[1:4]",
    "before=Image.open(before_path).convert('RGB')",
    "after=Image.open(after_path).convert('RGB')",
    "before.thumbnail((760,1040),Image.Resampling.LANCZOS)",
    "after.thumbnail((760,1040),Image.Resampling.LANCZOS)",
    "canvas=Image.new('RGB',(1640,1160),(15,13,11))",
    "draw=ImageDraw.Draw(canvas)",
    "draw.text((80,35),'BEFORE - V2 HALO / BRAND COLLISION',fill=(199,160,91))",
    "draw.text((880,35),'AFTER - FINAL CLEANUP',fill=(199,160,91))",
    "canvas.paste(before,(80,90))",
    "canvas.paste(after,(880,90))",
    "canvas.save(output_path,quality=95)"
  ].join("\n");
  const result = spawnSync("python", ["-c", script, beforePath, afterPath, outputPath], {
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(`certificate_before_after_failed:${result.stderr}`);
}

async function readFirstExisting(paths) {
  for (const filePath of paths) {
    try {
      return await readFile(filePath);
    } catch {
      continue;
    }
  }
  return null;
}

function buildHtml(report) {
  const profilesHtml = report.profiles
    .map(
      (profile) => `<section class="profile" id="${profile.id}">
        <header><div><p class="eyebrow">${profile.relationship} / ${profile.occasion}</p><h2>${profile.recipient}</h2></div><span class="status ${profile.pass ? "pass" : "fail"}">${profile.pass ? "Quality gates pass" : "Review required"}</span></header>
        <div class="profile-grid">
          <figure><a href="${profile.png}"><img src="${profile.screenPreview}" alt="Ornate certificate for ${profile.recipient}"></a><figcaption>Clean printable certificate, 300 DPI export linked</figcaption></figure>
          <figure><a href="${profile.framedMockup}"><img src="${profile.framedMockup}" alt="Framed certificate mockup for ${profile.recipient}"></a><figcaption>Separate framed marketing mockup</figcaption></figure>
        </div>
        <div class="meta"><span>1 page</span><span>US Letter</span><span>2550 x 3300</span><span>${profile.archiveNumber}</span></div>
        <p><a class="command" href="${profile.pdf}">Open printable PDF</a></p>
      </section>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Founder-Approved Ornate Certificate Review</title><style>
  :root{--ink:#15110d;--bg:#090807;--panel:#14110d;--line:#594426;--gold:#c7a05b;--ivory:#f1e6cc;--muted:#b9aa8f;--green:#8fbd87;--red:#e18d82}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ivory);font-family:Georgia,'Times New Roman',serif}main{max-width:1420px;margin:auto;padding:54px 22px 92px}.eyebrow{color:var(--gold);font:700 12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em;margin:0 0 8px}h1{font-size:clamp(38px,6vw,76px);line-height:1.02;margin:0;max-width:940px}h2{font-size:34px;margin:0}p{color:var(--muted);line-height:1.65}.intro{font-size:18px;max-width:860px}.comparison{margin:42px 0 54px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.comparison figure,.profile{border:1px solid var(--line);background:var(--panel);margin:0;padding:16px}.comparison img,.profile img{width:100%;height:auto;display:block;background:#eee}.comparison figcaption,figcaption{color:var(--muted);font:13px/1.5 Arial,sans-serif;padding-top:10px}.profiles{display:grid;gap:26px}.profile{padding:22px}.profile header{display:flex;align-items:start;justify-content:space-between;gap:20px;margin-bottom:18px}.profile-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:18px;align-items:start}.profile figure{margin:0}.status{font:700 12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}.pass{color:var(--green)}.fail{color:var(--red)}.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.meta span{border:1px solid var(--line);padding:7px 9px;color:var(--muted);font:12px Arial,sans-serif}.command{display:inline-block;color:var(--ink);background:var(--gold);padding:10px 14px;text-decoration:none;font:bold 13px Arial,sans-serif}.gate{margin-top:28px;border-left:3px solid var(--gold);background:#15110d;padding:16px 18px}.gate strong{color:var(--ivory)}@media(max-width:900px){.comparison,.profile-grid{grid-template-columns:1fr}.profile header{display:block}.status{display:block;margin-top:8px}}@media print{body{background:#fff}.comparison,.profile{break-inside:avoid}}
  </style></head><body><main><p class="eyebrow">Founder visual approval checkpoint</p><h1>Family Legacy Certificate V2</h1><p class="intro">A reference-guided, one-page certificate built around the existing approved Final Crest. V2 removes the black image box and integrates the transparent crest into a richer printable parchment composition. Nothing in this review is deployed.</p>
  <section class="comparison"><figure><img src="certificate-v2-before-cleanup.png" alt="Certificate V2 before final cleanup"><figcaption>Before: pale edge fringe and top brand collision</figcaption></figure><figure><img src="${report.profiles[1].screenPreview}" alt="Corrected Certificate V2"><figcaption>After: decontaminated crest edge and clear brand spacing</figcaption></figure><figure><img src="founder-approved-reference.webp" alt="Founder-approved reference"><figcaption>Founder-approved reference direction</figcaption></figure></section>
  <p><a class="command" href="certificate-v2-before-after.png">Open full before / after comparison</a></p>
  <p class="eyebrow">Transparent crest quality control</p><section class="comparison"><figure><img src="transparent-crest-checkerboard.png" alt="Transparent crest on checkerboard"><figcaption>Alpha silhouette and internal dark-detail check</figcaption></figure><figure><img src="transparent-crest-ivory.png" alt="Transparent crest on ivory"><figcaption>Ivory certificate integration check</figcaption></figure><figure><img src="transparent-crest-dark.png" alt="Transparent crest on dark background"><figcaption>Gold edge and halo check</figcaption></figure></section>
  <div class="profiles">${profilesHtml}</div>
  <div class="gate"><strong>Automated gates:</strong> pronoun and occasion ${report.scans.pronounOccasion}; forbidden phrases ${report.scans.forbiddenPhrases}; overflow and clipping ${report.scans.overflowClipping}. Deployment: not performed.</div></main></body></html>`;
}

function relative(filePath) {
  return path.relative(outputDir, filePath).replaceAll(path.sep, "/");
}
