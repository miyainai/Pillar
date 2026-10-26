import { chromium } from "playwright";
import { globSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { checkSelectedBridgeConnectors, checkHoveredBridgeConnectors } from "./lib/bridge-layering.mjs";

process.chdir(fileURLToPath(new URL("../../", import.meta.url)));

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || globSync("/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome")[0];
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.PILLAR_TEST_URL || "http://localhost:80";
mkdirSync("generated-artifacts/pillar", { recursive: true });
const shot = (name) => page.screenshot({ path: `generated-artifacts/pillar/${name}.png`, fullPage: true });
const visit = async (path) => {
  await page.goto(`${base}${path}`);
  await page.waitForFunction(() => !!window.__pillar);
};
const viewAs = async (name) => {
  await page.getByTitle("View as (demo mode)").click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
};

try {
  await visit("/");
  await page.evaluate(() => window.__pillar.getState().resetDemo());
  await page.getByRole("link", { name: /Fernhill Foods.*Specialty snacks/ }).click();
  await page.getByRole("heading", { name: "Fernhill Foods", exact: true }).waitFor();
  await shot("dashboard");
  // Dashboard bridge: hovering a pillar must not paint the highlight over the dashed connectors.
  const dashboardHovered = await checkHoveredBridgeConnectors(page);
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  await page.getByText("Finance leadership transition", { exact: true }).first().waitFor();
  await shot("plan");
  await viewAs("Taylor Brooks");
  assert.equal(await page.getByText("Finance leadership transition", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("link", { name: "Progress", exact: true }).count(), 0);
  await shot("management-plan");
  await viewAs("Casey Nguyen");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  const update = `Migration check: direct materials savings ${Date.now()}`;
  await page.getByPlaceholder("What moved? One or two lines.").fill(update);
  await page.getByRole("button", { name: "Post update", exact: true }).click();
  await page.getByText(update, { exact: true }).first().waitFor();
  await viewAs("Alex Chen");
  await page.getByText(update, { exact: true }).first().waitFor();
  await page.reload();
  await page.getByText(update, { exact: true }).first().waitFor();
  await shot("persisted-update");
  for (const path of ["/c/c-fernhill/asks", "/c/c-fernhill/progress", "/c/c-fernhill/progress/export", "/c/c-fernhill/settings"]) {
    await visit(path);
    assert.ok((await page.locator("body").innerText()).length > 100, path);
    await shot(path.split("/").at(-1));
  }
  // Progress bridge: selecting and hovering a pillar must keep the connectors above the highlight.
  await visit("/c/c-fernhill/progress");
  const progressSelected = await checkSelectedBridgeConnectors(page);
  const progressHovered = await checkHoveredBridgeConnectors(page);
  await shot("progress-bridge-layering");
  await visit("/setup");
  await page.getByRole("button", { name: "Fill with demo files" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const docs = await page.locator("body").innerText();
  assert.ok(!docs.includes("Could not read"), docs);
  assert.ok(docs.includes("Fernhill IC Memo.pdf"), docs);
  assert.ok(docs.includes("Fernhill Model Summary.xlsx"), docs);
  await shot("extracted-documents");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Generate draft plan", exact: true }).click();
  const review = page.getByText(/pre-built Fernhill draft|pre-generated demo plan/i).first();
  await review.waitFor();
  // Without an API key the fallback is the expected path and must not read as a warning.
  assert.ok(!(await page.locator("body").innerText()).includes("Reason: AI is not configured"));
  await shot("generated-demo-plan");

  // Persona deep links: `?as=` opens as that person, respects redirects, and leaves the URL clean.
  const viewer = () => page.evaluate(() => window.__pillar.getState().userId);
  await visit("/c/c-fernhill/asks?as=sam");
  await page.getByRole("heading", { name: /Asks/ }).first().waitFor();
  assert.equal(await viewer(), "u-sam");
  assert.equal(new URL(page.url()).search, "");
  assert.equal(new URL(page.url()).pathname, "/c/c-fernhill/asks");
  await page.getByRole("link", { name: "Plan", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/c/c-fernhill/plan");
  await shot("deep-link-sam");
  await visit("/c/c-fernhill?as=taylor");
  await page.getByRole("heading", { name: "Fernhill Foods", exact: true }).waitFor();
  assert.equal(await viewer(), "u-taylor");
  assert.equal(await page.getByRole("link", { name: "Progress", exact: true }).count(), 0);
  await shot("deep-link-taylor");
  await visit("/c/c-fernhill/progress?as=u-taylor");
  await page.waitForURL((u) => u.pathname === "/c/c-fernhill" && u.search === "");
  await visit("/c/c-fernhill/asks?as=pat");
  await page.waitForURL((u) => u.pathname === "/c/c-kestrel/asks" && u.search === "");
  assert.equal(await viewer(), "u-pat");
  await visit("/c/c-fernhill/asks?as=nobody");
  assert.equal(await viewer(), "u-pat");
  assert.equal(new URL(page.url()).search, "");
  await visit("/c/c-fernhill/asks?as=alex");
  assert.equal(await viewer(), "u-alex");
  await page.getByTitle("View as (demo mode)").click();
  await page.getByRole("button", { name: /Copy demo link/ }).click();
  await page.getByText("Demo link copied").waitFor();

  assert.deepEqual(errors, []);
  console.log(`PASS: dashboard, role visibility, posting and persisted updates, routes, bridge connector layering (dashboard hover ${dashboardHovered}, progress select ${progressSelected} / hover ${progressHovered}), PDF/XLSX extraction, demo plan generation, persona deep links; no browser runtime errors.`);
} finally {
  await page.evaluate(() => window.__pillar?.getState().resetDemo()).catch(() => {});
  await browser.close();
}
