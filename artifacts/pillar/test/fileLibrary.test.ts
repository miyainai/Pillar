import { describe, expect, it } from 'vitest'
import { buildSeed } from '../src/lib/seed'
import { scopeFor } from '../src/lib/permissions'
import { FOLDER, folderTree, libraryFiles, trailText, workstreamOptions } from '../src/lib/fileLibrary'
import type { DB } from '../src/lib/types'

const db = buildSeed()
const firm = scopeFor(db, 'u-alex', 'c-fernhill')!
const mgmt = scopeFor(db, 'u-taylor', 'c-fernhill')!

const find = (tree: ReturnType<typeof folderTree>, key: string) => {
  const walk = (nodes: typeof tree): (typeof tree)[number] | undefined => {
    for (const n of nodes) {
      if (n.key === key) return n
      const inner = walk(n.children)
      if (inner) return inner
    }
    return undefined
  }
  return walk(tree)
}

describe('file library', () => {
  it('merges deal materials, update attachments and data-request files for the firm', () => {
    const files = libraryFiles(firm)
    const docs = firm.documents.length
    const updAtt = firm.updates.reduce((n, u) => n + u.attachments.length, 0)
    const askAtt = firm.asks.reduce((n, a) => n + a.attachments.length, 0)
    expect(files).toHaveLength(docs + updAtt + askAtt)
    expect(files.filter((f) => f.source === 'setup')).toHaveLength(docs)
    expect(files.filter((f) => f.source === 'update')).toHaveLength(updAtt)
    expect(files.filter((f) => f.source === 'ask')).toHaveLength(askAtt)
    // Newest first, ids unique.
    expect(new Set(files.map((f) => f.id)).size).toBe(files.length)
    for (let i = 1; i < files.length; i++) expect(files[i - 1].date >= files[i].date).toBe(true)
  })

  it('files each record under the right folders with matching tree counts', () => {
    const files = libraryFiles(firm)
    const tree = folderTree(firm, files)
    expect(find(tree, FOLDER.all)!.count).toBe(files.length)
    expect(find(tree, FOLDER.materials)!.count).toBe(firm.documents.length)
    expect(find(tree, FOLDER.docType('IC deck'))!.count).toBe(1)
    expect(find(tree, FOLDER.docType('CIM'))!.count).toBe(0)
    expect(find(tree, FOLDER.stage('raw'))!.count).toBe(firm.asks.flatMap((a) => a.attachments).filter((x) => x.stage === 'raw').length)
    expect(find(tree, FOLDER.stage('final'))!.count).toBe(firm.asks.flatMap((a) => a.attachments).filter((x) => x.stage === 'final').length)
    // A pillar folder holds everything posted on it or any of its sub-pillars.
    const procFiles = files.filter((f) => f.workstream?.pillar.id === 'p-proc')
    expect(procFiles.length).toBeGreaterThan(0)
    expect(find(tree, FOLDER.pillar('p-proc'))!.count).toBe(procFiles.length)
    expect(find(tree, FOLDER.sub('sp-dm'))!.count).toBe(procFiles.filter((f) => f.workstream?.sub?.id === 'sp-dm').length)
    expect(find(tree, FOLDER.sub('sp-pack'))!.count).toBe(procFiles.filter((f) => f.workstream?.sub?.id === 'sp-pack').length)
    expect(find(tree, FOLDER.sub('sp-pack'))!.count).toBeGreaterThanOrEqual(2) // the carrier-invoice request files
    // Pillars appear in plan order.
    expect(find(tree, FOLDER.workstreams)!.children.map((c) => c.label)).toEqual(firm.pillars.map((p) => `${p.num}. ${p.name}`))
  })

  it('resolves trails for update- and ask-sourced files', () => {
    const files = libraryFiles(firm)
    const spend = files.find((f) => f.name === 'Spend_cube_v1.xlsx')!
    expect(spend.workstream?.pillar.id).toBe('p-proc')
    expect(spend.workstream?.sub?.id).toBe('sp-dm')
    expect(trailText(spend)).toMatch(/^Fernhill Foods › 1\. Procurement savings › 1\.1 Direct materials re-bid › Update by Casey Nguyen on /)
    expect(spend.note).toMatch(/Spend cube complete/)

    const raw = files.find((f) => f.id === 'att-f1-raw')!
    expect(raw.category).toBe('Management upload')
    expect(raw.folders).toContain(FOLDER.stage('raw'))
    expect(raw.folders).toContain(FOLDER.sub('sp-pack'))
    expect(trailText(raw)).toContain('Data request "Carrier invoices by lane, last 12 months" (management upload)')
    expect(raw.trail.at(-1)?.to).toBe('/c/c-fernhill/asks/ask-f-1')

    const doc = files.find((f) => f.id === 'doc-f-1')!
    expect(trailText(doc)).toBe('Fernhill Foods › Deal materials › IC deck')
    expect(doc.workstream).toBeNull()
  })

  it('applies the management projection: no deal materials, no final files, no hidden workstreams', () => {
    const files = libraryFiles(mgmt)
    expect(files.some((f) => f.source === 'setup')).toBe(false)
    expect(files.some((f) => f.origin.kind === 'ask' && f.origin.stage === 'final')).toBe(false)
    expect(files.every((f) => f.source !== 'update' || f.origin.kind !== 'update' || f.origin.update.visibility === 'shared')).toBe(true)
    const tree = folderTree(mgmt, files)
    expect(find(tree, FOLDER.materials)).toBeUndefined()
    expect(find(tree, FOLDER.stage('final'))).toBeUndefined()
    expect(find(tree, FOLDER.pillar('p-fin'))).toBeUndefined()
    const text = JSON.stringify(files.map((f) => [f.trail, f.note, f.name])).toLowerCase()
    for (const secret of ['finance leadership', 'padding', 'freight_baseline_clean']) expect(text, secret).not.toContain(secret)
  })

  it('applies workstream overrides and document edits', () => {
    const edited: DB = structuredClone(db)
    edited.fileTags = { 'att-f1-raw': { pillarId: 'p-plant', subPillarId: 'sp-labor' }, 'upd-fer-2-att-0': { pillarId: 'p-fin', subPillarId: null } }
    const doc = edited.documents.find((d) => d.id === 'doc-f-2')!
    doc.type = 'Other'
    doc.workstream = { pillarId: 'p-price', subPillarId: 'sp-list' }

    const v = scopeFor(edited, 'u-alex', 'c-fernhill')!
    const files = libraryFiles(v)
    const raw = files.find((f) => f.id === 'att-f1-raw')!
    expect(raw.retagged).toBe(true)
    expect(raw.folders).toContain(FOLDER.sub('sp-labor'))
    expect(raw.folders).not.toContain(FOLDER.sub('sp-pack'))
    expect(trailText(raw)).toContain('Plant efficiency')
    expect(trailText(raw)).toContain('Data request "Carrier invoices')

    const movedDoc = files.find((f) => f.id === 'doc-f-2')!
    expect(movedDoc.category).toBe('Other')
    expect(movedDoc.folders).toEqual(expect.arrayContaining([FOLDER.docType('Other'), FOLDER.pillar('p-price'), FOLDER.sub('sp-list')]))
    expect(trailText(movedDoc)).toBe('Fernhill Foods › Deal materials › Other › 3. Pricing and mix › 3.1 List price increase')
    const tree = folderTree(v, files)
    expect(find(tree, FOLDER.docType('Model'))!.count).toBe(0)
    expect(find(tree, FOLDER.sub('sp-list'))!.count).toBeGreaterThanOrEqual(1)

    // Management never sees a tag that points at a hidden workstream.
    const mv = scopeFor(edited, 'u-taylor', 'c-fernhill')!
    expect(mv.fileTags['att-f1-raw']).toBeUndefined()
    const mraw = libraryFiles(mv).find((f) => f.id === 'att-f1-raw')!
    expect(mraw.retagged).toBe(false)
    expect(mraw.workstream?.sub?.id).toBe('sp-pack')
  })

  it('offers workstream choices in plan order with sub-pillars nested', () => {
    const opts = workstreamOptions(firm)
    expect(opts[0].label).toBe('1. Procurement savings')
    expect(opts[1].ref).toEqual({ pillarId: 'p-proc', subPillarId: 'sp-dm' })
    expect(opts.map((o) => o.ref.pillarId)).toEqual([...new Set(opts.map((o) => o.ref.pillarId))].flatMap((id) => opts.filter((o) => o.ref.pillarId === id).map(() => id)))
  })
})
