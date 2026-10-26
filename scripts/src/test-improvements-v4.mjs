// v4 + v5 improvements: court chips on the dashboard, backward moves with reasons, company logos,
// point-in-time progress, downloadable uploads (real bytes round-trip, sample files for seeded ones),
// asks "home" in the Asks tab with links from the plan, drag-and-drop people picker with several owners.
import { chromium } from 'playwright'
import { globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
mkdirSync('generated-artifacts/improvements-v4', { recursive: true })
const shot = (name) => page.screenshot({ path: `generated-artifacts/improvements-v4/${name}.png`, fullPage: true })
const visit = async (path) => {
  await page.goto(base + path)
  await page.waitForFunction(() => !!window.__pillar)
}
const ask = (id) => page.evaluate((id) => window.__pillar.getState().db.asks.find((a) => a.id === id), id)
const setUser = (id) => page.evaluate((id) => window.__pillar.getState().setUser(id), id)
const download = async (trigger) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), trigger()])
  const file = `generated-artifacts/improvements-v4/${dl.suggestedFilename()}`
  await dl.saveAs(file)
  return { file, name: dl.suggestedFilename() }
}
const column = (name) => page.locator('div.min-w-0', { has: page.getByRole('heading', { name, exact: true }) }).first()
const card = (title) => page.getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first()

try {
  await visit('/c/c-fernhill')
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  await page.getByRole('region', { name: 'In your court' }).waitFor()

  // ---------- Dashboard: logos, court chips ----------
  const logo = page.locator('img[src*="logos/fernhill"]').first()
  await logo.waitFor()
  assert.ok(await logo.evaluate((i) => i.complete && i.naturalWidth > 0), 'company logo loads')
  const court = page.getByRole('region', { name: /court/ })
  await court.getByRole('tab', { name: /^You/ }).waitFor()
  await court.getByRole('tab', { name: /^Sam/ }).click()
  await page.getByRole('region', { name: "In Sam's court" }).waitFor()
  await court.getByRole('tab', { name: /^Everyone/ }).click()
  await page.getByRole('region', { name: "Everyone's court" }).waitFor()
  await shot('dashboard-court')

  // Northgate is behind plan and says so.
  await visit('/c/c-northgate')
  await page.getByText(/behind plan/).first().waitFor()
  assert.ok(await page.locator('img[src*="logos/northgate"]').first().evaluate((i) => i.complete && i.naturalWidth > 0))

  // ---------- Progress: comparing a period with itself shows no change ----------
  await visit('/c/c-fernhill/progress?p=quarter&o=0&c=0')
  await page.getByText(/with itself shows no change/).waitFor()
  await page.getByText('Same point in time').waitFor()

  // ---------- Downloads: seeded files come as clearly labelled samples ----------
  await setUser('u-sam')
  await visit('/c/c-fernhill/asks/ask-f-3')
  const sample = await download(() => page.getByRole('button', { name: /Supplier_contracts_top10\.pdf/ }).click())
  assert.equal(sample.name, 'Supplier_contracts_top10.pdf')
  assert.ok(readFileSync(sample.file, 'latin1').startsWith('%PDF'), 'sample PDF is a real PDF')
  await page.getByText(/Downloaded a sample file/).waitFor()

  // Real uploads keep their bytes: management uploads, the associate downloads the same file.
  await setUser('u-taylor')
  await visit('/c/c-fernhill/asks/ask-f-2')
  const payload = `sku,customer,price,volume\n1001,Acme,4.20,1800\n${'x'.repeat(2000)}`
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Upload file' }).click()])
  await chooser.setFiles({ name: 'price_volume_top15.csv', mimeType: 'text/csv', buffer: Buffer.from(payload) })
  await page.getByText(/Uploaded\. The deal team has been notified/).waitFor()
  assert.equal((await ask('ask-f-2')).status, 'Data received')
  await setUser('u-sam')
  await visit('/c/c-fernhill/asks/ask-f-2')
  const real = await download(() => page.getByRole('button', { name: /price_volume_top15\.csv/ }).click())
  assert.equal(real.name, 'price_volume_top15.csv')
  assert.equal(readFileSync(real.file, 'utf8'), payload, 'the associate gets exactly what management uploaded')
  // Still there after a reload (bytes live outside the page).
  await page.reload()
  await page.waitForFunction(() => !!window.__pillar)
  const again = await download(() => page.getByRole('button', { name: /price_volume_top15\.csv/ }).click())
  assert.equal(readFileSync(again.file, 'utf8'), payload)
  await shot('ask-download')

  // ---------- Asks are home in the Asks tab; the plan links out ----------
  await setUser('u-alex')
  await visit('/c/c-fernhill/pillars/p-price')
  assert.match(await page.getByRole('navigation').getByRole('link', { name: 'Plan', exact: true }).getAttribute('class'), /bg-zinc-100/, 'pillar pages count as the Plan tab')
  await page.getByText(/Asks linked here/).waitFor()
  assert.equal(await page.getByRole('button', { name: 'New ask' }).count(), 0, 'no in-page ask form on the plan')
  await page.getByRole('link', { name: 'Open in Asks' }).click()
  await page.waitForURL(/\/asks\?pillar=p-price$/)
  await page.getByRole('navigation').getByRole('link', { name: 'Asks', exact: true }).waitFor()
  const titles = await page.locator('a[href*="/asks/ask-"]').allInnerTexts()
  assert.ok(titles.length >= 2 && titles.every((t) => /Pricing and mix/.test(t)), 'board is filtered to the pillar')
  await page.goBack()
  await page.getByRole('link', { name: 'New ask' }).click()
  await page.waitForURL(/\/asks\?new=1&pillar=p-price$/)
  const dlg = page.getByRole('dialog')
  await dlg.getByRole('heading', { name: 'New ask' }).waitFor()
  assert.match(await dlg.locator('select').first().inputValue(), /p-price/, 'pillar is preselected')
  await dlg.getByRole('button', { name: 'Cancel' }).click()
  assert.doesNotMatch(page.url(), /new=1/)

  // ---------- People picker: several owners, drag in, drag out ----------
  await setUser('u-priya')
  await visit('/c/c-fernhill/asks/ask-f-4')
  const owners = page.getByRole('group', { name: 'Deal team owners' })
  const box = owners.getByLabel('On it', { exact: true })
  await box.getByRole('button', { name: 'Remove Sam Ortiz' }).waitFor()
  await owners.getByRole('button', { name: 'Assign Priya Raman' }).hover()
  assert.match(await owners.getByRole('button', { name: 'Assign Priya Raman' }).getAttribute('title'), /Priya Raman · Vice President/, 'hover shows full name and function')
  await owners.getByRole('button', { name: 'Assign Priya Raman' }).dragTo(box)
  assert.deepEqual((await ask('ask-f-4')).assigneeIds, ['u-sam', 'u-priya'], 'drag adds a second owner')
  await owners.getByRole('button', { name: 'Assign Alex Chen' }).click()
  assert.deepEqual((await ask('ask-f-4')).assigneeIds, ['u-sam', 'u-priya', 'u-alex'], 'click adds too')
  await shot('people-picker')
  await box.getByRole('button', { name: 'Remove Sam Ortiz' }).dragTo(owners.getByText('Everyone is on it'))
  assert.deepEqual((await ask('ask-f-4')).assigneeIds, ['u-priya', 'u-alex'], 'drag back out removes')
  await box.getByRole('button', { name: 'Remove Alex Chen' }).click()
  assert.deepEqual((await ask('ask-f-4')).assigneeIds, ['u-priya'])
  // Never empty.
  await box.getByRole('button', { name: 'Remove Priya Raman' }).click()
  assert.deepEqual((await ask('ask-f-4')).assigneeIds, ['u-priya'], 'the last owner cannot be removed')
  // Both owners show on the board card and the court.
  await owners.getByRole('button', { name: 'Assign Sam Ortiz' }).click()
  await visit('/c/c-fernhill/asks')
  await card('Line-level OEE').getByText('Priya, Sam').waitFor()
  await visit('/c/c-fernhill')
  await page.getByRole('region', { name: 'In your court' }).getByText('Line-level OEE').waitFor()

  // The associate cannot change owners, but sees who they are.
  await setUser('u-sam')
  await visit('/c/c-fernhill/asks/ask-f-4')
  await page.getByRole('group', { name: 'Deal team owners' }).getByText('Priya Raman').waitFor()
  assert.equal(await page.getByRole('group', { name: 'Deal team owners' }).getByRole('button').count(), 0, 'read-only for the associate')

  // Single-recipient mode for management.
  await setUser('u-priya')
  await visit('/c/c-fernhill/asks/ask-f-4')
  const sendTo = page.getByRole('group', { name: 'Send to' })
  await sendTo.getByRole('button', { name: 'Remove Taylor Brooks' }).waitFor()
  await sendTo.getByRole('button', { name: 'Assign Chris Patel' }).click()
  await sendTo.getByRole('button', { name: 'Remove Chris Patel' }).waitFor()
  assert.equal(await sendTo.getByRole('button', { name: 'Remove Taylor Brooks' }).count(), 0, 'one recipient at a time')

  // ---------- Backward moves ask for a reason ----------
  await visit('/c/c-fernhill/asks')
  await card('Top-10 supplier contract terms').dragTo(column('New'))
  const back = page.getByRole('dialog')
  await back.getByRole('heading', { name: 'Send back to New' }).waitFor()
  await back.getByRole('radio', { name: 'Not what we needed' }).click()
  assert.ok(await back.getByRole('button', { name: 'Send back' }).isDisabled(), 'a reason is required')
  await back.getByPlaceholder(/only covers 8/).fill('Only 6 of the 10 contracts came through.')
  await back.getByRole('button', { name: 'Send back' }).click()
  const f3 = await ask('ask-f-3')
  assert.equal(f3.status, 'New')
  assert.match(f3.history.at(-1).note, /Not what we needed: Only 6 of the 10/)
  // Cannot drag straight back to management from further along.
  await card('Is the line 3 retrofit capex').dragTo(column('With management'))
  await page.getByText(/move it to With deal team first/).waitFor()
  await shot('asks-board')

  assert.deepEqual(errors, [])
  console.log('PASS: court chips, logos, behind-plan copy, same-period progress, sample and real downloads, asks home in Asks tab with plan links, drag-and-drop owners (multi, hover, never empty, single recipient), backward moves with reasons.')
} finally {
  await page.evaluate(() => window.__pillar?.getState().resetDemo()).catch(() => {})
  await browser.close()
}
