import { describe, expect, it } from 'vitest'
import { buildSeed } from '../src/lib/seed'
import { scopeFor } from '../src/lib/permissions'
import { planTotals, progressFor } from '../src/lib/selectors'
import { customPeriod, periodFor } from '../src/lib/dates'

const db = buildSeed()

describe('permission function', () => {
  it('firm roles see the whole Fernhill plan', () => {
    const v = scopeFor(db, 'u-alex', 'c-fernhill')!
    expect(v.pillars).toHaveLength(6)
    expect(planTotals(v).target).toBe(25)
    expect(planTotals(v).captured).toBe(2.7)
    expect(v.pillars.find((p) => p.name === 'Plant efficiency')!.target).toBe(4)
  })

  it('checks membership first', () => {
    expect(scopeFor(db, 'u-taylor', 'c-kestrel')).toBeNull()
    expect(scopeFor(db, 'u-morgan', 'c-northgate')).toBeNull()
  })

  it('management sees shared items only, with no traces', () => {
    const v = scopeFor(db, 'u-taylor', 'c-fernhill')!
    expect(v.pillars.map((p) => p.name)).toEqual([
      'Procurement savings',
      'Club and e-commerce channel expansion',
      'Pricing and mix',
      'Plant efficiency',
      'Add-on M&A',
    ])
    // Contiguous numbering, no gaps.
    expect(v.pillars.map((p) => p.num)).toEqual([1, 2, 3, 4, 5])
    expect(v.subPillars.find((s) => s.pillarId === 'p-plant')!.num).toBe('4.1')
    // Totals exclude the hidden sub-pillar.
    expect(v.pillars.find((p) => p.name === 'Plant efficiency')!.target).toBe(2.5)
    expect(planTotals(v).target).toBe(23.5)

    expect(v.subPillars.some((s) => s.visibility === 'firm')).toBe(false)
    expect(v.updates.every((u) => u.visibility === 'shared')).toBe(true)
    expect(v.asks.every((a) => a.type === 'data_request' && a.mgmtAssigneeId)).toBe(true)
    expect(v.documents).toHaveLength(0)
    expect(v.commentary).toHaveLength(0)

    const text = JSON.stringify(v).toLowerCase()
    for (const secret of ['finance leadership', 'labor scheduling', 'succession', 'headcount', 'overtime', 'promo-spend', 'padding', 'hold until the new controller', 'ic memo', 'p-fin', 'sp-labor', 'ph-ls-', 'k-ls', 'k-fn'])
      expect(text, secret).not.toContain(secret)
  })

  it('management sees the management version of a data request, never the original', () => {
    const v = scopeFor(db, 'u-taylor', 'c-fernhill')!
    const a = v.asks.find((x) => x.id === 'ask-f-2')!
    expect(a.title).toBe('Price and volume by SKU for top 15 customers')
    expect(a.description).toMatch(/^Please send/)
    expect(a.attachments.every((x) => x.stage === 'raw')).toBe(true)
    expect(v.asks.find((x) => x.id === 'ask-f-4')).toBeUndefined() // not routed yet
    expect(v.asks.find((x) => x.id === 'ask-f-5')).toBeUndefined() // questions stay inside the firm
  })

  it('a board-supplement preview matches what management sees', () => {
    const preview = scopeFor(db, 'u-alex', 'c-fernhill', { asManagement: true })!
    expect(preview.pillars.map((p) => p.id)).toEqual(scopeFor(db, 'u-taylor', 'c-fernhill')!.pillars.map((p) => p.id))
  })
})

describe('progress view', () => {
  const day = 86_400_000
  const ago = (n: number) => new Date(Date.now() - n * day).toISOString()

  it('rebuilds captured EBITDA from the event log', () => {
    const v = scopeFor(db, 'u-alex', 'c-fernhill')!
    // As of now, compared with a point before any history: everything counts as added.
    const period = customPeriod(ago(200), new Date(Date.now() + 1000).toISOString())
    const prior = customPeriod(ago(400), ago(200))
    const rows = progressFor(v, period, prior)
    const pillars = rows.filter((r) => r.level === 'pillar')
    const added = pillars.reduce((a, r) => a + r.capturedAdded, 0)
    expect(Math.round(added * 10) / 10).toBe(2.7)
    expect(Math.round(pillars.reduce((a, r) => a + r.capturedAtEnd, 0) * 10) / 10).toBe(2.7)
    expect(pillars.reduce((a, r) => a + r.capturedAtStart, 0)).toBe(0)
    expect(pillars.find((r) => r.name === 'Pricing and mix')!.statusChanges.map((c) => c.to)).toEqual(['On track', 'At risk'])
  })

  it('reads numbers as of the period end and changes since the comparison point', () => {
    const v = scopeFor(db, 'u-alex', 'c-fernhill')!
    // As of 20 days ago, compared with 45 days ago: the $1.2M re-bid (42d) and $0.8M club (38d) updates land in between.
    const period = customPeriod(ago(60), ago(20))
    const prior = customPeriod(ago(90), ago(45))
    const rows = progressFor(v, period, prior)
    const proc = rows.find((r) => r.name === 'Procurement savings')!
    expect(proc.capturedAtStart).toBe(0.5)
    expect(proc.capturedAtEnd).toBe(1.2)
    expect(proc.capturedAdded).toBe(0.7)
    const chan = rows.find((r) => r.name === 'Club and e-commerce channel expansion')!
    expect(chan.capturedAtEnd).toBe(0.8) // the $1.1M update (10d) is after the period end
    expect(chan.capturedAdded).toBe(0.8)
  })

  it('shows no change when a period is compared with itself', () => {
    const v = scopeFor(db, 'u-alex', 'c-fernhill')!
    const q = periodFor('quarter', 0)
    const rows = progressFor(v, q, q)
    expect(rows.every((r) => r.capturedAdded === 0 && r.statusChanges.length === 0 && r.phasesCompleted.length === 0 && r.asksClosed === 0 && r.updates === 0)).toBe(true)
    expect(rows.every((r) => r.capturedAtStart === r.capturedAtEnd)).toBe(true)
  })
})
