import { chromium } from 'playwright'
import { globSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

process.chdir(fileURLToPath(new URL('../../', import.meta.url)))
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || globSync('/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome')[0],
  args: ['--no-sandbox'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const base = process.env.PILLAR_TEST_URL || 'http://localhost:80'
mkdirSync('generated-artifacts/improvements', { recursive: true })
const shot = (name) => page.screenshot({ path: `generated-artifacts/improvements/${name}.png`, fullPage: true })
const visit = async (path) => {
  await page.goto(base + path)
  await page.waitForFunction(() => !!window.__pillar)
}
const switchCompany = async (name) => {
  await page.getByRole('button', { name: 'Switch company' }).click()
  await page.getByRole('button', { name: new RegExp(name) }).click()
}
const noOverflow = async () => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit horizontally')
}

try {
  await visit('/c/c-fernhill/plan')
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  await page.getByRole('heading', { name: 'Value creation plan', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: /^Consolidate (?!all)/ }).count(), 0)
  await shot('plan-collapsed')
  await page.getByRole('button', { name: 'Expand all', exact: true }).click()
  assert.ok(await page.getByRole('button', { name: 'Consolidate Procurement savings', exact: true }).count())
  await shot('plan-expanded')
  const phase = page.getByRole('button', { name: /Top-20 SKU re-bid/ }).first()
  await phase.focus()
  assert.ok(await page.getByRole('tooltip').filter({ hasText: 'Top-20 SKU re-bid' }).first().isVisible())
  await page.getByRole('button', { name: 'Consolidate all', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: /^Consolidate (?!all)/ }).count(), 0)
  await switchCompany('Northgate Industrial Supply')
  await page.waitForURL(/\/c\/c-northgate\/plan$/)
  await switchCompany('Fernhill Foods')
  await page.waitForURL(/\/c\/c-fernhill\/plan$/)

  await visit('/c/c-fernhill/asks')
  await page.getByRole('heading', { name: 'New', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'With deal team', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'With management', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Delivered', exact: true }).waitFor()
  await noOverflow()
  const closed = await page.evaluate(() => window.__pillar.getState().db.asks.find((a) => a.companyId === 'c-fernhill' && a.status === 'Closed'))
  assert.ok(closed)
  assert.equal(await page.getByRole('link', { name: new RegExp(closed.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).count(), 0)
  await page.getByRole('button', { name: /^Resolved/ }).click()
  await page.getByRole('link').filter({ hasText: closed.title }).waitFor()
  await page.getByRole('button', { name: /^Resolved/ }).click()
  const samTitle = await page.evaluate(() => window.__pillar.getState().db.users.find((u) => u.id === 'u-sam').title)
  assert.ok(await page.getByRole('option').filter({ hasText: `Sam Ortiz · ${samTitle}` }).count())
  await shot('asks-desktop')
  await switchCompany('Northgate Industrial Supply')
  await page.waitForURL(/\/c\/c-northgate\/asks$/)
  await switchCompany('Fernhill Foods')
  await page.waitForURL(/\/c\/c-fernhill\/asks$/)

  await page.getByRole('button', { name: 'New ask', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const pillar = dialog.getByLabel(/^Pillar/)
  const sub = dialog.getByLabel(/^Sub-pillar/)
  assert.ok(await sub.isDisabled())
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill('Pillar-only improvement check')
  await pillar.selectOption('p-proc')
  assert.ok(await sub.isEnabled())
  await sub.selectOption('sp-dm')
  await pillar.selectOption('p-fin')
  assert.equal(await sub.inputValue(), '')
  assert.ok(await sub.isDisabled())
  await pillar.selectOption('p-proc')
  await shot('new-ask-dialog')
  await dialog.getByRole('button', { name: 'Create data request', exact: true }).click()
  await page.waitForURL(/\/asks\/[^/]+$/)
  const created = await page.evaluate(() => window.__pillar.getState().db.asks.find((a) => a.title === 'Pillar-only improvement check'))
  assert.equal(created.pillarId, 'p-proc')
  assert.equal(created.subPillarId, null)
  await page.getByRole('navigation').getByRole('link', { name: 'Asks', exact: true }).click()
  await page.getByRole('button', { name: 'New ask', exact: true }).click()
  await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill('Sub-pillar improvement check')
  await pillar.selectOption('p-proc')
  await sub.selectOption('sp-dm')
  await dialog.getByRole('button', { name: 'Create data request', exact: true }).click()
  await page.waitForURL(/\/asks\/[^/]+$/)
  const linked = await page.evaluate(() => window.__pillar.getState().db.asks.find((a) => a.title === 'Sub-pillar improvement check'))
  assert.equal(linked.pillarId, 'p-proc')
  assert.equal(linked.subPillarId, 'sp-dm')
  await switchCompany('Northgate Industrial Supply')
  await page.waitForURL(/\/c\/c-northgate\/asks$/)
  await switchCompany('Fernhill Foods')

  for (const path of ['/c/c-fernhill/asks', '/c/c-fernhill/plan']) {
    await page.setViewportSize({ width: 390, height: 844 })
    await visit(path)
    await noOverflow()
    if (path.endsWith('/plan')) {
      await page.getByRole('button', { name: 'Expand all', exact: true }).click()
      await noOverflow()
    }
    await shot(path.endsWith('/plan') ? 'plan-mobile' : 'asks-mobile')
  }
  await page.evaluate(() => window.__pillar.getState().setUser('u-taylor'))
  await visit('/c/c-fernhill/plan')
  assert.equal(await page.getByText('Finance leadership transition', { exact: true }).count(), 0)
  await visit('/c/c-fernhill/asks')
  await page.getByRole('heading', { name: 'Waiting on you', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'With the deal team', exact: true }).waitFor()
  await noOverflow()
  await shot('management-asks')
  assert.deepEqual(errors, [])
  console.log('PASS: collapsed plans, expand/consolidate, phase focus details, company/tab navigation, title labels, kanban asks, resolved bucket, dependent optional sub-pillars, role visibility and mobile fit.')
} finally {
  await page.evaluate(() => window.__pillar?.getState().resetDemo()).catch(() => {})
  await browser.close()
}
