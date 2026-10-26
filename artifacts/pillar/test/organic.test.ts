import { beforeEach, describe, expect, it } from 'vitest'
import { applyDemoOrganicDefaults, buildSeed, SEED_VERSION } from '../src/lib/seed'
import { scopeFor } from '../src/lib/permissions'
import { buildBridge, buildDashboardBridge } from '../src/lib/bridge'
import { dashboardBridgeWorkbook } from '../src/lib/exports'
import { useStore } from '../src/lib/store'

const companyId = 'c-fernhill'
const view = (db = buildSeed(), user = 'u-alex') => scopeFor(db, user, companyId)!

describe('independent organic bridge contribution', () => {
  it('keeps missing values at zero without hiding the organic step or changing legacy consumers', () => {
    const v = view()
    delete v.company.organicTargetEbitda
    delete v.company.organicRealizedEbitda
    const legacy = buildBridge(v)
    const dashboard = buildDashboardBridge(v)
    expect(dashboard.steps[1]).toMatchObject({ kind: 'organic', target: 0, realized: 0, outline: 0 })
    expect(dashboard.target).toBe(legacy.target)
    expect(dashboard.current).toBe(legacy.current)
    expect(legacy.steps.some((s) => s.kind === 'organic')).toBe(false)
  })
  it.each([[5, 2, 3, 5], [5, 7, 0, 7], [0, 2, 0, 2]])('reconciles target %s realized %s without double counting', (target, realized, gap, span) => {
    const v = view()
    const legacy = buildBridge(v)
    v.company.organicTargetEbitda = target
    v.company.organicRealizedEbitda = realized
    const b = buildDashboardBridge(v)
    expect(b.steps[1]).toMatchObject({ base: b.entry, solid: realized, outline: gap, total: b.entry + span })
    expect(b.current).toBeCloseTo(legacy.current + realized)
    expect(b.target).toBeCloseTo(legacy.target + span)
    expect(b.steps.at(-2)!.total).toBe(b.target)
    expect(buildBridge(v)).toEqual(legacy)
    const sheet = dashboardBridgeWorkbook(v, b).sheets[0]
    expect(sheet.rows[1]).toMatchObject({ kind: 'Organic', target, solid: realized, outline: gap })
    expect(sheet.rows.at(-1)).toMatchObject({ total: b.target })
  })
  it('never infers uplift from IC, excludes hidden pillars for management and hides IC', () => {
    const db = buildSeed()
    const firm = view(db)
    firm.company.exitEbitda = 999
    firm.company.organicTargetEbitda = 4
    const b = buildDashboardBridge(firm)
    const mgmt = buildDashboardBridge(view(db, 'u-chris'))
    expect(b.steps[1].target).toBe(4)
    expect(b.icCase).toBe(999)
    expect(mgmt.icCase).toBeUndefined()
    expect(mgmt.target).toBeLessThan(b.target)
    expect(mgmt.steps.some((s) => s.key === 'p-fin')).toBe(false)
    expect(JSON.stringify(dashboardBridgeWorkbook(view(db, 'u-chris'), mgmt))).not.toContain('999')
  })
})

describe('organic save action', () => {
  beforeEach(() => {
    const db = buildSeed()
    delete db.companies[0].organicTargetEbitda
    delete db.companies[0].organicRealizedEbitda
    useStore.setState({ db, userId: 'u-alex', companyId })
  })
  it('protects locked targets but permits realized updates, then permits targets in a revision', () => {
    expect(useStore.getState().saveOrganicEbitda(companyId, 5, 1)).toBe(false)
    expect(useStore.getState().saveOrganicEbitda(companyId, 0, 1)).toBe(true)
    useStore.getState().startRevision(companyId, 'Organic growth assumptions')
    expect(useStore.getState().saveOrganicEbitda(companyId, 5, 2)).toBe(true)
    expect(useStore.getState().db.seedVersion).toBe(SEED_VERSION)
  })
  it.each(['u-chris', 'u-jordan', 'u-dana', 'missing'])('denies non-editor or non-member %s', (userId) => {
    useStore.setState({ userId })
    expect(useStore.getState().saveOrganicEbitda(companyId, 0, 2)).toBe(false)
    expect(useStore.getState().db.companies[0].organicRealizedEbitda).toBeUndefined()
  })
  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid amount %s', (n) => {
    useStore.getState().startRevision(companyId, 'Test')
    expect(useStore.getState().saveOrganicEbitda(companyId, n, 1)).toBe(false)
    expect(useStore.getState().saveOrganicEbitda(companyId, 1, n)).toBe(false)
  })
  it('isolates companies and leaves existing pillars intact', () => {
    const pillars = structuredClone(useStore.getState().db.pillars)
    useStore.getState().startRevision(companyId, 'Test')
    expect(useStore.getState().saveOrganicEbitda(companyId, 5, 2)).toBe(true)
    useStore.getState().setCompany('c-northgate')
    expect(useStore.getState().db.companies.find((c) => c.id === 'c-northgate')!.organicTargetEbitda).toBe(6)
    useStore.getState().setCompany(companyId)
    expect(useStore.getState().db.companies[0].organicTargetEbitda).toBe(5)
    expect(useStore.getState().db.pillars).toEqual(pillars)
  })
})

describe('illustrative demo performance', () => {
  it('gives every seeded business a positive independent organic contribution', () => {
    for (const c of buildSeed().companies) {
      expect(c.organicTargetEbitda).toBeGreaterThan(0)
      expect(c.organicRealizedEbitda).toBeGreaterThan(0)
    }
    const bridge = buildDashboardBridge(view())
    expect(bridge.steps[1]).toMatchObject({ target: 5, solid: 1.5, outline: 3.5 })
    expect(bridge.current).toBeCloseTo(buildBridge(view()).current + 1.5)
    expect(bridge.target).toBe(70)
  })
  it('fills missing demo fields without resetting plans, explicit zeros, partial inputs or custom companies', () => {
    const db = buildSeed()
    delete db.companies[0].organicTargetEbitda
    delete db.companies[0].organicRealizedEbitda
    db.companies[0].name = 'Edited demo business'
    db.companies[1].organicTargetEbitda = 0
    db.companies[1].organicRealizedEbitda = 0
    db.companies[2].organicTargetEbitda = 9
    delete db.companies[2].organicRealizedEbitda
    db.companies.push({ ...db.companies[0], id: 'custom-company' })
    const result = applyDemoOrganicDefaults(db)
    expect(result.companies[0]).toMatchObject({ name: 'Edited demo business', organicTargetEbitda: 5, organicRealizedEbitda: 1.5 })
    expect(result.companies[1]).toMatchObject({ organicTargetEbitda: 0, organicRealizedEbitda: 0 })
    expect(result.companies[2]).toMatchObject({ organicTargetEbitda: 9 })
    expect(result.companies[2].organicRealizedEbitda).toBeUndefined()
    expect(result.companies[3].organicTargetEbitda).toBeUndefined()
    expect(result.pillars).toEqual(db.pillars)
    expect(result.seedVersion).toBe(db.seedVersion)
  })
})
