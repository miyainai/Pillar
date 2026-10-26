import { describe, expect, it } from 'vitest'
import { buildSeed, SEED_VERSION } from '../src/lib/seed'
import { canUpgrade, OLDEST_UPGRADABLE, upgradeDb } from '../src/lib/migrate'
import type { DB } from '../src/lib/types'

/** A saved database from the previous seed version: no fileTags, no logos, plus the user's own work. */
function savedV4(): DB {
  const db = buildSeed(new Date('2026-10-01T00:00:00Z')) as Partial<DB>
  delete db.fileTags
  for (const c of db.companies!) delete c.logoUrl
  db.seedVersion = OLDEST_UPGRADABLE
  for (const a of db.asks as unknown as ({ assigneeIds?: string[]; assigneeId?: string })[]) {
    a.assigneeId = a.assigneeIds![0]
    delete a.assigneeIds
  }
  db.companies!.push({ id: 'c-mine', name: 'My Own Co', sector: 'Software', closeDate: '2026-01-01', holdYears: 5, entryEbitda: 10, exitEbitda: 20 })
  db.documents!.push({ id: 'doc-mine', companyId: 'c-mine', name: 'My_model.xlsx', type: 'Model', size: 1000, uploadedBy: 'u-alex', date: '2026-09-01T00:00:00Z' })
  delete db.settings!['c-mine']
  return db as DB
}

describe('upgrading saved data', () => {
  it('keeps everything the user saved and fills in the new fields', () => {
    const before = savedV4()
    const docs = before.documents.length
    const updates = before.updates.length
    const db = upgradeDb(structuredClone(before))
    expect(db.seedVersion).toBe(SEED_VERSION)
    expect(db.companies.map((c) => c.id)).toContain('c-mine')
    expect(db.documents).toHaveLength(docs)
    expect(db.updates).toHaveLength(updates)
    expect(db.documents.find((d) => d.id === 'doc-mine')).toBeTruthy()
    expect(db.fileTags).toEqual({})
    expect(db.settings['c-mine']).toBeTruthy()
    expect(db.companies.find((c) => c.id === 'c-fernhill')?.logoUrl).toBe('logos/fernhill.svg')
    const seed = buildSeed(new Date('2026-10-01T00:00:00Z'))
    for (const a of db.asks) {
      expect(a.assigneeIds).toEqual(seed.asks.find((s) => s.id === a.id)!.assigneeIds.slice(0, 1))
      expect('assigneeId' in a).toBe(false)
    }
  })
  it('does not overwrite values the user already set', () => {
    const before = savedV4()
    before.companies[0].logoUrl = 'logos/custom.svg'
    before.fileTags = { 'att-1': { pillarId: 'p-proc', subPillarId: null } }
    const db = upgradeDb(before)
    expect(db.companies[0].logoUrl).toBe('logos/custom.svg')
    expect(db.fileTags).toEqual({ 'att-1': { pillarId: 'p-proc', subPillarId: null } })
  })
  it('only upgrades databases from a version it understands', () => {
    expect(canUpgrade(OLDEST_UPGRADABLE, savedV4())).toBe(true)
    expect(canUpgrade(SEED_VERSION, savedV4())).toBe(true)
    expect(canUpgrade(OLDEST_UPGRADABLE - 1, savedV4())).toBe(false)
    expect(canUpgrade(OLDEST_UPGRADABLE, undefined)).toBe(false)
    expect(canUpgrade(OLDEST_UPGRADABLE, { companies: 'nope' })).toBe(false)
  })
})
