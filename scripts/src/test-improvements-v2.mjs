// Browser checks for the v2 improvements: EBITDA bridge (hover, click, modes),
// comparison period, Excel exports on every chart/table, board supplement.
import { chromium } from 'playwright'
import { globSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

process.chdir(fileURLToPath(new URL('../../', import.meta.url)))
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || globSync('/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome')[0],
  args: ['--no-sandbox'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
const base = process.env.PILLAR_TEST_URL || 'http://localhost:80'
mkdirSync('generated-artifacts/improvements-v2', { recursive: true })
const shot = (name, fullPage = true) => page.screenshot({ path: `generated-artifacts/improvements-v2/${name}.png`, fullPage })
const visit = async (path) => {
  await page.goto(base + path)
  await page.waitForFunction(() => !!window.__pillar)
}
const download = async (button) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), button.click()])
  const path = `generated-artifacts/improvements-v2/${dl.suggestedFilename()}`
  await dl.saveAs(path)
  assert.ok(statSync(path).size > 2000, `${path} should be a real workbook`)
  assert.match(dl.suggestedFilename(), /\.xlsx$/)
  return path
}
const see = (locator) => locator.first().waitFor({ state: 'visible', timeout: 5000 })
const hasNativeChart = async (file, kind) => {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(readFileSync(file))
  const chart = zip.file('xl/charts/chart1.xml')
  return !!chart && (await chart.async('string')).includes(`<c:${kind}>`)
}
const noOverflow = async () => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit horizontally')
}

try {
  await visit('/c/c-fernhill/progress')
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  await page.getByRole('heading', { name: 'Progress', exact: true }).waitFor()

  // The old table, commentary column and area chart are gone.
  assert.equal(await page.getByText('OP commentary').count(), 0)
  assert.equal(await page.getByText('By pillar', { exact: true }).count(), 0)
  assert.equal(await page.locator('.recharts-surface').count(), 0)

  // Bridge: entry, one bar per pillar with a target, target.
  const chart = page.getByRole('img', { name: /EBITDA bridge/ })
  const bars = page.getByRole('button', { name: /realized of/ })
  assert.equal(await bars.count(), 5, 'five pillars carry an EBITDA target (the enabler pillar is footnoted)')
  await see(page.getByText('Not shown (no EBITDA target): Finance leadership transition'))
  await see(chart.getByText('$40.0M', { exact: true }))
  await see(chart.getByText('$65.0M', { exact: true }))
  await see(chart.getByText('Entry', { exact: true }))
  await see(chart.getByText('Target', { exact: true }))
  await shot('progress-default')

  // Hover shows a small summary.
  await bars.first().hover()
  const tip = page.getByRole('tooltip')
  await tip.waitFor()
  assert.match(await tip.innerText(), /Procurement savings[\s\S]*Target[\s\S]*Realized[\s\S]*To go[\s\S]*Click for detail/)
  await shot('progress-hover', false)

  // Click fills the detail panel at the bottom.
  await bars.first().click()
  await page.getByRole('heading', { name: /What moved since end of Q3 2026/ }).waitFor()
  await see(page.getByText('Sub-pillars', { exact: true }))
  await see(page.getByRole('link', { name: 'Open pillar' }))
  await shot('progress-selected')

  // Modes: realized-only ends at current EBITDA; to-go starts there.
  await page.getByRole('button', { name: 'Realized', exact: true }).click()
  await see(chart.getByText('Current', { exact: true }))
  await see(chart.getByText('$42.7M', { exact: true }))
  await shot('progress-realized')
  await page.getByRole('button', { name: 'To go', exact: true }).click()
  await see(chart.getByText('Current', { exact: true }))
  await see(chart.getByText('Target', { exact: true }))
  await shot('progress-to-go')
  await page.getByRole('button', { name: 'Both', exact: true }).click()

  // Comparison point steps independently of the current period.
  await see(page.getByText('Numbers are as of today. Changes are everything logged since end of Q3 2026.'))
  await see(page.getByText('Added since end of Q3 2026', { exact: true }))
  await page.getByRole('button', { name: 'Earlier period' }).nth(1).click()
  assert.match(page.url(), /[?&]c=-2/)
  await see(page.getByText('Q2 2026', { exact: true }))
  await see(page.getByText('Added since end of Q2 2026', { exact: true }))
  await shot('progress-compare-q2')
  await page.getByRole('button', { name: 'Use the period before' }).click()
  assert.doesNotMatch(page.url(), /[?&]c=/)
  // Changing the period resets the comparison to the one just before it.
  await page.getByRole('button', { name: 'Earlier period' }).nth(1).click()
  await page.getByRole('button', { name: 'Earlier period' }).first().click()
  await see(page.getByText('Q3 2026', { exact: true }))
  await see(page.getByText('Q2 2026', { exact: true }))
  assert.doesNotMatch(page.url(), /[?&]c=/)
  // A closed quarter reads "as of end of".
  await see(page.getByText(/Numbers are as of end of Q3 2026/))
  await page.getByRole('button', { name: 'Later period' }).first().click()

  // Excel export: workbook with a live chart and the backing data.
  const progressXlsx = await download(page.getByRole('button', { name: 'Export to Excel' }))
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(progressXlsx)
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['EBITDA bridge', 'Period summary', 'By pillar'],
  )
  const bridgeSheet = wb.getWorksheet('EBITDA bridge')
  assert.equal(bridgeSheet.getCell('A4').value, 'Step')
  assert.equal(bridgeSheet.getCell('A5').value, 'Entry EBITDA')
  assert.equal(bridgeSheet.getCell('F5').value, 40)
  assert.equal(bridgeSheet.getCell('A11').value, 'Target EBITDA')
  assert.equal(bridgeSheet.getCell('F11').value, 65)
  assert.equal(bridgeSheet.getImages().length, 0, 'no stale picture of the chart')
  assert.ok(await hasNativeChart(progressXlsx, 'barChart'), 'the bridge is a real Excel chart linked to the cells')
  assert.ok(wb.getWorksheet('By pillar').rowCount > 10)

  // Board supplement: bridge, editable commentary, export.
  await page.getByRole('link', { name: 'Export board supplement' }).click()
  await page.getByRole('heading', { name: /value creation progress/ }).waitFor()
  await see(page.getByText('EBITDA bridge: entry to target by pillar'))
  const note = page.getByPlaceholder(/Add commentary for Q4 2026/).first()
  await note.fill('Supplier re-bid complete; savings flow from Q1.')
  await page.reload()
  await page.waitForFunction(() => !!window.__pillar)
  assert.equal(await page.getByPlaceholder(/Add commentary for Q4 2026/).first().inputValue(), 'Supplier re-bid complete; savings flow from Q1.')
  await shot('board-supplement')
  await download(page.getByRole('button', { name: 'Export to Excel' }))

  // Exports on the other charts and tables.
  await visit('/c/c-fernhill')
  await page.getByRole('heading', { name: /EBITDA bridge/ }).waitFor()
  await download(page.getByRole('button', { name: 'Export', exact: true }).first())
  await shot('dashboard-bridge', false)
  await visit('/c/c-fernhill/plan')
  const planXlsx = await download(page.getByRole('button', { name: 'Export to Excel' }))
  const planWb = new ExcelJS.Workbook()
  await planWb.xlsx.readFile(planXlsx)
  assert.deepEqual(
    planWb.worksheets.map((w) => w.name),
    ['Plan', 'Phases', 'KPIs'],
  )
  await visit('/c/c-fernhill/asks')
  await download(page.getByRole('button', { name: 'Export to Excel' }))
  await visit('/c/c-fernhill/pillars/p-proc')
  await page.getByRole('heading', { name: 'KPIs', exact: true }).waitFor()
  const kpiXlsx = await download(page.getByRole('button', { name: 'Export', exact: true }).first())
  const kpiWb = new ExcelJS.Workbook()
  await kpiWb.xlsx.readFile(kpiXlsx)
  assert.ok(await hasNativeChart(kpiXlsx, 'lineChart'), 'the KPI chart is a real Excel chart')
  await visit('/')
  await download(page.getByRole('button', { name: 'Export to Excel' }))

  // Mobile: the page fits; the bridge scrolls inside its card.
  await page.setViewportSize({ width: 390, height: 844 })
  await visit('/c/c-fernhill/progress')
  await page.getByRole('heading', { name: 'Progress', exact: true }).waitFor()
  await noOverflow()
  await shot('progress-mobile')

  // Management never reaches the Progress tab.
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => window.__pillar.getState().setUser('u-taylor'))
  await visit('/c/c-fernhill/progress')
  await page.waitForFunction(() => !document.querySelector('[role="img"][aria-label^="EBITDA bridge"]'))
  assert.equal(await page.getByRole('heading', { name: 'Progress', exact: true }).count(), 0)

  assert.deepEqual(errors, [])
  console.log('PASS: bridge hover/click/modes, independent comparison point, Excel exports with live charts on Progress, supplement, dashboard, plan, asks, KPI and portfolio, editable supplement commentary, mobile fit.')
} finally {
  await page.evaluate(() => window.__pillar?.getState().resetDemo()).catch(() => {})
  await browser.close()
}
