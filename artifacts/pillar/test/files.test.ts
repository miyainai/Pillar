// Files tab after the plan changes underneath it. "Move to folder" tags attachments with a
// pillar/sub-pillar id, and documents carry their own workstream ref. When that pillar is deleted
// (open revision), retired (after lock) or the sub-pillar is removed, the library must keep listing
// the file, fall back to its original workstream or to none, keep the folder counts consistent,
// and never show the removed pillar's name.

import { beforeEach, describe, expect, it, vi } from 'vitest'

// The store only exposes its persist API when browser storage exists at import time, so the
// reload-from-storage case below needs a stand-in before the store module loads.
const stored = vi.hoisted(() => {
  const map = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
  return map
})
import { buildSeed, SEED_VERSION } from '../src/lib/seed'
import { scopeFor, type View } from '../src/lib/permissions'
import { useStore } from '../src/lib/store'
import { upgradeDb } from '../src/lib/migrate'
import { FOLDER, folderTree, libraryFiles, trailText, updateLink, workstreamOptions, type FolderNode, type LibraryFile } from '../src/lib/fileLibrary'
import type { DB } from '../src/lib/types'

const CO = 'c-fernhill'
const PLANT = 'Plant efficiency'
const LINE = 'Line efficiency'
const LABOR = 'Labor scheduling'

const actions = () => useStore.getState()
const db = () => useStore.getState().db
const firmView = () => scopeFor(db(), 'u-alex', CO)!
const mgmtView = () => scopeFor(db(), 'u-taylor', CO)!

/** Every node in the tree, flattened. */
const nodes = (tree: FolderNode[]): FolderNode[] => tree.flatMap((n) => [n, ...nodes(n.children)])
const find = (tree: FolderNode[], key: string) => nodes(tree).find((n) => n.key === key)

/** What the library should hold, recomputed from the view it was built from. */
const expectedCount = (v: View) =>
  v.documents.length +
  [...v.updates, ...v.retiredUpdates].reduce((n, u) => n + u.attachments.length, 0) +
  v.asks.reduce((n, a) => n + a.attachments.length, 0)

/** The invariants the Files tab relies on: tree counts agree with the file list and no file sits in a folder the tree no longer has. */
function expectCountsAddUp(v: View, files: LibraryFile[]) {
  const tree = folderTree(v, files)
  expect(files).toHaveLength(expectedCount(v))
  expect(find(tree, FOLDER.all)!.count).toBe(files.length)
  const keys = new Set(nodes(tree).map((n) => n.key))
  for (const f of files) for (const k of f.folders) expect(keys, `${f.name} is filed under missing folder ${k}`).toContain(k)
  for (const n of nodes(tree)) expect(n.count, n.label).toBe(n.key === FOLDER.all ? files.length : files.filter((f) => f.folders.includes(n.key)).length)
  expect(find(tree, FOLDER.workstreams)!.count).toBe(files.filter((f) => f.workstream).length)
  for (const p of v.pillars) {
    expect(find(tree, FOLDER.pillar(p.id))!.count).toBe(files.filter((f) => f.workstream?.pillar.id === p.id).length)
    for (const s of v.subPillars.filter((s) => s.pillarId === p.id)) {
      expect(find(tree, FOLDER.sub(s.id))!.count).toBe(files.filter((f) => f.workstream?.sub?.id === s.id).length)
    }
  }
  // Every file's workstream is a plan item the viewer can still see.
  for (const f of files) {
    if (!f.workstream) continue
    expect(v.pillars.map((p) => p.id)).toContain(f.workstream.pillar.id)
    if (f.workstream.sub) expect(v.subPillars.map((s) => s.id)).toContain(f.workstream.sub.id)
  }
}

/** Everything the Files tab renders for a file, as searchable text. */
const rendered = (files: LibraryFile[]) =>
  JSON.stringify(files.map((f) => [trailText(f), f.workstream?.pillar.name, f.workstream?.sub?.name, f.folders])).toLowerCase()

function expectNoStaleName(v: View, files: LibraryFile[], ...names: string[]) {
  const text = rendered(files)
  const tree = JSON.stringify(folderTree(v, files)).toLowerCase()
  const options = JSON.stringify(workstreamOptions(v)).toLowerCase()
  for (const name of names) {
    expect(text, `file list mentions ${name}`).not.toContain(name.toLowerCase())
    expect(tree, `folder tree mentions ${name}`).not.toContain(name.toLowerCase())
    expect(options, `folder choices mention ${name}`).not.toContain(name.toLowerCase())
  }
}

function seedWithPlantRequestFile(): DB {
  const seed = buildSeed()
  // A management upload on the plant-efficiency request, so a file whose *own* request lives on the
  // removed pillar is in play as well as files merely tagged into it.
  seed.asks.find((a) => a.id === 'ask-f-4')!.attachments.push({
    id: 'att-f4-raw', name: 'OEE_downtime_logs.xlsx', size: 900_000, uploadedBy: 'u-taylor', at: new Date().toISOString(), stage: 'raw',
  })
  // Progress updates posted on the plant-efficiency pillar and its line-efficiency sub-pillar, each
  // with a file, so update attachments whose *own* update lives on the removed item are in play too.
  const now = new Date().toISOString()
  seed.updates.push(
    {
      id: 'upd-plant', companyId: CO, pillarId: 'p-plant', subPillarId: null, phaseId: null, authorId: 'u-jordan',
      text: 'Plant walk complete; baseline OEE study attached.', visibility: 'shared', createdAt: now,
      attachments: [{ id: 'upd-plant-att', name: 'OEE_baseline_study.pdf', size: 1_200_000, uploadedBy: 'u-jordan', at: now }],
    },
    {
      id: 'upd-line', companyId: CO, pillarId: 'p-plant', subPillarId: 'sp-line', phaseId: null, authorId: 'u-jordan',
      text: 'Line 3 changeover times logged for four weeks.', visibility: 'firm', createdAt: now,
      attachments: [{ id: 'upd-line-att', name: 'Line3_changeovers.xlsx', size: 300_000, uploadedBy: 'u-jordan', at: now }],
    },
  )
  return seed
}

/** The seed's own list of every update attachment id, so we can check none is lost. */
const seededUpdateAttachmentIds = (d: DB) => d.updates.filter((u) => u.companyId === CO).flatMap((u) => u.attachments.map((a) => a.id)).sort()

describe('files tab after plan changes', () => {
  beforeEach(() => {
    useStore.setState({ db: seedWithPlantRequestFile(), userId: 'u-alex', companyId: CO })
  })

  it('falls back to the original workstream when a tagged pillar is deleted in an open revision', () => {
    actions().startRevision(CO, 'Drop plant efficiency')
    actions().moveFile('att-f1-raw', { workstream: { pillarId: 'p-plant', subPillarId: null } })
    actions().moveFile('upd-fer-2-att-0', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-line' } })
    actions().moveFile('doc-f-2', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-line' } })
    actions().moveFile('doc-f-1', { workstream: { pillarId: 'p-plant', subPillarId: null } })
    // A tag on another pillar is untouched by the delete.
    actions().moveFile('att-f3-raw', { workstream: { pillarId: 'p-proc', subPillarId: 'sp-pack' } })

    const before = libraryFiles(firmView())
    expect(before.find((f) => f.id === 'att-f1-raw')!.retagged).toBe(true)
    expect(before.find((f) => f.id === 'att-f1-raw')!.folders).toContain(FOLDER.pillar('p-plant'))
    expect(before.find((f) => f.id === 'upd-fer-2-att-0')!.folders).toContain(FOLDER.sub('sp-line'))
    expect(before.find((f) => f.id === 'doc-f-2')!.folders).toContain(FOLDER.sub('sp-line'))

    actions().deletePillar('p-plant')
    // Hard delete: the pillar is gone and so are the tags and document workstreams that pointed at it,
    // so the saved data does not keep references to a plan item that no longer exists.
    expect(db().pillars.some((p) => p.id === 'p-plant')).toBe(false)
    expect(db().fileTags?.['att-f1-raw']).toBeUndefined()
    expect(db().fileTags?.['upd-fer-2-att-0']).toBeUndefined()
    expect(db().fileTags?.['att-f3-raw']).toEqual({ pillarId: 'p-proc', subPillarId: 'sp-pack' })
    expect(db().documents.find((d) => d.id === 'doc-f-2')!.workstream).toBeUndefined()
    expect(db().documents.find((d) => d.id === 'doc-f-1')!.workstream).toBeUndefined()
    const stale = (ref: { pillarId: string; subPillarId: string | null } | undefined) =>
      !!ref && (ref.pillarId === 'p-plant' || ref.subPillarId === 'sp-line' || ref.subPillarId === 'sp-labor')
    expect(Object.values(db().fileTags ?? {}).some(stale)).toBe(false)
    expect(db().documents.some((d) => stale(d.workstream))).toBe(false)

    const v = firmView()
    expect(v.fileTags['att-f1-raw']).toBeUndefined()
    expect(v.fileTags['upd-fer-2-att-0']).toBeUndefined()
    const files = libraryFiles(v)

    // The request file goes back to the request's own workstream.
    const raw = files.find((f) => f.id === 'att-f1-raw')!
    expect(raw.retagged).toBe(false)
    expect(raw.workstream?.pillar.id).toBe('p-proc')
    expect(raw.workstream?.sub?.id).toBe('sp-pack')
    expect(raw.folders).toEqual(expect.arrayContaining([FOLDER.requests, FOLDER.stage('raw'), FOLDER.workstreams, FOLDER.pillar('p-proc'), FOLDER.sub('sp-pack')]))
    expect(raw.folders).not.toContain(FOLDER.pillar('p-plant'))
    expect(trailText(raw)).toBe('Fernhill Foods › 1. Procurement savings › 1.2 Packaging and freight › Data request "Carrier invoices by lane, last 12 months" (management upload)')

    // The update attachment goes back to its update's workstream, phase included.
    const upd = v.updates.find((u) => u.id === 'upd-fer-2')!
    const spend = files.find((f) => f.id === 'upd-fer-2-att-0')!
    expect(spend.retagged).toBe(false)
    expect(spend.workstream?.pillar.id).toBe(upd.pillarId)
    expect(spend.workstream?.sub?.id ?? null).toBe(upd.subPillarId)
    expect(spend.workstream?.phase?.id ?? null).toBe(upd.phaseId)
    expect(spend.folders).not.toContain(FOLDER.sub('sp-line'))

    // A file whose own request was on the deleted pillar is still listed, just without a workstream.
    const oee = files.find((f) => f.id === 'att-f4-raw')!
    expect(oee.workstream).toBeNull()
    expect(oee.folders).toEqual([FOLDER.requests, FOLDER.stage('raw')])
    expect(trailText(oee)).toBe('Fernhill Foods › Data request "Line-level OEE and downtime logs, last 6 months" (management upload)')

    expect(find(folderTree(v, files), FOLDER.pillar('p-plant'))).toBeUndefined()
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, PLANT, LINE, LABOR)
  })

  it('falls back when a tagged sub-pillar is removed', () => {
    actions().moveFile('upd-fer-2-att-0', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-labor' } })
    actions().moveFile('att-f3-raw', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-labor' } })
    actions().moveFile('att-f1-raw', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-line' } })
    actions().moveFile('doc-f-2', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-labor' } })
    expect(libraryFiles(firmView()).find((f) => f.id === 'upd-fer-2-att-0')!.folders).toContain(FOLDER.sub('sp-labor'))

    actions().deleteSubPillar('sp-labor')
    expect(db().subPillars.some((s) => s.id === 'sp-labor')).toBe(false)
    expect(db().pillars.some((p) => p.id === 'p-plant' && !p.retiredAt)).toBe(true)
    // Tags on the removed sub-pillar are cleared from the saved data; tags on its siblings stay.
    expect(db().fileTags?.['upd-fer-2-att-0']).toBeUndefined()
    expect(db().fileTags?.['att-f3-raw']).toBeUndefined()
    expect(db().fileTags?.['att-f1-raw']).toEqual({ pillarId: 'p-plant', subPillarId: 'sp-line' })
    // A document filed under the removed sub-pillar keeps the parent pillar as its workstream.
    expect(db().documents.find((d) => d.id === 'doc-f-2')!.workstream).toEqual({ pillarId: 'p-plant', subPillarId: null })
    expect(Object.values(db().fileTags ?? {}).some((t) => t.subPillarId === 'sp-labor')).toBe(false)
    expect(db().documents.some((d) => d.workstream?.subPillarId === 'sp-labor')).toBe(false)

    const v = firmView()
    expect(v.fileTags['upd-fer-2-att-0']).toBeUndefined()
    expect(v.fileTags['att-f3-raw']).toBeUndefined()
    const files = libraryFiles(v)

    // Back to the update's own sub-pillar, not left dangling on the parent pillar.
    const upd = v.updates.find((u) => u.id === 'upd-fer-2')!
    const spend = files.find((f) => f.id === 'upd-fer-2-att-0')!
    expect(spend.retagged).toBe(false)
    expect(spend.workstream?.pillar.id).toBe(upd.pillarId)
    expect(spend.workstream?.sub?.id ?? null).toBe(upd.subPillarId)
    expect(spend.workstream?.phase?.id ?? null).toBe(upd.phaseId)
    expect(spend.folders).not.toContain(FOLDER.pillar('p-plant'))
    expect(spend.folders).not.toContain(FOLDER.sub('sp-labor'))

    const contracts = files.find((f) => f.id === 'att-f3-raw')!
    expect(contracts.retagged).toBe(false)
    expect(contracts.workstream?.sub?.id).toBe('sp-dm')
    expect(trailText(contracts)).toContain('1. Procurement savings › 1.1 Direct materials re-bid')

    // The parent pillar keeps its folder; only the removed sub-pillar's folder is gone.
    const tree = folderTree(v, files)
    expect(find(tree, FOLDER.pillar('p-plant'))).toBeDefined()
    expect(find(tree, FOLDER.sub('sp-labor'))).toBeUndefined()
    expect(find(tree, FOLDER.sub('sp-line'))).toBeDefined()
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, LABOR)
    expect(rendered(files)).toContain(PLANT.toLowerCase()) // the pillar itself is still in play
  })

  it('keeps a document listed when its workstream pillar is retired after lock', () => {
    // Fernhill's plan is locked with no open revision, so removing a pillar retires it instead of deleting it.
    actions().moveFile('doc-f-2', { workstream: { pillarId: 'p-plant', subPillarId: 'sp-line' } })
    actions().moveFile('att-f1-raw', { workstream: { pillarId: 'p-plant', subPillarId: null } })
    const tagged = libraryFiles(firmView()).find((f) => f.id === 'doc-f-2')!
    expect(trailText(tagged)).toMatch(new RegExp(`^Fernhill Foods › Deal materials › Model › \\d+\\. ${PLANT} › \\d+\\.\\d+ ${LINE}$`))

    actions().deletePillar('p-plant')
    const plant = db().pillars.find((p) => p.id === 'p-plant')!
    expect(plant.retiredAt).toBeTruthy()
    expect(db().subPillars.some((s) => s.id === 'sp-line')).toBe(true) // history kept intact
    // Retiring keeps the pillar record, so the refs stay in the saved data and only the view hides them.
    expect(db().documents.find((d) => d.id === 'doc-f-2')!.workstream).toEqual({ pillarId: 'p-plant', subPillarId: 'sp-line' })
    expect(db().fileTags?.['att-f1-raw']).toEqual({ pillarId: 'p-plant', subPillarId: null })

    const v = firmView()
    expect(v.pillars.some((p) => p.id === 'p-plant')).toBe(false)
    const files = libraryFiles(v)

    // Still under Deal materials, with no workstream and no stale link.
    const doc = files.find((f) => f.id === 'doc-f-2')!
    expect(doc.workstream).toBeNull()
    expect(doc.folders).toEqual([FOLDER.materials, FOLDER.docType('Model')])
    expect(trailText(doc)).toBe('Fernhill Foods › Deal materials › Model')
    expect(doc.trail.every((t) => !t.to?.includes('p-plant'))).toBe(true)

    // A tag into the retired pillar falls back to the file's original workstream.
    const raw = files.find((f) => f.id === 'att-f1-raw')!
    expect(raw.retagged).toBe(false)
    expect(raw.workstream?.sub?.id).toBe('sp-pack')

    // The file whose own request was on the retired pillar is still listed with no workstream.
    const oee = files.find((f) => f.id === 'att-f4-raw')!
    expect(oee.workstream).toBeNull()
    expect(oee.folders).toEqual([FOLDER.requests, FOLDER.stage('raw')])

    const tree = folderTree(v, files)
    expect(find(tree, FOLDER.pillar('p-plant'))).toBeUndefined()
    expect(find(tree, FOLDER.materials)!.count).toBe(v.documents.length)
    expect(find(tree, FOLDER.docType('Model'))!.count).toBe(1)
    // Remaining pillars renumber, so the folder labels follow the plan order the viewer sees.
    expect(find(tree, FOLDER.workstreams)!.children.map((c) => c.label)).toEqual(v.pillars.map((p) => `${p.num}. ${p.name}`))
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, PLANT, LINE, LABOR)

    // Management's projection goes through the same path without throwing or leaking the name.
    const mv = mgmtView()
    const mfiles = libraryFiles(mv)
    expect(mfiles.some((f) => f.id === 'att-f1-raw')).toBe(true)
    expect(mfiles.find((f) => f.id === 'att-f1-raw')!.workstream?.sub?.id).toBe('sp-pack')
    expectCountsAddUp(mv, mfiles)
    expectNoStaleName(mv, mfiles, PLANT, LINE, LABOR)
  })

  it('keeps update attachments listed when the pillar they were posted on is retired after lock', () => {
    const before = libraryFiles(firmView())
    expect(before.find((f) => f.id === 'upd-plant-att')!.folders).toContain(FOLDER.pillar('p-plant'))
    expect(before.find((f) => f.id === 'upd-line-att')!.folders).toContain(FOLDER.sub('sp-line'))
    // Management could see the shared one while the pillar was live.
    expect(libraryFiles(mgmtView()).some((f) => f.id === 'upd-plant-att')).toBe(true)

    actions().deletePillar('p-plant')
    expect(db().pillars.find((p) => p.id === 'p-plant')!.retiredAt).toBeTruthy()

    const v = firmView()
    // The updates themselves leave the plan-scoped feed; they are carried separately for the file library.
    expect(v.updates.some((u) => u.pillarId === 'p-plant')).toBe(false)
    expect(v.retiredUpdates.map((u) => u.id)).toEqual(expect.arrayContaining(['upd-line', 'upd-plant']))
    expect(v.retiredUpdates.every((u) => u.pillarId === 'p-plant')).toBe(true)
    const files = libraryFiles(v)

    // No update attachment has gone missing: every one the seed holds for the company is still listed.
    expect(files.filter((f) => f.source === 'update').map((f) => f.id).sort()).toEqual(seededUpdateAttachmentIds(db()))

    // Same treatment as a document or request file on the retired pillar: listed, no workstream, no stale link.
    for (const id of ['upd-plant-att', 'upd-line-att']) {
      const f = files.find((x) => x.id === id)!
      expect(f.workstream).toBeNull()
      expect(f.retagged).toBe(false)
      expect(f.folders).toEqual([])
      expect(f.origin.kind).toBe('update')
      // No "open the update" link: the pillar page that would show it is gone.
      expect(f.trail.every((t) => !t.to?.includes('p-plant'))).toBe(true)
      expect(f.trail.at(-1)!.to).toBeUndefined()
      if (f.origin.kind === 'update') expect(updateLink(v, f.origin.update)).toBeUndefined()
    }
    const study = files.find((f) => f.id === 'upd-plant-att')!
    expect(trailText(study)).toMatch(/^Fernhill Foods › Update by Jordan Lee on .+$/)
    expect(study.note).toBe('Plant walk complete; baseline OEE study attached.')

    const tree = folderTree(v, files)
    expect(find(tree, FOLDER.pillar('p-plant'))).toBeUndefined()
    expect(find(tree, FOLDER.all)!.count).toBe(files.length)
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, PLANT, LINE, LABOR)

    // The team can still re-file such a file into a live workstream.
    actions().moveFile('upd-plant-att', { workstream: { pillarId: 'p-proc', subPillarId: 'sp-pack' } })
    const v2 = firmView()
    const files2 = libraryFiles(v2)
    const moved = files2.find((f) => f.id === 'upd-plant-att')!
    expect(moved.retagged).toBe(true)
    expect(moved.workstream?.sub?.id).toBe('sp-pack')
    expect(moved.folders).toEqual(expect.arrayContaining([FOLDER.workstreams, FOLDER.pillar('p-proc'), FOLDER.sub('sp-pack')]))
    expect(trailText(moved)).toContain('1. Procurement savings › 1.2 Packaging and freight › Update by Jordan Lee')
    // Re-filing changes the folder, not where the update lives: still no link to the retired pillar.
    expect(moved.trail.every((t) => !t.to?.includes('p-plant'))).toBe(true)
    expect(moved.trail.at(-1)!.to).toBeUndefined()
    expectCountsAddUp(v2, files2)

    // Management visibility is unchanged: a retired pillar is no longer part of the plan it is shown.
    const mv = mgmtView()
    expect(mv.retiredUpdates).toEqual([])
    const mfiles = libraryFiles(mv)
    expect(mfiles.some((f) => f.id === 'upd-plant-att' || f.id === 'upd-line-att')).toBe(false)
    expectCountsAddUp(mv, mfiles)
    expectNoStaleName(mv, mfiles, PLANT, LINE, LABOR)
  })

  it('keeps update attachments listed when the pillar they were posted on is deleted in an open revision', () => {
    actions().startRevision(CO, 'Drop plant efficiency')
    actions().deletePillar('p-plant')
    expect(db().pillars.some((p) => p.id === 'p-plant')).toBe(false)
    // Hard delete leaves the updates in the saved data, pointing at a pillar that no longer exists.
    expect(db().updates.some((u) => u.id === 'upd-plant')).toBe(true)

    const v = firmView()
    const files = libraryFiles(v)
    expect(files.filter((f) => f.source === 'update').map((f) => f.id).sort()).toEqual(seededUpdateAttachmentIds(db()))
    for (const id of ['upd-plant-att', 'upd-line-att']) {
      const f = files.find((x) => x.id === id)!
      expect(f.workstream).toBeNull()
      expect(f.folders).toEqual([])
      expect(trailText(f)).toMatch(/^Fernhill Foods › Update by Jordan Lee on .+$/)
      expect(f.trail.every((t) => !t.to)).toBe(false) // the company step still links
      expect(f.trail.every((t) => !t.to?.includes('p-plant'))).toBe(true)
    }
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, PLANT, LINE, LABOR)
  })

  it('files an update attachment under the parent pillar when only its sub-pillar is removed', () => {
    actions().deleteSubPillar('sp-line')
    expect(db().subPillars.some((s) => s.id === 'sp-line')).toBe(false)
    expect(db().updates.some((u) => u.id === 'upd-line')).toBe(true)

    const v = firmView()
    expect(v.updates.some((u) => u.id === 'upd-line')).toBe(false)
    expect(v.retiredUpdates.map((u) => u.id)).toContain('upd-line')
    expect(v.retiredUpdates.every((u) => u.subPillarId === 'sp-line')).toBe(true)
    const files = libraryFiles(v)
    expect(files.filter((f) => f.source === 'update').map((f) => f.id).sort()).toEqual(seededUpdateAttachmentIds(db()))

    // Same fallback a document or request file on the removed sub-pillar gets: the parent pillar, no sub, no phase.
    const changeovers = files.find((f) => f.id === 'upd-line-att')!
    expect(changeovers.workstream?.pillar.id).toBe('p-plant')
    expect(changeovers.workstream?.sub).toBeNull()
    expect(changeovers.workstream?.phase).toBeNull()
    expect(changeovers.retagged).toBe(false)
    expect(changeovers.folders).toEqual([FOLDER.workstreams, FOLDER.pillar('p-plant')])
    expect(changeovers.folders).not.toContain(FOLDER.sub('sp-line'))
    expect(trailText(changeovers)).toMatch(new RegExp(`^Fernhill Foods › \\d+\\. ${PLANT} › Update by Jordan Lee on .+$`))
    // The update itself is no longer in the pillar's feed, so the trail's update step and the detail panel offer no link to it.
    expect(changeovers.trail.at(-1)!.to).toBeUndefined()
    expect(updateLink(v, v.retiredUpdates.find((u) => u.id === 'upd-line')!)).toBeUndefined()
    // The one posted on the pillar itself is untouched, deep link included.
    const study = files.find((f) => f.id === 'upd-plant-att')!
    expect(study.workstream?.pillar.id).toBe('p-plant')
    expect(study.trail.at(-1)!.to).toBe(`/c/${CO}/pillars/p-plant#upd-plant`)

    const tree = folderTree(v, files)
    expect(find(tree, FOLDER.sub('sp-line'))).toBeUndefined()
    expect(find(tree, FOLDER.pillar('p-plant'))!.count).toBe(files.filter((f) => f.workstream?.pillar.id === 'p-plant').length)
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, LINE)
  })

  it('drops leftover tags and workstreams for missing plan items when a saved plan is loaded', () => {
    // A plan saved before deletePillar cleaned up after itself: the plant pillar (and its sub-pillars)
    // and the labor sub-pillar are gone from the plan, but tags and document workstreams still point at them.
    const saved = seedWithPlantRequestFile()
    saved.pillars.find((p) => p.id === 'p-mna')!.retiredAt = '2026-09-15T00:00:00Z'
    saved.pillars = saved.pillars.filter((p) => p.id !== 'p-plant')
    saved.subPillars = saved.subPillars.filter((s) => s.pillarId !== 'p-plant' && s.id !== 'sp-mix')
    saved.fileTags = {
      'att-f1-raw': { pillarId: 'p-plant', subPillarId: null },
      'upd-fer-2-att-0': { pillarId: 'p-plant', subPillarId: 'sp-line' },
      'att-f4-raw': { pillarId: 'p-price', subPillarId: 'sp-mix' },
      'att-f3-raw': { pillarId: 'p-chan', subPillarId: 'sp-club' },
      'doc-f-3': { pillarId: 'p-mna', subPillarId: 'sp-addon' },
    }
    const doc = (id: string) => saved.documents.find((d) => d.id === id)!
    doc('doc-f-1').workstream = { pillarId: 'p-plant', subPillarId: null }
    doc('doc-f-2').workstream = { pillarId: 'p-plant', subPillarId: 'sp-line' }
    doc('doc-f-3').workstream = { pillarId: 'p-price', subPillarId: 'sp-mix' }
    doc('doc-f-4').workstream = { pillarId: 'p-mna', subPillarId: 'sp-pipe' }

    const db = upgradeDb(structuredClone(saved))

    // Refs to the missing pillar are gone; a tag on a missing sub-pillar goes too (the file falls back to its origin).
    expect(db.fileTags!['att-f1-raw']).toBeUndefined()
    expect(db.fileTags!['upd-fer-2-att-0']).toBeUndefined()
    expect(db.fileTags!['att-f4-raw']).toBeUndefined()
    expect(db.documents.find((d) => d.id === 'doc-f-1')!.workstream).toBeUndefined()
    expect(db.documents.find((d) => d.id === 'doc-f-2')!.workstream).toBeUndefined()
    // A document on a missing sub-pillar keeps the parent pillar, as deleteSubPillar does.
    expect(db.documents.find((d) => d.id === 'doc-f-3')!.workstream).toEqual({ pillarId: 'p-price', subPillarId: null })
    // Valid refs and refs to a retired pillar (still a record in the plan) survive untouched.
    expect(db.fileTags!['att-f3-raw']).toEqual({ pillarId: 'p-chan', subPillarId: 'sp-club' })
    expect(db.fileTags!['doc-f-3']).toEqual({ pillarId: 'p-mna', subPillarId: 'sp-addon' })
    expect(db.documents.find((d) => d.id === 'doc-f-4')!.workstream).toEqual({ pillarId: 'p-mna', subPillarId: 'sp-pipe' })
    const stale = (ref: { pillarId: string; subPillarId: string | null } | undefined) =>
      !!ref && (ref.pillarId === 'p-plant' || ['sp-line', 'sp-labor', 'sp-mix'].includes(ref.subPillarId ?? ''))
    expect(Object.values(db.fileTags!).some(stale)).toBe(false)
    expect(db.documents.some((d) => stale(d.workstream))).toBe(false)

    // The upgraded plan loads cleanly into the Files tab with no trace of the removed items.
    useStore.setState({ db, userId: 'u-alex', companyId: CO })
    const v = firmView()
    const files = libraryFiles(v)
    expect(files.find((f) => f.id === 'att-f1-raw')!.workstream?.sub?.id).toBe('sp-pack')
    expectCountsAddUp(v, files)
    expectNoStaleName(v, files, PLANT, LINE, LABOR, 'Premium mix shift')
  })

  it('also tidies a plan saved at the current seed version, which skips the version upgrade', async () => {
    // Reloading from browser storage at the same version runs merge, not migrate; the cleanup
    // must happen there too or plans that predate the deletion clean-up keep their stale tags.
    const saved = seedWithPlantRequestFile()
    saved.pillars = saved.pillars.filter((p) => p.id !== 'p-plant')
    saved.subPillars = saved.subPillars.filter((s) => s.pillarId !== 'p-plant')
    saved.fileTags = {
      'att-f1-raw': { pillarId: 'p-plant', subPillarId: 'sp-line' },
      'att-f3-raw': { pillarId: 'p-chan', subPillarId: 'sp-club' },
    }
    saved.documents.find((d) => d.id === 'doc-f-1')!.workstream = { pillarId: 'p-plant', subPillarId: null }
    stored.set('pillar-demo', JSON.stringify({ state: { db: saved, userId: 'u-alex', companyId: CO }, version: SEED_VERSION }))
    await useStore.persist.rehydrate()
    expect(db().seedVersion).toBe(SEED_VERSION)
    expect(db().pillars.some((p) => p.id === 'p-plant')).toBe(false)
    expect(db().fileTags?.['att-f1-raw']).toBeUndefined()
    expect(db().fileTags?.['att-f3-raw']).toEqual({ pillarId: 'p-chan', subPillarId: 'sp-club' })
    expect(db().documents.find((d) => d.id === 'doc-f-1')!.workstream).toBeUndefined()
    const files = libraryFiles(firmView())
    expect(files.find((f) => f.id === 'att-f1-raw')!.workstream?.sub?.id).toBe('sp-pack')
    expectNoStaleName(firmView(), files, PLANT, LINE, LABOR)
  })
})
