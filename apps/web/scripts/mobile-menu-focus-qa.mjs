/* global document, window */

import { strict as assert } from "node:assert";
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3200";
const browser = await chromium.launch({ headless: true });
const results = [];

async function expectTriggerFocus(page, trigger, scrollY) {
  await page.waitForFunction(
    (button) => document.activeElement === button,
    await trigger.elementHandle()
  );
  assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  assert.equal(await page.evaluate(() => window.scrollY), scrollY);
  assert.equal(
    await page.evaluate((button) => document.activeElement === button, await trigger.elementHandle()),
    true
  );
}

async function openWithKeyboard(page, trigger) {
  await trigger.focus();
  await trigger.press("Enter");
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    "Close navigation menu"
  );
}

async function pointerClickWithoutLocatorScroll(page, locator, inset = 0.5) {
  const box = await locator.boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + box.width * inset, box.y + box.height * inset);
}

try {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const trigger = page.locator(".mobile-menu-button");

    assert.equal(await trigger.getAttribute("aria-label"), "Open navigation menu");
    assert.equal(await trigger.getAttribute("aria-controls"), "mobile-navigation");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#mobile-navigation").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);

    await page.evaluate(() => window.scrollTo(0, 120));
    const scrollY = await page.evaluate(() => window.scrollY);

    await openWithKeyboard(page, trigger);
    assert.equal(await page.locator("#mobile-navigation[role='dialog'][aria-modal='true']").count(), 1);
    assert.equal(await page.locator(".mobile-menu-backdrop").getAttribute("tabindex"), "-1");

    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Begin Their Legacy");
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      "Close navigation menu"
    );
    await page.keyboard.press("Escape");
    await expectTriggerFocus(page, trigger, scrollY);

    await openWithKeyboard(page, trigger);
    const closeButtonScrollY = await page.evaluate(() => window.scrollY);
    await pointerClickWithoutLocatorScroll(
      page,
      page.locator("#mobile-navigation").getByRole("button", { name: "Close navigation menu" })
    );
    await expectTriggerFocus(page, trigger, closeButtonScrollY);

    await openWithKeyboard(page, trigger);
    const overlayScrollY = await page.evaluate(() => window.scrollY);
    await page.mouse.click(2, 80);
    await expectTriggerFocus(page, trigger, overlayScrollY);

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await openWithKeyboard(page, trigger);
      const repeatedScrollY = await page.evaluate(() => window.scrollY);
      await page.keyboard.press("Escape");
      await expectTriggerFocus(page, trigger, repeatedScrollY);
    }

    await openWithKeyboard(page, trigger);
    await Promise.all([
      page.waitForURL(`${baseUrl}/journal`),
      page.locator("#mobile-navigation").getByRole("link", { name: "Journal", exact: true }).click()
    ]);
    assert.equal(new URL(page.url()).pathname, "/journal");
    assert.notEqual(
      await page.evaluate(() => document.activeElement?.getAttribute("aria-label")),
      "Open navigation menu"
    );

    results.push({
      width: viewport.width,
      focusRestoration: "PASS",
      focusTrap: "PASS",
      navigation: "PASS",
      horizontalOverflow: "NONE"
    });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ status: "PASS", results }, null, 2));
