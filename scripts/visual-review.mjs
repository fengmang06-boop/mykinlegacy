import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/* global document, window */

const DEFAULT_BASE_URL = "http://localhost:3000";
const MIN_SCREENSHOT_BYTES = 20 * 1024;
const DEFAULT_LATEST_ORDER = "AHL-20260701-01KWEJEY";
const DEFAULT_FOUNDER_ORDER = "AHL-20260701-01KWECW4";

const basePages = [
  { key: "home", label: "Homepage", path: "/" },
  { key: "create", label: "Create", path: "/create" },
  {
    key: "collection",
    label: "Family Legacy Collection",
    path: "/family-legacy-collection"
  }
];

let activePages = basePages;
let activeOutputDir = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "artifacts", "visual-review");

const viewports = [
  { key: "desktop", width: 1440, height: 1200 },
  { key: "tablet", width: 768, height: 1200 },
  {
    key: "mobile",
    width: 390,
    height: 1200,
    isMobile: true,
    deviceScaleFactor: 2
  }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    adminToken: process.env.ADMIN_ACCESS_TOKEN ?? "",
    baseUrl: DEFAULT_BASE_URL,
    founderOrder: DEFAULT_FOUNDER_ORDER,
    fullSite: false,
    latestOrder: DEFAULT_LATEST_ORDER,
    noClean: false,
    only: "",
    orderNumber: "",
    outputDir: path.join(repoRoot, "artifacts", "visual-review")
  };

  for (const arg of args) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    }
    if (arg.startsWith("--order-number=")) {
      options.orderNumber = arg.slice("--order-number=".length);
    }
    if (arg.startsWith("--latest-order=")) {
      options.latestOrder = arg.slice("--latest-order=".length);
    }
    if (arg.startsWith("--founder-order=")) {
      options.founderOrder = arg.slice("--founder-order=".length);
    }
    if (arg.startsWith("--output-dir=")) {
      options.outputDir = arg.slice("--output-dir=".length);
    }
    if (arg === "--full-site") {
      options.fullSite = true;
    }
    if (arg === "--no-clean") {
      options.noClean = true;
    }
    if (arg.startsWith("--only=")) {
      options.only = arg.slice("--only=".length);
    }
  }

  return {
    adminToken: options.adminToken.trim(),
    baseUrl: options.baseUrl.replace(/\/+$/, ""),
    founderOrder: options.founderOrder.trim(),
    fullSite: options.fullSite,
    latestOrder: options.latestOrder.trim(),
    noClean: options.noClean,
    only: options.only
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    orderNumber: options.orderNumber.trim(),
    outputDir: path.resolve(repoRoot, options.outputDir)
  };
}

function getGitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8"
    }).trim();
  } catch {
    return "unknown";
  }
}

function buildPageUrl(baseUrl, pagePath) {
  if (pagePath === "/") {
    return `${baseUrl}/`;
  }

  return `${baseUrl}${pagePath}`;
}

function displayPath(pageDefinition) {
  return pageDefinition.reportPath ?? pageDefinition.path;
}

function capturePath(pageDefinition) {
  return pageDefinition.capturePath ?? pageDefinition.path;
}

function sanitizeUrl(value) {
  return String(value).replace(/([?&]token=)[^&#]*/gi, "$1[redacted]");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function pngDimensions(filePath) {
  const buffer = await fs.readFile(filePath);
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer.toString("ascii", 1, 4) === "PNG";

  if (!isPng) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function prepareOutputDir({ noClean = false } = {}) {
  const resolvedOutput = path.resolve(activeOutputDir);
  const resolvedRepo = path.resolve(repoRoot);

  if (!resolvedOutput.startsWith(resolvedRepo)) {
    throw new Error(`Refusing to clean output outside repository: ${resolvedOutput}`);
  }

  if (!noClean) {
    await fs.rm(resolvedOutput, { recursive: true, force: true });
  }
  await fs.mkdir(resolvedOutput, { recursive: true });
}

async function waitForFonts(page, warnings) {
  try {
    await page.evaluate(async () => {
      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }
    });
    await page.waitForTimeout(800);
  } catch (error) {
    warnings.push(`Font readiness wait failed: ${error.message}`);
  }
}

async function gotoWithRetry(page, pageUrl, warnings) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      warnings.push(
        `Navigation attempt ${attempt} failed: ${error.message.replace(/\s+/g, " ")} Retrying.`
      );
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

async function forceLazyImages(page, warnings) {
  try {
    await page.evaluate(() => {
      for (const image of Array.from(document.images)) {
        image.loading = "eager";

        const dataset = image.dataset;
        if (!image.getAttribute("src") && dataset.src) {
          image.setAttribute("src", dataset.src);
        }

        if (!image.getAttribute("srcset") && dataset.srcset) {
          image.setAttribute("srcset", dataset.srcset);
        }
      }
    });
  } catch (error) {
    warnings.push(`Lazy image preparation failed: ${error.message}`);
  }
}

async function scrollThroughPage(page) {
  const viewport = page.viewportSize() ?? { height: 1200 };
  const step = Math.max(240, Math.floor(viewport.height * 0.65));
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  for (let y = 0; y < scrollHeight; y += step) {
    await page.evaluate((position) => window.scrollTo(0, position), y);
    await page.waitForTimeout(180);
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function disableMotionAndOverlays(page, warnings) {
  try {
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-delay: 0s !important;
          animation-duration: 0.001s !important;
          animation-iteration-count: 1 !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
          transition-delay: 0s !important;
          transition-duration: 0s !important;
        }

        [data-testid*="cookie" i],
        [id*="cookie" i],
        [class*="cookie" i],
        [aria-label*="cookie" i],
        [id*="intercom" i],
        [class*="intercom" i],
        [id*="crisp" i],
        [class*="crisp" i] {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `
    });
  } catch (error) {
    warnings.push(`Motion/overlay CSS injection failed: ${error.message}`);
  }
}

async function waitForImages(page, warnings) {
  try {
    await page.waitForFunction(
      () =>
        Array.from(document.images).every((image) => {
          const url = image.currentSrc || image.src;
          return !url || (image.complete && image.naturalWidth > 0);
        }),
      undefined,
      { timeout: 15000 }
    );
  } catch {
    warnings.push("Some images did not report complete before screenshot.");
  }
}

async function collectFailedImages(page) {
  return page.evaluate(() =>
    Array.from(document.images)
      .map((image) => ({
        url: image.currentSrc || image.src,
        alt: image.alt || "",
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight
      }))
      .filter((image) => image.url && (!image.complete || image.naturalWidth === 0))
  );
}

async function collectPageMetrics(page) {
  return page.evaluate(() => ({
    title: document.title,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight
  }));
}

function validateScreenshot({ dimensions, fileSize, metrics, viewport }) {
  const warnings = [];

  if (!fileSize || fileSize <= MIN_SCREENSHOT_BYTES) {
    warnings.push(
      `Screenshot file is small (${formatBytes(fileSize)}); expected more than ${formatBytes(
        MIN_SCREENSHOT_BYTES
      )}.`
    );
  }

  if (!dimensions) {
    warnings.push("Screenshot dimensions could not be read.");
  } else if (metrics.scrollHeight > viewport.height + 100 && dimensions.height <= viewport.height) {
    warnings.push(
      `Screenshot height (${dimensions.height}px) is not greater than viewport height (${viewport.height}px) for a long page.`
    );
  }

  if (metrics.scrollWidth > metrics.clientWidth + 2) {
    warnings.push(
      `Page may have horizontal overflow: scrollWidth ${metrics.scrollWidth}px, clientWidth ${metrics.clientWidth}px.`
    );
  }

  return warnings;
}

function simplifyRequestFailure(request) {
  return {
    url: request.url(),
    resourceType: request.resourceType(),
    errorText: request.failure()?.errorText ?? "unknown"
  };
}

function simplifyResponseFailure(response) {
  return {
    url: response.url(),
    resourceType: response.request().resourceType(),
    status: response.status(),
    statusText: response.statusText()
  };
}

async function captureScreenshot(browser, baseUrl, pageDefinition, viewportDefinition) {
  const warnings = [...(pageDefinition.warnings ?? [])];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const fileName = `${pageDefinition.key}-${viewportDefinition.key}.png`;
  const filePath = path.join(activeOutputDir, fileName);
  const pageUrl = buildPageUrl(baseUrl, capturePath(pageDefinition));
  const reportPageUrl = buildPageUrl(baseUrl, displayPath(pageDefinition));

  const context = await browser.newContext({
    viewport: {
      width: viewportDefinition.width,
      height: viewportDefinition.height
    },
    deviceScaleFactor: viewportDefinition.deviceScaleFactor ?? 1,
    isMobile: viewportDefinition.isMobile ?? false
  });

  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push({
        text: message.text(),
        location: message.location()
      });
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack ?? ""
    });
  });

  page.on("requestfailed", (request) => {
    if (["image", "stylesheet", "script"].includes(request.resourceType())) {
      failedRequests.push(simplifyRequestFailure(request));
    }
  });

  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      ["image", "stylesheet", "script"].includes(response.request().resourceType())
    ) {
      failedRequests.push(simplifyResponseFailure(response));
    }
  });

  try {
    await gotoWithRetry(page, pageUrl, warnings);

    try {
      await page.waitForLoadState("networkidle", { timeout: 30000 });
    } catch {
      warnings.push("Timed out waiting for networkidle; continuing with capture.");
    }

    await waitForFonts(page, warnings);
    await forceLazyImages(page, warnings);
    await scrollThroughPage(page);
    await waitForImages(page, warnings);
    await disableMotionAndOverlays(page, warnings);

    const failedImages = await collectFailedImages(page);
    const metrics = await collectPageMetrics(page);

    await page.screenshot({
      path: filePath,
      fullPage: true,
      animations: "disabled",
      caret: "hide",
      timeout: 60000
    });

    const fileExists = existsSync(filePath);
    const fileSize = fileExists ? (await fs.stat(filePath)).size : 0;
    const dimensions = fileExists ? await pngDimensions(filePath) : null;
    warnings.push(...validateScreenshot({ dimensions, fileSize, metrics, viewport: viewportDefinition }));

    return {
      pageKey: pageDefinition.key,
      pageLabel: pageDefinition.label,
      pagePath: displayPath(pageDefinition),
      pageUrl: reportPageUrl,
      viewport: viewportDefinition,
      screenshot: fileName,
      screenshotPath: filePath,
      dimensions,
      scrollHeight: metrics.scrollHeight,
      scrollWidth: metrics.scrollWidth,
      clientWidth: metrics.clientWidth,
      fileSize,
      warnings,
      failedImages: failedImages.map((image) => ({ ...image, url: sanitizeUrl(image.url) })),
      failedRequests: failedRequests.map((request) => ({
        ...request,
        url: sanitizeUrl(request.url)
      })),
      consoleErrors,
      pageErrors
    };
  } catch (error) {
    warnings.push(`Capture failed: ${error.message}`);

    return {
      pageKey: pageDefinition.key,
      pageLabel: pageDefinition.label,
      pagePath: displayPath(pageDefinition),
      pageUrl: reportPageUrl,
      viewport: viewportDefinition,
      screenshot: fileName,
      screenshotPath: filePath,
      dimensions: null,
      scrollHeight: 0,
      scrollWidth: 0,
      clientWidth: viewportDefinition.width,
      fileSize: 0,
      warnings,
      failedImages: [],
      failedRequests,
      consoleErrors,
      pageErrors
    };
  } finally {
    await context.close();
  }
}

function groupScreenshots(screenshots) {
  return activePages.map((pageDefinition) => ({
    ...pageDefinition,
    path: displayPath(pageDefinition),
    capturePath: undefined,
    reportPath: undefined,
    screenshots: screenshots.filter((screenshot) => screenshot.pageKey === pageDefinition.key)
  }));
}

function detailsList(title, items, renderer) {
  if (items.length === 0) {
    return "";
  }

  return `
    <details class="details" open>
      <summary>${escapeHtml(title)} (${items.length})</summary>
      <ul>
        ${items.map((item) => `<li>${renderer(item)}</li>`).join("\n")}
      </ul>
    </details>
  `;
}

function renderHtmlReport(report) {
  const pageSections = report.pages
    .map(
      (pageGroup) => `
        <section class="page-group">
          <div class="page-heading">
            <p class="eyebrow">${escapeHtml(pageGroup.path)}</p>
            <h2>${escapeHtml(pageGroup.label)}</h2>
          </div>
          <div class="screenshot-grid">
            ${pageGroup.screenshots
              .map((item) => {
                const warningCount =
                  item.warnings.length +
                  item.failedImages.length +
                  item.failedRequests.length +
                  item.consoleErrors.length +
                  item.pageErrors.length;
                const statusClass = warningCount > 0 ? "warning" : "pass";

                return `
                  <article class="shot-card ${statusClass}">
                    <header>
                      <div>
                        <h3>${escapeHtml(item.viewport.key)}</h3>
                        <p>${item.viewport.width} x ${item.viewport.height}${
                          item.viewport.deviceScaleFactor
                            ? ` @${item.viewport.deviceScaleFactor}x`
                            : ""
                        }</p>
                      </div>
                      <span>${warningCount > 0 ? `WARNING ${warningCount}` : "PASS"}</span>
                    </header>
                    <dl>
                      <div><dt>URL</dt><dd><a href="${escapeHtml(item.pageUrl)}">${escapeHtml(
                        item.pageUrl
                      )}</a></dd></div>
                      <div><dt>Screenshot</dt><dd>${
                        item.dimensions
                          ? `${item.dimensions.width} x ${item.dimensions.height}`
                          : "unavailable"
                      }</dd></div>
                      <div><dt>Scroll height</dt><dd>${item.scrollHeight}px</dd></div>
                      <div><dt>File size</dt><dd>${formatBytes(item.fileSize)}</dd></div>
                    </dl>
                    <a class="image-link" href="${escapeHtml(item.screenshot)}">
                      <img src="${escapeHtml(item.screenshot)}" alt="${escapeHtml(
                        `${item.pageLabel} ${item.viewport.key} screenshot`
                      )}" loading="lazy" />
                    </a>
                    ${detailsList("Warnings", item.warnings, (warning) => escapeHtml(warning))}
                    ${detailsList(
                      "Failed images",
                      item.failedImages,
                      (image) => `${escapeHtml(image.url)}`
                    )}
                    ${detailsList(
                      "Failed requests",
                      item.failedRequests,
                      (request) =>
                        `${escapeHtml(request.resourceType)} ${escapeHtml(request.url)} ${
                          request.status ? `(${request.status})` : escapeHtml(request.errorText ?? "")
                        }`
                    )}
                    ${detailsList(
                      "Console errors",
                      item.consoleErrors,
                      (error) => escapeHtml(error.text)
                    )}
                    ${detailsList(
                      "Page errors",
                      item.pageErrors,
                      (error) => escapeHtml(error.message)
                    )}
                  </article>
                `;
              })
              .join("\n")}
          </div>
        </section>
      `
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MyKinLegacy Visual Review</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0a08;
        --panel: #15120d;
        --panel-soft: #1d1811;
        --border: rgba(212, 175, 92, 0.26);
        --gold: #d8b45f;
        --ivory: #f7f0df;
        --muted: #b6a98d;
        --danger: #ffb4a8;
        --success: #a9e6be;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background:
          radial-gradient(circle at top left, rgba(216, 180, 95, 0.12), transparent 34rem),
          var(--bg);
        color: var(--ivory);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      a {
        color: var(--gold);
      }

      .shell {
        margin: 0 auto;
        max-width: 1440px;
        padding: 40px 28px 72px;
      }

      .hero {
        border: 1px solid var(--border);
        background: linear-gradient(135deg, rgba(29, 24, 17, 0.94), rgba(11, 10, 8, 0.92));
        border-radius: 22px;
        padding: 30px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.34);
      }

      .eyebrow {
        color: var(--gold);
        font-size: 0.76rem;
        letter-spacing: 0.12em;
        margin: 0 0 8px;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3 {
        letter-spacing: 0;
        margin: 0;
      }

      h1 {
        font-size: clamp(2rem, 4vw, 4rem);
      }

      .meta {
        color: var(--muted);
        display: grid;
        gap: 6px;
        margin-top: 20px;
      }

      .page-group {
        margin-top: 42px;
      }

      .page-heading {
        margin-bottom: 18px;
      }

      .screenshot-grid {
        display: grid;
        gap: 22px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .shot-card {
        background: linear-gradient(180deg, rgba(29, 24, 17, 0.94), rgba(13, 12, 10, 0.96));
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
        padding: 16px;
      }

      .shot-card.warning {
        border-color: rgba(255, 180, 168, 0.54);
      }

      .shot-card header {
        align-items: flex-start;
        display: flex;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }

      .shot-card header p {
        color: var(--muted);
        margin: 4px 0 0;
      }

      .shot-card header span {
        border: 1px solid currentColor;
        border-radius: 999px;
        color: var(--success);
        flex: 0 0 auto;
        font-size: 0.72rem;
        padding: 5px 9px;
      }

      .shot-card.warning header span {
        color: var(--danger);
      }

      dl {
        color: var(--muted);
        display: grid;
        font-size: 0.86rem;
        gap: 8px;
        margin: 0 0 14px;
      }

      dl div {
        display: grid;
        gap: 4px;
      }

      dt {
        color: var(--ivory);
        font-weight: 700;
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }

      .image-link {
        background: #050504;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        display: block;
        overflow: hidden;
      }

      img {
        display: block;
        height: auto;
        width: 100%;
      }

      .details {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        color: var(--muted);
        margin-top: 14px;
        padding-top: 12px;
      }

      .details summary {
        color: var(--danger);
        cursor: pointer;
        font-weight: 700;
      }

      .details ul {
        margin: 10px 0 0;
        padding-left: 20px;
      }

      .details li {
        overflow-wrap: anywhere;
        padding: 4px 0;
      }

      @media (max-width: 1100px) {
        .screenshot-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">MyKinLegacy QA</p>
        <h1>Visual Review Report</h1>
        <p>Internal visual review only. Do not link from public navigation.</p>
        <div class="meta">
          <div><strong>Captured:</strong> ${escapeHtml(report.capturedAt)}</div>
          <div><strong>Base URL:</strong> ${escapeHtml(report.baseUrl)}</div>
          <div><strong>Commit:</strong> ${escapeHtml(report.commit)}</div>
        </div>
      </section>
      ${pageSections}
    </main>
  </body>
</html>
`;
}

async function writeReports(report) {
  const jsonPath = path.join(activeOutputDir, "report.json");
  const htmlPath = path.join(activeOutputDir, "index.html");

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(htmlPath, renderHtmlReport(report), "utf8");

  return { jsonPath, htmlPath };
}

async function main() {
  const { adminToken, baseUrl, founderOrder, fullSite, latestOrder, noClean, only, orderNumber, outputDir } = parseArgs();
  const capturedAt = new Date().toISOString();
  const commit = getGitCommit();
  activeOutputDir = outputDir;
  activePages = fullSite
    ? createFullSitePages({ adminToken, founderOrder, latestOrder })
    : orderNumber
    ? [
        ...basePages,
        {
          key: "checkout",
          label: "Checkout",
          path: `/checkout/${encodeURIComponent(orderNumber)}`
        },
        {
          key: "order-status",
          label: "Order Status",
          path: `/order-status/${encodeURIComponent(orderNumber)}`
        }
      ]
    : basePages;
  if (only.length > 0) {
    const allowed = new Set(only);
    activePages = activePages.filter((page) => allowed.has(page.key));
  }

  await prepareOutputDir({ noClean });

  const browser = await chromium.launch({ headless: true });
  const screenshots = [];

  try {
    for (const pageDefinition of activePages) {
      for (const viewportDefinition of viewports) {
        console.log(
          `Capturing ${displayPath(pageDefinition)} at ${viewportDefinition.key} from ${baseUrl}`
        );
        const result = await captureScreenshot(
          browser,
          baseUrl,
          pageDefinition,
          viewportDefinition
        );
        screenshots.push(result);
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    baseUrl,
    commit,
    capturedAt,
    notes: [
      "Internal visual review only. Do not link from public navigation.",
      adminToken
        ? "Admin pages were captured with a redacted token in the URL."
        : "ADMIN_ACCESS_TOKEN was not available locally; admin pages were captured in locked state."
    ],
    pages: groupScreenshots(screenshots),
    screenshots
  };

  const { htmlPath, jsonPath } = await writeReports(report);
  const warningCount = screenshots.reduce(
    (count, screenshot) =>
      count +
      screenshot.warnings.length +
      screenshot.failedImages.length +
      screenshot.failedRequests.length +
      screenshot.consoleErrors.length +
      screenshot.pageErrors.length,
    0
  );

  console.log(`Visual review complete: ${htmlPath}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Screenshots: ${screenshots.length}`);
  console.log(`Warnings/errors recorded: ${warningCount}`);
}

function createFullSitePages({ adminToken, founderOrder, latestOrder }) {
  const adminSuffix = adminToken ? `?token=${encodeURIComponent(adminToken)}` : "";
  const adminWarning = adminToken
    ? []
    : ["ADMIN_ACCESS_TOKEN was not available to the capture process; captured locked admin state."];

  return [
    { key: "home", label: "Homepage", path: "/" },
    { key: "create", label: "Create", path: "/create" },
    {
      key: "collection",
      label: "Family Legacy Collection",
      path: "/family-legacy-collection"
    },
    {
      key: "interview",
      label: "Guided Interview",
      path: `/create/${encodeURIComponent(latestOrder)}`
    },
    {
      key: "checkout",
      label: "Checkout",
      path: `/checkout/${encodeURIComponent(latestOrder)}`
    },
    {
      key: "payment-success",
      label: "Payment Success",
      path: `/payment/success?order_number=${encodeURIComponent(latestOrder)}`
    },
    {
      key: "order-status-latest",
      label: "Order Status Latest",
      path: `/order-status/${encodeURIComponent(latestOrder)}`
    },
    {
      key: "order-status-founder",
      label: "Order Status Founder",
      path: `/order-status/${encodeURIComponent(founderOrder)}`
    },
    {
      key: "admin-orders",
      label: "Admin Orders",
      capturePath: `/admin/orders${adminSuffix}`,
      path: "/admin/orders",
      reportPath: "/admin/orders?token=[redacted]",
      warnings: adminWarning
    },
    {
      key: "admin-email-logs",
      label: "Admin Email Logs",
      capturePath: `/admin/email-logs${adminSuffix}`,
      path: "/admin/email-logs",
      reportPath: "/admin/email-logs?token=[redacted]",
      warnings: adminWarning
    },
    {
      key: "admin-download-tokens",
      label: "Admin Download Tokens",
      capturePath: `/admin/download-tokens${adminSuffix}`,
      path: "/admin/download-tokens",
      reportPath: "/admin/download-tokens?token=[redacted]",
      warnings: adminWarning
    }
  ];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
