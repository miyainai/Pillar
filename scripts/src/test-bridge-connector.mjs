// Bridge connectors stay visible over the column highlight when a pillar is selected or hovered.
// Standalone runner; the same checks run inside test-pillar.mjs as part of the pillar-browser workflow.
import { chromium } from 'playwright'
import { globSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { checkSelectedBridgeConnectors, checkHoveredBridgeConnectors } from './lib/bridge-layering.mjs'

process.chdir(fileURLToPath(new URL('../../', import.meta.url)))
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || globSync('/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome')[0],
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const base = process.env.PILLAR_TEST_URL || 'http://localhost:80'
mkdirSync('generated-artifacts/bridge-connector', { recursive: true })
const shot = (prefix) => (name) => page.screenshot({ path: `generated-artifacts/bridge-connector/${prefix}-${name}.png` })

try {
  await page.goto(base + '/c/c-fernhill/progress')
  await page.waitForFunction(() => !!window.__pillar)
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  const selected = await checkSelectedBridgeConnectors(page, { screenshot: shot('progress') })
  const hoveredProgress = await checkHoveredBridgeConnectors(page, { screenshot: shot('progress') })

  // The Dashboard shares the component; selecting there navigates away, so only hover is checked.
  await page.goto(base + '/c/c-fernhill')
  await page.waitForFunction(() => !!window.__pillar)
  const hoveredDashboard = await checkHoveredBridgeConnectors(page, { screenshot: shot('dashboard') })

  assert.deepEqual(errors, [], 'no page errors')
  console.log(`bridge connector layering OK (progress: ${selected} selected, ${hoveredProgress} hovered; dashboard: ${hoveredDashboard} hovered)`)
} finally {
  await browser.close()
}
