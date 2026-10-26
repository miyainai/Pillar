// v3 improvements: frozen top bar, photos, plan-to-date colouring, captured editing, "waiting on you",
// visibility inheritance fix, kanban asks with drag-and-drop and move forms, resolved bucket.
import { chromium } from 'playwright'
import { globSync, mkdirSync, writeFileSync } from 'node:fs'
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
mkdirSync('generated-artifacts/improvements-v3', { recursive: true })
const shot = (name) => page.screenshot({ path: `generated-artifacts/improvements-v3/${name}.png`, fullPage: true })
const visit = async (path) => {
  await page.goto(base + path)
  await page.waitForFunction(() => !!window.__pillar)
}
const state = () => page.evaluate(() => window.__pillar.getState())
const ask = (id) => page.evaluate((id) => window.__pillar.getState().db.asks.find((a) => a.id === id), id)
const setUser = (id) => page.evaluate((id) => window.__pillar.getState().setUser(id), id)
const noOverflow = async () => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'page must fit horizontally')
}
const column = (name) => page.locator('div.min-w-0', { has: page.getByRole('heading', { name, exact: true }) }).first()
const card = (title) => page.getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()
const drag = async (title, columnName) => {
  const target = columnName === 'Resolved' ? page.locator('section', { hasText: /^Resolved/ }).first() : column(columnName)
  await card(title).dragTo(target)
}

try {
  // ---------- Plan tab ----------
  await visit('/c/c-fernhill/plan')
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  await page.getByRole('heading', { name: 'Value creation plan', exact: true }).waitFor()
  for (const label of ['Target EBITDA impact', 'Plan to date', 'Captured to date', 'Realized']) await page.getByText(label, { exact: true }).first().waitFor()

  // Photos: every avatar on the page is a real image that loaded.
  const photos = await page.evaluate(() => Array.from(document.querySelectorAll('img[src*="avatars/"]')).map((i) => i.complete && i.naturalWidth > 0))
  assert.ok(photos.length >= 6 && photos.every(Boolean), 'profile photos load')

  // In your court (now on the dashboard): Alex (MD) owns the flagged question.
  await visit('/c/c-fernhill')
  const needs = page.getByRole('region', { name: 'In your court' })
  await needs.waitFor()
  await needs.getByText('Your call: answer it').waitFor()
  await needs.getByRole('link').first().click()
  await page.waitForURL(/\/asks\/ask-f-5$/)
  await visit('/c/c-fernhill/plan')
  await page.getByRole('heading', { name: 'Value creation plan', exact: true }).waitFor()

  // Fernhill is on plan, so nothing reads in pink; Northgate's branch pillar is behind and does.
  await page.getByRole('button', { name: 'Expand all', exact: true }).click()
  assert.equal(await page.locator('.bg-rose-50').count(), 0, 'Fernhill shows no behind-plan chips')
  await page.getByRole('button', { name: 'Expand List price increase', exact: true }).click()
  await page.getByText('How plan to date is set').first().waitFor()
  await shot('plan-expanded')

  // Frozen top bar: scroll the long expanded page and the header must still sit at the top.
  await page.mouse.wheel(0, 1200)
  await page.waitForTimeout(200)
  const headerTop = await page.evaluate(() => document.querySelector('header').getBoundingClientRect().top)
  assert.equal(Math.round(headerTop), 0, 'top bar stays pinned while scrolling')
  await page.mouse.wheel(0, -5000)

  // Update captured $ from the plan: posts an update and recolours the chip.
  await visit('/c/c-northgate/plan')
  await page.getByRole('heading', { name: 'Value creation plan', exact: true }).waitFor()
  assert.ok((await page.locator('.bg-rose-50', { hasText: '$1.0M' }).count()) >= 1, 'Branch network shows captured in pink')
  await page.getByRole('button', { name: /Update captured EBITDA, currently \$1\.0M/ }).first().click()
  const dlg = page.getByRole('dialog')
  await dlg.getByRole('heading', { name: 'Update captured EBITDA' }).waitFor()
  await dlg.getByText('Plan to date', { exact: true }).waitFor()
  await dlg.locator('input[type=number]').fill('4.9')
  await dlg.locator('textarea').fill('Wave 1 hub live; closures booked.')
  await dlg.getByRole('button', { name: 'Save and post update' }).click()
  const bp = await page.evaluate(() => window.__pillar.getState().db.pillars.find((p) => p.id === 'p-n-branch'))
  assert.equal(bp.capturedImpact, 4.9)
  const upd = await page.evaluate(() => window.__pillar.getState().db.updates.find((u) => u.pillarId === 'p-n-branch' && u.capturedChange?.to === 4.9))
  assert.ok(upd && upd.text.includes('Wave 1'), 'captured change is posted as an update')
  assert.equal(await page.locator('.bg-rose-50', { hasText: '$4.9M' }).count(), 0, 'now on plan, so no pink')
  await visit('/c/c-fernhill/plan')
  await page.getByRole('button', { name: 'Expand all', exact: true }).click()

  // Visibility inheritance: sub-pillars under a Firm-only pillar read Firm only, never Shared.
  await page.evaluate(() => window.__pillar.getState().setVisibility('pillar', 'p-proc', 'firm'))
  const procCard = page.locator('section', { has: page.getByText('Procurement savings', { exact: true }) }).first()
  const subRow = procCard.locator('div', { hasText: /^1\.1/ }).first()
  assert.ok(await procCard.getByTitle(/Firm only because the whole pillar/).count() >= 2, 'inherited Firm only badges on both sub-pillars')
  assert.equal(await procCard.locator('button', { hasText: 'Shared' }).count(), 1, 'only the pillar-level toggle offers Shared')
  void subRow
  await page.evaluate(() => window.__pillar.getState().setVisibility('pillar', 'p-proc', 'shared'))

  // ---------- Asks tab: kanban + drag and drop ----------
  await visit('/c/c-fernhill/asks')
  for (const h of ['New', 'With deal team', 'With management', 'Delivered']) await page.getByRole('heading', { name: h, exact: true }).waitFor()
  await noOverflow()
  const resolvedToggle = page.getByRole('button', { name: /^Resolved/ })
  assert.equal(await resolvedToggle.getAttribute('aria-expanded'), 'false', 'resolved bucket starts collapsed')
  await shot('asks-kanban')

  // New -> With deal team asks who is on it.
  await drag('Line-level OEE and downtime logs', 'With deal team')
  await page.getByRole('dialog').getByRole('heading', { name: 'Move to With deal team' }).waitFor()
  await page.getByRole('dialog').locator('textarea').fill('Pulling the logs from the MES export.')
  await page.getByRole('dialog').getByRole('button', { name: 'Move', exact: true }).click()
  assert.equal((await ask('ask-f-4')).status, 'In progress')
  assert.equal((await ask('ask-f-4')).history.at(-1).note, 'Pulling the logs from the MES export.')

  // With deal team -> With management asks for recipient, wording and context files.
  await drag('Line-level OEE and downtime logs', 'With management')
  const route = page.getByRole('dialog')
  await route.getByRole('heading', { name: 'Send to management' }).waitFor()
  await route.getByRole('button', { name: 'Draft it for me' }).click()
  await page.waitForFunction(() => document.querySelector('[role=dialog] textarea')?.value.length > 10)
  writeFileSync('/tmp/oee-template.xlsx', 'demo')
  await route.locator('input[type=file]').setInputFiles('/tmp/oee-template.xlsx')
  await route.getByText('oee-template.xlsx').waitFor()
  await route.getByRole('button', { name: 'Send', exact: true }).click()
  const routed = await ask('ask-f-4')
  assert.equal(routed.status, 'Sent to management')
  assert.ok(routed.mgmtAssigneeId && routed.mgmtTitle, 'management version and recipient set')
  assert.ok(routed.attachments.some((f) => f.stage === 'context' && f.name === 'oee-template.xlsx'), 'context file attached')
  await column('With management').getByRole('link', { name: /Line-level OEE/ }).waitFor()

  // Questions cannot go to management: the drop is refused with an explanation.
  await drag('Can we sign a 3-year volume commitment', 'With management')
  await page.getByText(/Questions stay inside the firm/).waitFor()
  assert.equal((await ask('ask-f-6')).status, 'Open')

  // Question -> Delivered answers it.
  await drag('Can we sign a 3-year volume commitment', 'Delivered')
  await page.getByRole('dialog').getByRole('heading', { name: 'Answer the question' }).waitFor()
  await page.getByRole('dialog').locator('textarea').fill('Yes, if the price is fixed for year one and indexed after.')
  await page.getByRole('dialog').getByRole('button', { name: 'Post answer' }).click()
  assert.equal((await ask('ask-f-6')).status, 'Answered')

  // Delivered -> Resolved asks why.
  await drag('Is the line 3 retrofit capex', 'Resolved')
  await page.getByRole('dialog').getByRole('heading', { name: 'Resolve question' }).waitFor()
  await page.getByRole('dialog').getByRole('radio', { name: 'Answered in conversation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Resolve', exact: true }).click()
  const closedQ = await ask('ask-f-7')
  assert.equal(closedQ.status, 'Closed')
  assert.equal(closedQ.history.at(-1).note, 'Answered in conversation')
  await resolvedToggle.click()
  await page.locator('section', { hasText: /^Resolved/ }).getByRole('link', { name: /line 3 retrofit capex/ }).waitFor()
  await shot('asks-after-moves')

  // The note shows on the ask page timeline.
  await visit('/c/c-fernhill/asks/ask-f-7')
  await page.getByText('Answered in conversation', { exact: true }).waitFor()

  // Operating partner (not deal team) can only resolve their own delivered asks.
  await setUser('u-casey')
  await visit('/c/c-fernhill/asks')
  assert.equal((await ask('ask-f-6')).createdBy, 'u-casey')
  assert.equal(await page.locator('a[draggable="true"]').count(), 1, 'only Casey\'s own answered question is draggable')
  // Since v4 the asker can send their delivered ask back to the deal team (with a reason); anything else is blocked.
  await drag('Can we sign a 3-year volume commitment', 'With deal team')
  await page.getByRole('dialog').getByRole('heading', { name: 'Send back to With deal team' }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await drag('Can we sign a 3-year volume commitment', 'New')
  await page.getByText(/Only the deal team moves asks/).waitFor()
  await drag('Can we sign a 3-year volume commitment', 'Resolved')
  await page.getByRole('dialog').getByRole('heading', { name: 'Resolve question' }).waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Resolve', exact: true }).click()
  assert.equal((await ask('ask-f-6')).status, 'Closed')

  // Management sees the context file and its own two columns, no drag handles.
  await setUser('u-taylor')
  await visit('/c/c-fernhill/asks')
  await page.getByRole('heading', { name: 'Waiting on you', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'With the deal team', exact: true }).waitFor()
  assert.equal(await page.locator('a[draggable="true"]').count(), 0)
  await visit('/c/c-fernhill/asks/ask-f-4')
  await page.getByText('From the deal team', { exact: true }).waitFor()
  await page.getByText('oee-template.xlsx').waitFor()
  await visit('/c/c-fernhill')
  await page.getByRole('heading', { name: /In your court/ }).waitFor()
  await page.getByRole('button', { name: 'Upload file' }).first().waitFor()
  await shot('management-dashboard')

  // Mobile fit for the kanban and plan.
  await setUser('u-alex')
  await page.setViewportSize({ width: 390, height: 844 })
  await visit('/c/c-fernhill/asks')
  await noOverflow()
  await visit('/c/c-fernhill/plan')
  await page.getByRole('button', { name: 'Expand all', exact: true }).click()
  await noOverflow()

  assert.deepEqual(errors, [])
  console.log('PASS: frozen top bar, photos, plan-to-date colouring, captured editing, waiting-on-you, firm-only inheritance, kanban drag-and-drop with move forms, resolved bucket, role limits, mobile fit.')
} finally {
  await page.evaluate(() => window.__pillar?.getState().resetDemo()).catch(() => {})
  await browser.close()
}
