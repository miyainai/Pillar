import { chromium } from 'playwright'
import { globSync, mkdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || globSync('/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome')[0],
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const base = process.env.PILLAR_TEST_URL || 'http://localhost:80'
const visit = async (path) => { await page.goto(base + path); await page.waitForFunction(() => !!window.__pillar) }
const chart = () => page.getByRole('img', { name: /EBITDA bridge/ })
const open = async () => { await chart().getByRole('button', { name: /^Organic/ }).click(); await page.getByRole('region', { name: 'Organic EBITDA details' }).waitFor() }
const edit = () => page.getByRole('button', { name: 'Edit organic EBITDA', exact: true }).click()
mkdirSync('generated-artifacts/organic', { recursive: true })
try {
  await visit('/c/c-fernhill')
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  await open()
  assert.match(page.url(), /\/c\/c-fernhill$/)
  await edit()
  assert.equal(await page.getByLabel('Organic target ($M)', { exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.evaluate(() => window.__pillar.getState().startRevision('c-fernhill', 'Configure organic growth'))
  await edit()
  await page.getByLabel('Organic target ($M)', { exact: true }).fill('5')
  await page.getByLabel('Organic realized run-rate ($M)', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Save organic EBITDA', exact: true }).click()
  await page.getByText('Organic EBITDA saved.', { exact: true }).waitFor()
  await page.reload()
  await open()
  await page.getByText('Target $5.0M · Realized $2.0M · Yet to realize $3.0M', { exact: true }).waitFor()
  // The existing browser persistence includes the new values without changing its version.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pillar-demo')))
  assert.equal(saved.state.db.companies[0].organicTargetEbitda, 5)
  assert.equal(saved.version, saved.state.db.seedVersion)
  await visit('/c/c-northgate')
  await open()
  await page.getByText('Target $6.0M · Realized $3.0M · Yet to realize $3.0M', { exact: true }).waitFor()
  await visit('/c/c-fernhill')
  await open()
  await page.getByText('Target $5.0M · Realized $2.0M · Yet to realize $3.0M', { exact: true }).waitFor()
  await chart().getByRole('button', { name: /^Organic/ }).hover()
  await page.getByRole('tooltip').getByText('$3.0M', { exact: true }).waitFor()
  await page.mouse.move(0, 0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadPromise
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(await download.path())
  const sheet = workbook.getWorksheet('EBITDA bridge')
  assert.equal(sheet.getCell('A6').value, 'Organic / steady-state')
  assert.equal(sheet.getCell('B6').value, 'Organic')
  assert.equal(sheet.getCell('D6').value, 2)
  assert.equal(sheet.getCell('E6').value, 3)
  assert.equal(sheet.getCell('F12').value, 70)
  const zip = await JSZip.loadAsync(readFileSync(await download.path()))
  const chartXml = await zip.file('xl/charts/chart1.xml').async('string')
  assert.ok(chartXml.includes('Organic / steady-state'))
  assert.ok(chartXml.includes('64748b') || chartXml.includes('64748B'))
  await page.setViewportSize({ width: 390, height: 844 })
  await edit()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: 'generated-artifacts/organic/mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await chart().getByRole('button', { name: /^Procurement/ }).click()
  await page.waitForURL(/\/pillars\/p-proc$/)
  await visit('/c/c-fernhill/progress')
  assert.equal(await chart().getByRole('button', { name: /^Organic/ }).count(), 0)
  await visit('/c/c-fernhill/progress/export')
  assert.equal(await page.getByText('Organic / steady-state', { exact: true }).count(), 0)
  await visit('/c/c-fernhill')
  await page.evaluate(() => window.__pillar.getState().setUser('u-chris'))
  await open()
  assert.equal(await page.getByRole('button', { name: 'Edit organic EBITDA', exact: true }).count(), 0)
  assert.equal(await chart().getByText(/IC case/).count(), 0)
  assert.equal(await chart().getByText('$68.5M', { exact: true }).count(), 1)
  await page.evaluate(() => window.__pillar.getState().setUser('u-priya'))
  await open()
  await edit()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.deepEqual(errors, [])
  console.log('PASS: organic configuration, lock, persistence, company isolation, tooltip, Excel row + live chart, mobile, pillar navigation, role visibility, unchanged Progress/board')
} finally { await browser.close() }
