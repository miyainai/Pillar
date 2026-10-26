// Files tab: folder tree, hover trail, detail panel, Add files, Move to folder, management boundary, export.
import { chromium } from 'playwright'
import { globSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'

process.chdir(fileURLToPath(new URL('../../', import.meta.url)))
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || globSync('/nix/store/*playwright-browsers*/chromium-*/chrome-linux/chrome')[0],
  args: ['--no-sandbox'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const base = process.env.PILLAR_TEST_URL || 'http://localhost:80'
mkdirSync('generated-artifacts/files', { recursive: true })
const shot = (name) => page.screenshot({ path: `generated-artifacts/files/${name}.png`, fullPage: true })
const visit = async (path) => {
  await page.goto(base + path)
  await page.waitForFunction(() => !!window.__pillar)
}
const folder = (name) => page.getByRole('navigation', { name: 'Folders' }).getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\d+$`) })
const rows = () => page.locator('tbody tr[data-file-id]')
const rowNamed = (name) => rows().filter({ hasText: name }).first()

try {
  await visit('/c/c-fernhill/files')
  await page.evaluate(() => window.__pillar.getState().resetDemo())
  await page.getByRole('heading', { name: 'Files', exact: true }).waitFor()

  // Tab is in the top bar and every seeded file is listed.
  await page.getByRole('link', { name: 'Files', exact: true }).waitFor()
  const total = await page.evaluate(() => {
    const db = window.__pillar.getState().db
    const co = (x) => x.companyId === 'c-fernhill'
    return db.documents.filter(co).length + db.updates.filter(co).reduce((n, u) => n + u.attachments.length, 0) + db.asks.filter(co).reduce((n, a) => n + a.attachments.length, 0)
  })
  assert.equal(await rows().count(), total, 'all files listed')
  await shot('all-files')

  // Folder switching filters the table and the URL remembers the folder.
  await folder('Deal materials').click()
  await page.waitForURL(/f=materials$/)
  await page.getByRole('heading', { name: /^Deal materials\s*4 files$/ }).waitFor()
  assert.equal(await rows().count(), 4, 'deal materials folder')
  await folder('1.2 Packaging and freight').click()
  await page.getByRole('heading', { name: /^1\.2 Packaging and freight\s*2 files$/ }).waitFor()
  assert.equal(await rows().count(), 2, 'sub-pillar folder')
  // Collapse and expand a pillar.
  await page.getByRole('button', { name: 'Collapse 1. Procurement savings' }).click()
  assert.equal(await folder('1.2 Packaging and freight').count(), 0, 'collapsed children hidden')
  await page.getByRole('button', { name: 'Expand 1. Procurement savings' }).click()
  await folder('1.2 Packaging and freight').waitFor()

  // Hover shows the trail; one-line rows otherwise.
  assert.equal(await page.getByRole('tooltip').count(), 0, 'no trail until hover')
  await rowNamed('Carrier_invoices_FY26.xlsx').hover()
  const tip = page.getByRole('tooltip')
  await tip.waitFor()
  const tipText = await tip.innerText()
  assert.match(tipText, /Fernhill Foods/)
  assert.match(tipText, /1\. Procurement savings/)
  assert.match(tipText, /1\.2 Packaging and freight/)
  assert.match(tipText, /Data request "Carrier invoices by lane, last 12 months" \(management upload\)/)
  await shot('hover-trail')

  // Click opens the detail panel with links to the ask and the pillar.
  await rowNamed('Carrier_invoices_FY26.xlsx').click()
  const detail = page.locator('section', { hasText: 'Trail' }).filter({ hasText: 'Carrier_invoices_FY26.xlsx' }).last()
  await detail.getByRole('link', { name: 'Open the request' }).waitFor()
  assert.equal(await detail.getByRole('link', { name: /Carrier invoices by lane/ }).getAttribute('href'), '/c/c-fernhill/asks/ask-f-1')
  assert.equal(await detail.getByRole('link', { name: '1. Procurement savings' }).getAttribute('href'), '/c/c-fernhill/pillars/p-proc')
  await detail.getByText(/Need full carrier invoice detail/).waitFor()
  await shot('detail')

  // Move to folder re-tags the attachment; counts and trail follow, and it persists across reload.
  await detail.getByRole('button', { name: 'Move to folder' }).click()
  const move = page.getByRole('dialog', { name: 'Move to folder' })
  await move.getByRole('combobox').selectOption('ws:sp-labor')
  await move.getByRole('button', { name: 'Move', exact: true }).click()
  await page.getByText('Moved Carrier_invoices_FY26.xlsx').waitFor()
  await folder('4.2 Labor scheduling').waitFor()
  assert.match(await folder('4.2 Labor scheduling').innerText(), /1$/, 'labor folder count after move')
  assert.match(await folder('1.2 Packaging and freight').innerText(), /1$/, 'packaging folder count after move')
  await page.reload()
  await page.waitForFunction(() => !!window.__pillar)
  assert.match(await folder('4.2 Labor scheduling').innerText(), /1$/, 'move persists across reload')
  await folder('4.2 Labor scheduling').click()
  await rowNamed('Carrier_invoices_FY26.xlsx').waitFor()

  // Add files from the Files tab into a workstream folder.
  await page.getByRole('button', { name: 'Add files' }).click()
  const add = page.getByRole('dialog', { name: 'Add files' })
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), add.getByRole('button', { name: 'Choose files' }).click()])
  await chooser.setFiles([{ name: 'Labor_model_v3.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.alloc(24_000) }])
  await add.getByText('Labor_model_v3.xlsx').waitFor()
  await add.getByRole('combobox').first().selectOption('ws:sp-labor')
  await add.getByRole('textbox').fill('Shift model used for the wave 2 plan.')
  await add.getByRole('button', { name: 'Add 1 file' }).click()
  await page.getByText('Added 1 file').waitFor()
  await rowNamed('Labor_model_v3.xlsx').waitFor()
  assert.match(await folder('4.2 Labor scheduling').innerText(), /2$/, 'added file lands in the workstream folder')
  assert.match(await folder('Other').innerText(), /1$/, 'and under Deal materials › Other')
  await rowNamed('Labor_model_v3.xlsx').click()
  await page.getByText('Shift model used for the wave 2 plan.').waitFor()
  await shot('added')

  // A fresh upload elsewhere shows up without any extra action: post an update with an attachment.
  const before = await page.evaluate(() => window.__pillar.getState().db.updates.length)
  await page.evaluate(() =>
    window.__pillar.getState().postUpdate({
      companyId: 'c-fernhill', pillarId: 'p-price', subPillarId: 'sp-list', phaseId: null, text: 'Price letters out.', attachments: [{ name: 'Price_letters.pdf', size: 90_000 }], visibility: 'internal',
    }),
  )
  assert.equal(await page.evaluate(() => window.__pillar.getState().db.updates.length), before + 1)
  await folder('3.1 List price increase').click()
  await rowNamed('Price_letters.pdf').waitFor()

  // Search and sort.
  await folder('All files').click()
  await page.getByRole('textbox', { name: 'Search files' }).fill('spend')
  await rowNamed('Spend_cube_v1.xlsx').waitFor()
  assert.equal(await rows().count(), 1, 'search narrows to one row')

  // An update attachment deep-links to the exact update: the pillar page scrolls to it and highlights it.
  const updateId = await page.evaluate(() => window.__pillar.getState().db.updates.find((u) => u.attachments.some((a) => a.name === 'Spend_cube_v1.xlsx')).id)
  const updateHref = `/c/c-fernhill/pillars/p-proc#${updateId}`
  const openUpdateFromFiles = async (label) => {
    await rowNamed('Spend_cube_v1.xlsx').click()
    const updDetail = page.locator('section', { hasText: 'Trail' }).filter({ hasText: 'Spend_cube_v1.xlsx' }).last()
    const openUpdate = updDetail.getByRole('link', { name: 'Open the update' })
    await openUpdate.waitFor()
    assert.equal(await openUpdate.getAttribute('href'), updateHref, `detail link anchors to the update (${label})`)
    assert.equal(await updDetail.getByRole('link', { name: /^Update by / }).getAttribute('href'), updateHref, `trail step anchors to the update (${label})`)
    await openUpdate.click()
    await page.waitForURL(new RegExp(`/pillars/p-proc#${updateId}$`))
    await page.locator(`#${updateId}`).waitFor()
    await page.waitForFunction((id) => document.getElementById(id)?.dataset.highlighted === 'true', updateId)
    await page.waitForFunction((id) => {
      const r = document.getElementById(id).getBoundingClientRect()
      return r.top >= 0 && r.bottom <= window.innerHeight
    }, updateId)
    await page.screenshot({ path: `generated-artifacts/files/update-anchor-${label}.png` })
    await page.waitForFunction((id) => document.getElementById(id)?.dataset.highlighted !== 'true', updateId, { timeout: 6000 })
    await visit('/c/c-fernhill/files')
    await page.getByRole('heading', { name: 'Files', exact: true }).waitFor()
  }
  await openUpdateFromFiles('original')

  // Filing the attachment under another pillar changes where it is listed, not which update it came from.
  await page.getByRole('textbox', { name: 'Search files' }).fill('spend')
  await rowNamed('Spend_cube_v1.xlsx').click()
  await page.locator('section', { hasText: 'Trail' }).filter({ hasText: 'Spend_cube_v1.xlsx' }).last().getByRole('button', { name: 'Move to folder' }).click()
  const moveUpd = page.getByRole('dialog', { name: 'Move to folder' })
  await moveUpd.getByRole('combobox').selectOption('ws:sp-labor')
  await moveUpd.getByRole('button', { name: 'Move', exact: true }).click()
  await page.getByText('Moved Spend_cube_v1.xlsx').waitFor()
  await folder('4.2 Labor scheduling').click()
  await rowNamed('Spend_cube_v1.xlsx').waitFor()
  await openUpdateFromFiles('moved')
  await folder('All files').click()
  await page.getByRole('textbox', { name: 'Search files' }).fill('')
  await page.locator('select').filter({ hasText: 'Newest first' }).selectOption('name')
  const names = await rows().locator('td:first-child').allInnerTexts()
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'sorted by name')

  // Export to Excel: one row per listed file with trail columns.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to Excel' }).click()])
  const path = `generated-artifacts/files/${download.suggestedFilename()}`
  await download.saveAs(path)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(path)
  const ws = wb.getWorksheet('Files')
  assert.ok(ws, 'Files sheet')
  const headers = ws.getRow(4).values.slice(1)
  assert.deepEqual(headers.slice(0, 4), ['File', 'Category', 'Source', 'Pillar'])
  assert.ok(headers.includes('Trail'), 'trail column')
  let dataRows = 0
  for (let r = 5; ws.getCell(r, 1).value; r++) dataRows += 1
  assert.equal(dataRows, await rows().count(), 'one data row per listed file')
  assert.match(String(ws.getCell(5, headers.indexOf('Trail') + 1).value), /›/, 'trail column filled')

  // Settings links here.
  await visit('/c/c-fernhill/settings')
  await page.getByRole('link', { name: 'See every file in the Files tab' }).click()
  await page.waitForURL(/\/files$/)

  // Company switch keeps the tab.
  await page.getByRole('button', { name: 'Switch company' }).click()
  await page.getByRole('button', { name: /Northgate/ }).click()
  await page.waitForURL(/\/c\/c-northgate\/files$/)
  await page.getByRole('heading', { name: 'Files', exact: true }).waitFor()

  // Management: sees the tab, but no deal materials, no final files, no Add files button, no hidden workstreams.
  await visit('/c/c-fernhill/files')
  await page.evaluate(() => window.__pillar.getState().setUser('u-taylor'))
  await page.getByRole('heading', { name: 'Files', exact: true }).waitFor()
  await page.getByRole('link', { name: 'Files', exact: true }).waitFor()
  await folder('Management upload').waitFor()
  assert.equal(await folder('Deal materials').count(), 0, 'management: no deal materials folder')
  assert.equal(await folder('Deal team final').count(), 0, 'management: no final folder')
  assert.equal(await page.getByRole('button', { name: 'Add files' }).count(), 0, 'management: no add button')
  const body = await page.locator('main').innerText()
  assert.doesNotMatch(body, /Freight_baseline_clean|IC Memo|Finance leadership|Labor scheduling/, 'management sees no firm-only files or workstreams')
  await shot('management')

  // Upgrading from the previous seed version keeps saved plans and files.
  await visit('/c/c-fernhill/files')
  await page.evaluate(() => {
    const st = window.__pillar.getState()
    st.resetDemo()
    const db = structuredClone(window.__pillar.getState().db)
    delete db.fileTags
    db.seedVersion = 4
    db.companies.push({ id: 'c-mine', name: 'My Own Co', sector: 'Software', closeDate: '2026-01-01', holdYears: 5, entryEbitda: 10, exitEbitda: 20 })
    db.memberships.push({ id: 'm-mine', userId: 'u-alex', companyId: 'c-mine', role: 'MD' })
    db.documents.push({ id: 'doc-mine', companyId: 'c-mine', name: 'My_model.xlsx', type: 'Model', size: 1000, uploadedBy: 'u-alex', date: '2026-09-01T00:00:00Z' })
    localStorage.setItem('pillar-demo', JSON.stringify({ state: { db, userId: 'u-alex', companyId: 'c-mine' }, version: 4 }))
  })
  await visit('/c/c-mine/files')
  await page.getByText('Your saved data was kept').waitFor()
  await rowNamed('My_model.xlsx').waitFor()
  const upgraded = await page.evaluate(() => {
    const db = window.__pillar.getState().db
    return { version: db.seedVersion, mine: db.companies.some((c) => c.id === 'c-mine'), tags: db.fileTags, stored: JSON.parse(localStorage.getItem('pillar-demo')).version }
  })
  assert.equal(upgraded.mine, true, 'user company survives the upgrade')
  assert.deepEqual(upgraded.tags, {}, 'new fileTags field added')
  assert.equal(upgraded.stored, upgraded.version, 'stored version now current')

  await page.evaluate(() => window.__pillar.getState().resetDemo())
  assert.deepEqual(errors, [], 'no browser runtime errors')
  console.log('PASS: Files tab folder tree, hover trail, detail links, move/add persistence, live uploads, search/sort, export, settings link, company switch, management boundary, saved-data upgrade.')
} catch (error) {
  await shot('failure').catch(() => {})
  console.error('FAIL:', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
