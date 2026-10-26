// Demo seed data (SPEC.md section 9). All of it is fictional.
// Dates are relative to "now" so the demo always reads as "four months after close".

import type {
  Activity,
  Ask,
  Attachment,
  Comment,
  Company,
  DB,
  Document,
  KPI,
  Membership,
  Phase,
  PhaseStatus,
  Pillar,
  PlanStatus,
  Role,
  Settings,
  SubPillar,
  Update,
  User,
  VCPVersion,
} from './types'
import { daysAgo, daysFromNow } from './dates'

export const SEED_VERSION = 7

// Illustrative business performance, specified independently of the IC exit case.
export const DEMO_ORGANIC_EBITDA: Record<string, { organicTargetEbitda: number; organicRealizedEbitda: number }> = {
  'c-fernhill': { organicTargetEbitda: 5, organicRealizedEbitda: 1.5 },
  'c-kestrel': { organicTargetEbitda: 4, organicRealizedEbitda: 1.8 },
  'c-northgate': { organicTargetEbitda: 6, organicRealizedEbitda: 3 },
}

/** Populate only untouched demo assumptions; never replace an explicit zero or custom company. */
export function applyDemoOrganicDefaults(db: DB): DB {
  return {
    ...db,
    companies: db.companies.map((company) =>
      DEMO_ORGANIC_EBITDA[company.id] && company.organicTargetEbitda === undefined && company.organicRealizedEbitda === undefined
        ? { ...company, ...DEMO_ORGANIC_EBITDA[company.id] }
        : company,
    ),
  }
}

export const DEFAULT_SETTINGS: Settings = {
  urgencyHours: { Critical: 24, High: 72, Standard: 168, Low: 336 },
  defaultVisibility: 'firm',
  staleDays: 14,
}

let counter = 0
export function uid(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function buildSeed(now: Date = new Date()): DB {
  const d = (n: number) => daysAgo(n, now)
  const f = (n: number) => daysFromNow(n, now)

  // ---------- People ----------
  // Headshots are AI-generated for these fictional people (public/avatars).
  const photo = (id: string) => `avatars/${id}.jpg`
  const users: User[] = [
    { id: 'u-alex', name: 'Alex Chen', email: 'alex.chen@ashgrove.example', title: 'Managing Director', avatarUrl: photo('alex') },
    { id: 'u-priya', name: 'Priya Raman', email: 'priya.raman@ashgrove.example', title: 'Vice President', avatarUrl: photo('priya') },
    { id: 'u-sam', name: 'Sam Ortiz', email: 'sam.ortiz@ashgrove.example', title: 'Associate', avatarUrl: photo('sam') },
    { id: 'u-jordan', name: 'Jordan Lee', email: 'jordan.lee@ashgrove.example', title: 'Operating Partner, Operations', avatarUrl: photo('jordan') },
    { id: 'u-casey', name: 'Casey Nguyen', email: 'casey.nguyen@ashgrove.example', title: 'Operating Partner, Procurement', avatarUrl: photo('casey') },
    { id: 'u-morgan', name: 'Morgan Blake', email: 'morgan.blake@ashgrove.example', title: 'Operating Partner, Commercial', avatarUrl: photo('morgan') },
    { id: 'u-chris', name: 'Chris Patel', email: 'chris.patel@fernhill.example', title: 'CEO, Fernhill Foods', avatarUrl: photo('chris') },
    { id: 'u-taylor', name: 'Taylor Brooks', email: 'taylor.brooks@fernhill.example', title: 'CFO, Fernhill Foods', avatarUrl: photo('taylor') },
    // Lighter companies
    { id: 'u-dana', name: 'Dana Whitfield', email: 'dana.whitfield@ashgrove.example', title: 'Managing Director', avatarUrl: photo('dana') },
    { id: 'u-riley', name: 'Riley Park', email: 'riley.park@ashgrove.example', title: 'Operating Partner, Revenue', avatarUrl: photo('riley') },
    { id: 'u-pat', name: 'Pat Romero', email: 'pat.romero@kestrel.example', title: 'CEO, Kestrel Dental', avatarUrl: photo('pat') },
    { id: 'u-ravi', name: 'Ravi Shah', email: 'ravi.shah@ashgrove.example', title: 'Vice President', avatarUrl: photo('ravi') },
    { id: 'u-elena', name: 'Elena Marsh', email: 'elena.marsh@ashgrove.example', title: 'Associate', avatarUrl: photo('elena') },
    { id: 'u-lee', name: 'Lee Morales', email: 'lee.morales@northgate.example', title: 'CFO, Northgate Supply', avatarUrl: photo('lee') },
  ]

  const companies: Company[] = [
    // Logo marks are generated placeholders (public/logos).
    { id: 'c-fernhill', name: 'Fernhill Foods', sector: 'Specialty snacks', closeDate: d(122), holdYears: 5, entryEbitda: 40, exitEbitda: 65, logoUrl: 'logos/fernhill.svg', ...DEMO_ORGANIC_EBITDA['c-fernhill'] },
    { id: 'c-kestrel', name: 'Kestrel Dental Partners', sector: 'Dental services', closeDate: d(430), holdYears: 5, entryEbitda: 22, exitEbitda: 38, logoUrl: 'logos/kestrel.svg', ...DEMO_ORGANIC_EBITDA['c-kestrel'] },
    { id: 'c-northgate', name: 'Northgate Industrial Supply', sector: 'MRO distribution', closeDate: d(790), holdYears: 5, entryEbitda: 55, exitEbitda: 80, logoUrl: 'logos/northgate.svg', ...DEMO_ORGANIC_EBITDA['c-northgate'] },
  ]

  const memberships: Membership[] = []
  const member = (userId: string, companyId: string, role: Role) =>
    memberships.push({ id: `m-${userId}-${companyId}`, userId, companyId, role })
  member('u-alex', 'c-fernhill', 'MD')
  member('u-priya', 'c-fernhill', 'VP')
  member('u-sam', 'c-fernhill', 'Associate')
  member('u-jordan', 'c-fernhill', 'OP')
  member('u-casey', 'c-fernhill', 'OP')
  member('u-morgan', 'c-fernhill', 'OP')
  member('u-chris', 'c-fernhill', 'Management')
  member('u-taylor', 'c-fernhill', 'Management')
  member('u-dana', 'c-kestrel', 'MD')
  member('u-priya', 'c-kestrel', 'VP')
  member('u-sam', 'c-kestrel', 'Associate')
  member('u-jordan', 'c-kestrel', 'OP')
  member('u-riley', 'c-kestrel', 'OP')
  member('u-pat', 'c-kestrel', 'Management')
  member('u-alex', 'c-northgate', 'MD')
  member('u-ravi', 'c-northgate', 'VP')
  member('u-elena', 'c-northgate', 'Associate')
  member('u-jordan', 'c-northgate', 'OP')
  member('u-casey', 'c-northgate', 'OP')
  member('u-lee', 'c-northgate', 'Management')

  const pillars: Pillar[] = []
  const subPillars: SubPillar[] = []
  const phases: Phase[] = []
  const kpis: KPI[] = []
  const updates: Update[] = []
  const asks: Ask[] = []
  const comments: Comment[] = []
  const activity: Activity[] = []
  const documents: Document[] = []
  const vcpVersions: VCPVersion[] = []

  let actN = 0
  const act = (a: Omit<Activity, 'id'>) => activity.push({ id: `a-${++actN}`, ...a })

  // ---------- Builders ----------
  type PillarIn = Partial<Pillar> & Pick<Pillar, 'id' | 'companyId' | 'name' | 'objective' | 'ownerIds' | 'status' | 'visibility'>
  const pillar = (p: PillarIn) => {
    const order = pillars.filter((x) => x.companyId === p.companyId).length
    pillars.push({
      rationale: '',
      sourceRef: '',
      targetImpact: 0,
      capturedImpact: 0,
      startDate: d(112),
      targetDate: f(900),
      lastUpdated: d(112),
      order,
      ...p,
    })
  }
  type SubIn = Partial<SubPillar> & Pick<SubPillar, 'id' | 'pillarId' | 'name' | 'objective' | 'targetImpact' | 'ownerIds' | 'status'>
  const sub = (s: SubIn) => {
    const parent = pillars.find((p) => p.id === s.pillarId)!
    const order = subPillars.filter((x) => x.pillarId === s.pillarId).length
    subPillars.push({
      companyId: parent.companyId,
      capturedImpact: 0,
      visibility: parent.visibility,
      startDate: parent.startDate,
      targetDate: parent.targetDate,
      lastUpdated: parent.startDate,
      order,
      ...s,
    })
  }
  const phase = (
    id: string,
    parent: string,
    name: string,
    start: string,
    end: string,
    status: PhaseStatus,
    description: string,
    deliverables: string[],
    completedAt?: string,
  ) => {
    const sp = subPillars.find((s) => s.id === parent)
    const p = sp ? pillars.find((x) => x.id === sp.pillarId)! : pillars.find((x) => x.id === parent)!
    const subPillarId = sp ? sp.id : null
    const order = phases.filter((x) => x.pillarId === p.id && x.subPillarId === subPillarId).length
    phases.push({
      id,
      companyId: p.companyId,
      pillarId: p.id,
      subPillarId,
      name,
      description,
      deliverables,
      startDate: start,
      endDate: end,
      status,
      completedAt,
      order,
    })
  }
  const kpi = (
    id: string,
    parent: string,
    name: string,
    unit: string,
    baseline: number,
    target: number,
    actuals: [number, number][],
  ) => {
    const sp = subPillars.find((s) => s.id === parent)
    const p = sp ? pillars.find((x) => x.id === sp.pillarId)! : pillars.find((x) => x.id === parent)!
    kpis.push({
      id,
      companyId: p.companyId,
      pillarId: p.id,
      subPillarId: sp ? sp.id : null,
      name,
      unit,
      baseline,
      target,
      actuals: actuals.map(([ago, value]) => ({ date: d(ago), value })),
    })
  }

  let updN = 0
  const upd = (
    ago: number,
    authorId: string,
    target: string,
    text: string,
    opts: {
      visibility?: 'internal' | 'shared'
      status?: [PlanStatus, PlanStatus]
      captured?: [number, number]
      phaseId?: string
      phaseDone?: { done: string; next: string }
      attachments?: string[]
    } = {},
  ) => {
    const sp = subPillars.find((s) => s.id === target)
    const p = sp ? pillars.find((x) => x.id === sp.pillarId)! : pillars.find((x) => x.id === target)!
    const at = d(ago)
    const id = `upd-${p.companyId.slice(2, 5)}-${++updN}`
    updates.push({
      id,
      companyId: p.companyId,
      pillarId: p.id,
      subPillarId: sp?.id ?? null,
      phaseId: opts.phaseId ?? null,
      authorId,
      text,
      statusChange: opts.status ? { from: opts.status[0], to: opts.status[1] } : undefined,
      capturedChange: opts.captured ? { from: opts.captured[0], to: opts.captured[1] } : undefined,
      phaseCompleted: opts.phaseDone,
      attachments: (opts.attachments ?? []).map((name, i) => ({
        id: `${id}-att-${i}`,
        name,
        size: 180_000 + i * 52_000,
        uploadedBy: authorId,
        at,
      })),
      visibility: opts.visibility ?? 'internal',
      createdAt: at,
    })
    const objectType = sp ? 'subPillar' : 'pillar'
    const objectId = sp ? sp.id : p.id
    act({ companyId: p.companyId, actorId: authorId, action: 'posted an update', objectType: 'update', objectId: id, at })
    if (opts.status)
      act({ companyId: p.companyId, actorId: authorId, action: 'changed status', objectType, objectId, field: 'status', oldValue: opts.status[0], newValue: opts.status[1], at })
    if (opts.captured)
      act({ companyId: p.companyId, actorId: authorId, action: 'updated captured EBITDA', objectType, objectId, field: 'captured', oldValue: opts.captured[0], newValue: opts.captured[1], at })
    if (opts.phaseId)
      if (opts.phaseDone)
        act({ companyId: p.companyId, actorId: authorId, action: 'completed phase', objectType: 'phase', objectId: opts.phaseId, field: 'status', oldValue: 'In progress', newValue: 'Complete', at })
  }
  const pillarStatus = (ago: number, actorId: string, pillarId: string, from: PlanStatus, to: PlanStatus) => {
    const p = pillars.find((x) => x.id === pillarId)!
    act({ companyId: p.companyId, actorId, action: 'changed status', objectType: 'pillar', objectId: pillarId, field: 'status', oldValue: from, newValue: to, at: d(ago) })
  }

  const att = (id: string, name: string, size: number, by: string, ago: number, stage?: 'raw' | 'final'): Attachment => ({
    id,
    name,
    size,
    uploadedBy: by,
    at: d(ago),
    stage,
  })

  // ---------------------------------------------------------------------
  // Fernhill Foods
  // ---------------------------------------------------------------------
  const F = 'c-fernhill'

  pillar({
    id: 'p-proc', companyId: F, name: 'Procurement savings', status: 'On track', visibility: 'shared',
    ownerIds: ['u-jordan', 'u-casey'],
    objective: 'Cut direct materials, packaging, and freight cost through competitive re-bids and supplier consolidation.',
    rationale: 'IC case assumes 150 bps of COGS improvement; diligence found 1,400 SKUs bought from 60+ suppliers with no re-bid in 4 years.',
    sourceRef: 'IC memo, p. 4 (EBITDA bridge); Commercial diligence, p. 18',
  })
  sub({ id: 'sp-dm', pillarId: 'p-proc', name: 'Direct materials re-bid', targetImpact: 4.5, capturedImpact: 1.2, ownerIds: ['u-casey'], status: 'On track', visibility: 'shared',
    startDate: d(70), targetDate: f(240),
    objective: 'Re-bid the top 20 SKUs (62% of materials spend), then consolidate the long tail.' })
  sub({ id: 'sp-pack', pillarId: 'p-proc', name: 'Packaging and freight', targetImpact: 2.5, ownerIds: ['u-jordan'], status: 'On track', visibility: 'shared',
    startDate: f(40), targetDate: f(300),
    objective: 'Consolidate carriers and rationalize packaging specs across $31M of addressable spend.' })

  pillar({
    id: 'p-chan', companyId: F, name: 'Club and e-commerce channel expansion', status: 'On track', visibility: 'shared',
    ownerIds: ['u-morgan'],
    objective: 'Launch in the club channel and scale e-commerce from 3% to 8% of sales.',
    rationale: 'Fernhill is under-indexed in club (0% vs. 14% category average) and e-commerce; buyers signalled interest during diligence.',
    sourceRef: 'IC memo, p. 5 (growth levers); CIM, p. 22',
  })
  sub({ id: 'sp-club', pillarId: 'p-chan', name: 'Club launch', targetImpact: 3.5, capturedImpact: 1.1, ownerIds: ['u-morgan'], status: 'On track', visibility: 'shared',
    startDate: d(38), targetDate: f(200),
    objective: 'Win national club distribution starting with a 400-door regional test.' })
  sub({ id: 'sp-ecom', pillarId: 'p-chan', name: 'E-commerce', targetImpact: 2.5, ownerIds: ['u-morgan'], status: 'On track', visibility: 'shared',
    startDate: f(30), targetDate: f(300),
    objective: 'Relaunch Amazon, then add a DTC subscription offer.' })

  pillar({
    id: 'p-price', companyId: F, name: 'Pricing and mix', status: 'At risk', visibility: 'shared',
    ownerIds: ['u-morgan'],
    objective: 'Take a 4% list price increase and shift mix toward premium SKUs.',
    rationale: 'Fernhill has not taken list price in 3 years while peers took 6 to 9%; premium SKUs carry 11 points more gross margin.',
    sourceRef: 'IC memo, p. 6; QoE report, p. 9 (margin by SKU)',
  })
  sub({ id: 'sp-list', pillarId: 'p-price', name: 'List price increase', targetImpact: 3.0, capturedImpact: 0.4, ownerIds: ['u-morgan'], status: 'At risk', visibility: 'shared',
    // On plan so far; "At risk" because two holdouts could push the rest out a quarter.
    startDate: d(49), targetDate: f(330),
    objective: 'Land a 4% increase with the top 15 customers without losing distribution.' })
  sub({ id: 'sp-mix', pillarId: 'p-price', name: 'Premium mix shift', targetImpact: 2.0, ownerIds: ['u-morgan'], status: 'Not started', visibility: 'shared',
    startDate: f(60), targetDate: f(365),
    objective: 'Grow premium SKUs from 18% to 26% of sales.' })

  pillar({
    id: 'p-plant', companyId: F, name: 'Plant efficiency', status: 'Not started', visibility: 'shared',
    ownerIds: ['u-jordan'],
    objective: 'Raise OEE at the Dayton plant from 61% to 72% and cut changeover time.',
    rationale: 'Operational diligence benchmarked OEE 11 points below best-in-class snack plants; overtime runs at 14% of hours.',
    sourceRef: 'IC memo, p. 7; Operational diligence, p. 12',
  })
  sub({ id: 'sp-line', pillarId: 'p-plant', name: 'Line efficiency', targetImpact: 2.5, ownerIds: ['u-jordan'], status: 'Not started', visibility: 'shared',
    startDate: f(180), targetDate: f(400),
    objective: 'Retrofit line 3 and cut changeover time by 40%.' })
  sub({ id: 'sp-labor', pillarId: 'p-plant', name: 'Labor scheduling', targetImpact: 1.5, ownerIds: ['u-jordan'], status: 'Not started', visibility: 'firm',
    startDate: f(90), targetDate: f(300),
    objective: 'Redesign shift patterns and realign headcount to demand; includes headcount reductions.' })

  pillar({
    id: 'p-mna', companyId: F, name: 'Add-on M&A', status: 'On track', visibility: 'shared',
    ownerIds: ['u-priya'],
    objective: 'Close one add-on in a complementary snack category within 18 months.',
    rationale: 'IC case includes one $3M EBITDA add-on at 7x; fragmented regional brands are available below platform multiple.',
    sourceRef: 'IC memo, p. 8 (add-on strategy)',
  })
  sub({ id: 'sp-pipe', pillarId: 'p-mna', name: 'Pipeline build', targetImpact: 0, ownerIds: ['u-priya'], status: 'On track', visibility: 'shared',
    objective: 'Build a pipeline of 25 qualified targets.' })
  sub({ id: 'sp-addon', pillarId: 'p-mna', name: 'First add-on close', targetImpact: 3.0, ownerIds: ['u-priya'], status: 'On track', visibility: 'shared',
    startDate: f(75), targetDate: f(150),
    objective: 'Sign and close the first add-on and deliver integration synergies.' })

  pillar({
    id: 'p-fin', companyId: F, name: 'Finance leadership transition', status: 'On track', visibility: 'firm',
    ownerIds: ['u-alex'], targetImpact: 0, capturedImpact: 0,
    objective: 'Build out the finance team and plan CFO succession ahead of the exit process.',
    rationale: 'Enabler, no direct EBITDA. QoE flagged a 12-day close and thin FP&A; exit readiness needs a public-company-grade CFO.',
    sourceRef: 'IC memo, p. 9 (key risks); QoE report, p. 3',
  })

  // Phases
  phase('ph-dm-1', 'sp-dm', 'Top-20 SKU re-bid', d(105), f(5), 'In progress', 'Run competitive RFQs on the 20 SKUs that make up 62% of materials spend.', ['Spend cube', 'RFQs to 3+ suppliers per SKU', 'Award letters'])
  phase('ph-dm-2', 'sp-dm', 'Long-tail SKU consolidation', f(5), f(120), 'Not started', 'Consolidate the remaining 1,380 SKUs onto preferred suppliers.', ['Supplier shortlist', 'Consolidation plan'])
  phase('ph-dm-3', 'sp-dm', 'Contract lock-in and PPV tracking', f(120), f(240), 'Not started', 'Sign multi-year contracts and track purchase price variance monthly.', ['Signed contracts', 'Monthly PPV report'])
  phase('ph-pk-1', 'sp-pack', 'Spend baseline', d(100), d(70), 'Complete', 'Baseline packaging and freight spend by lane and spec.', ['Spend baseline'], d(70))
  phase('ph-pk-2', 'sp-pack', 'Freight carrier consolidation', d(70), f(40), 'In progress', 'Consolidate from 9 carriers to 3 through an RFP.', ['RFP awards', 'New lane rates'])
  phase('ph-pk-3', 'sp-pack', 'Packaging spec rationalization', f(40), f(150), 'Not started', 'Cut film and carton specs from 140 to 60.', ['Spec library', 'Supplier transition'])
  phase('ph-cl-1', 'sp-club', 'Buyer pitch and slotting', d(105), d(63), 'Complete', 'Pitch club buyers and secure a regional test.', ['Club pack design', 'Buyer approval'], d(63))
  phase('ph-cl-2', 'sp-club', 'Regional club test', d(63), f(30), 'In progress', 'Run a 400-door test and hit sell-through targets.', ['Weekly sell-through report'])
  phase('ph-cl-3', 'sp-club', 'National club rollout', f(30), f(200), 'Not started', 'Roll out to 1,200 doors nationally.', ['National slotting', 'Supply plan'])
  phase('ph-ec-1', 'sp-ecom', 'Amazon storefront relaunch', d(40), d(12), 'Complete', 'Relaunch content, pricing, and ads on Amazon.', ['New content', 'Ad plan'], d(12))
  phase('ph-ec-2', 'sp-ecom', 'DTC subscription launch', d(12), f(90), 'In progress', 'Launch a subscription box on the Fernhill site.', ['Site build', 'Launch campaign'])
  phase('ph-ec-3', 'sp-ecom', 'Retail media scale-up', f(90), f(200), 'Not started', 'Scale retail media across Walmart and Target.', ['Retail media plan'])
  phase('ph-lp-1', 'sp-list', 'Price elasticity study', d(110), d(84), 'Complete', 'Model elasticity by SKU and customer.', ['Elasticity model'], d(84))
  phase('ph-lp-2', 'sp-list', 'Customer negotiations', d(84), f(20), 'In progress', 'Negotiate the increase with the top 15 customers.', ['Price letters', 'Signed acceptances'])
  phase('ph-lp-3', 'sp-list', 'Price realization tracking', f(20), f(150), 'Not started', 'Track realized price monthly against plan.', ['Monthly realization report'])
  phase('ph-pm-1', 'sp-mix', 'Premium SKU roadmap', f(10), f(60), 'Not started', 'Pick the premium SKUs to push and the ones to cut.', ['SKU roadmap'])
  phase('ph-pm-2', 'sp-mix', 'Innovation launches', f(60), f(240), 'Not started', 'Launch 4 premium innovations.', ['Launch plan'])
  phase('ph-pm-3', 'sp-mix', 'Shelf reset with top retailers', f(240), f(365), 'Not started', 'Reset shelves to favor premium SKUs.', ['Planograms'])
  phase('ph-le-1', 'sp-line', 'OEE baseline study', f(5), f(45), 'Not started', 'Measure OEE by line and shift.', ['OEE baseline'])
  phase('ph-le-2', 'sp-line', 'Line 3 retrofit', f(45), f(180), 'Not started', 'Retrofit line 3 with a new fryer and seasoning drum.', ['Capex approval', 'Commissioning'])
  phase('ph-le-3', 'sp-line', 'Changeover reduction', f(180), f(300), 'Not started', 'Cut changeover time by 40% with SMED.', ['SMED playbook'])
  phase('ph-ls-1', 'sp-labor', 'Shift pattern redesign', f(30), f(90), 'Not started', 'Move from 3 fixed shifts to demand-based scheduling.', ['New shift model'])
  phase('ph-ls-2', 'sp-labor', 'Headcount realignment', f(90), f(150), 'Not started', 'Reduce temp labor and realign roles.', ['Headcount plan', 'Union consultation'])
  phase('ph-ls-3', 'sp-labor', 'Overtime controls', f(150), f(240), 'Not started', 'Put overtime approval controls in place.', ['Overtime policy'])
  phase('ph-pb-1', 'sp-pipe', 'Thesis and screening', d(110), d(80), 'Complete', 'Define the add-on thesis and screen the market.', ['Thesis memo', 'Long list'], d(80))
  phase('ph-pb-2', 'sp-pipe', 'Outreach to 25 targets', d(80), f(20), 'In progress', 'Reach out to owners and qualify targets.', ['Qualified pipeline'])
  phase('ph-pb-3', 'sp-pipe', 'Management meetings', f(20), f(90), 'Not started', 'Hold management meetings with the top 5.', ['Meeting notes'])
  phase('ph-fa-1', 'sp-addon', 'LOI on lead target', d(35), f(15), 'In progress', 'Sign an LOI with the lead target.', ['IC pre-approval', 'Signed LOI'])
  phase('ph-fa-2', 'sp-addon', 'Confirmatory diligence', f(15), f(75), 'Not started', 'Run QoE and commercial diligence.', ['QoE', 'Synergy case'])
  phase('ph-fa-3', 'sp-addon', 'Close and integration plan', f(75), f(150), 'Not started', 'Close and run the 100-day integration.', ['Integration plan'])
  phase('ph-fn-1', 'p-fin', 'Finance team build-out', d(112), f(20), 'In progress', 'Hire a corporate controller and FP&A lead; cut close to 6 days.', ['Controller hire', 'FP&A lead hire', '6-day close'])
  phase('ph-fn-2', 'p-fin', 'CFO succession plan', f(20), f(180), 'Not started', 'Run a CFO search and transition ahead of the exit process.', ['Search firm', 'Shortlist', 'Transition plan'])

  // KPIs
  kpi('k-dm', 'sp-dm', 'Direct materials cost, % of net sales', '%', 38.0, 35.5, [[105, 38.0], [75, 37.8], [45, 37.3], [15, 37.0], [2, 36.9]])
  kpi('k-pk', 'sp-pack', 'Freight cost per case', '$', 2.1, 1.85, [[100, 2.1], [70, 2.08], [40, 2.03], [10, 1.99]])
  kpi('k-cl', 'sp-club', 'Club doors live', 'doors', 0, 1200, [[63, 0], [35, 400], [10, 400]])
  kpi('k-ec', 'sp-ecom', 'E-commerce net sales, monthly', '$M', 0.6, 1.5, [[90, 0.6], [60, 0.62], [30, 0.7], [5, 0.84]])
  kpi('k-lp', 'sp-list', 'Net price realization', '%', 0, 4.0, [[84, 0], [49, 1.1], [20, 1.6], [5, 1.8]])
  kpi('k-pm', 'sp-mix', 'Premium SKU share of sales', '%', 18, 26, [[90, 18.0], [30, 18.4]])
  kpi('k-le', 'sp-line', 'OEE, all lines', '%', 61, 72, [[60, 61], [20, 61.5]])
  kpi('k-ls', 'sp-labor', 'Overtime, % of hours', '%', 14, 8, [[60, 14], [20, 14.5]])
  kpi('k-pb', 'sp-pipe', 'Qualified add-on targets', 'targets', 0, 25, [[90, 8], [60, 12], [30, 15], [6, 19]])
  kpi('k-fn', 'p-fin', 'Monthly close, business days', 'days', 12, 6, [[56, 12], [25, 10], [3, 9]])

  // Plan lock (VCP v1), 16 weeks ago
  vcpVersions.push({
    id: 'v-fernhill-1', companyId: F, version: 1, changeNote: 'Initial value creation plan from IC case.',
    approverIds: ['u-alex', 'u-priya', 'u-jordan', 'u-casey', 'u-morgan'],
    signOffs: [
      { userId: 'u-priya', at: d(113) }, { userId: 'u-casey', at: d(113) },
      { userId: 'u-jordan', at: d(112) }, { userId: 'u-morgan', at: d(112) }, { userId: 'u-alex', at: d(112) },
    ],
    alignmentRequestedAt: d(114), lockedAt: d(112), createdAt: d(118),
  })
  act({ companyId: F, actorId: 'u-alex', action: 'locked VCP v1', objectType: 'vcp', objectId: 'v-fernhill-1', at: d(112) })

  documents.push(
    { id: 'doc-f-1', companyId: F, type: 'IC deck', name: 'Fernhill IC Memo.pdf', size: 1_840_000, uploadedBy: 'u-sam', date: d(120) },
    { id: 'doc-f-2', companyId: F, type: 'Model', name: 'Fernhill Model Summary.xlsx', size: 412_000, uploadedBy: 'u-sam', date: d(120) },
    { id: 'doc-f-3', companyId: F, type: 'QoE', name: 'Fernhill QoE Report.pdf', size: 2_950_000, uploadedBy: 'u-priya', date: d(120) },
    { id: 'doc-f-4', companyId: F, type: 'Diligence report', name: 'Commercial and Operational Diligence.pdf', size: 4_100_000, uploadedBy: 'u-priya', date: d(120) },
  )

  // 16 weeks of updates
  upd(112, 'u-alex', 'p-fin', 'Kicked off the corporate controller search with two firms. Finance team build-out is phase 1 of the transition plan.', { status: ['Not started', 'On track'] })
  upd(108, 'u-casey', 'sp-dm', 'Spend cube complete across 1,400 SKUs; the top 20 SKUs are 62% of direct materials spend.', { visibility: 'shared', status: ['Not started', 'On track'], attachments: ['Spend_cube_v1.xlsx'] })
  pillarStatus(108, 'u-jordan', 'p-proc', 'Not started', 'On track')
  upd(101, 'u-morgan', 'sp-club', "Pitched Costco and Sam's Club buyers; second meetings set with both.", { visibility: 'shared', status: ['Not started', 'On track'] })
  pillarStatus(101, 'u-morgan', 'p-chan', 'Not started', 'On track')
  upd(95, 'u-jordan', 'sp-pack', 'Freight RFP issued to 9 carriers; packaging spec rationalization under way.', { visibility: 'shared', status: ['Not started', 'On track'] })
  upd(90, 'u-priya', 'sp-pipe', 'Screened 140 regional snack brands; 8 qualified targets in the pipeline.', { status: ['Not started', 'On track'] })
  pillarStatus(90, 'u-priya', 'p-mna', 'Not started', 'On track')
  upd(84, 'u-morgan', 'sp-list', 'Elasticity study done: a 4% list increase holds volume on 70% of SKUs.', {
    visibility: 'shared', status: ['Not started', 'On track'], phaseId: 'ph-lp-1',
    phaseDone: { done: 'Elasticity model by SKU and customer.', next: 'Send price letters to the top 15 customers.' },
  })
  pillarStatus(84, 'u-morgan', 'p-price', 'Not started', 'On track')
  upd(78, 'u-casey', 'sp-dm', 'First 6 SKUs re-bid with incumbent suppliers; savings tracking ahead of plan.', { captured: [0, 0.5] })
  upd(70, 'u-jordan', 'sp-pack', 'Spend baseline complete: $31M of addressable packaging and freight spend.', {
    visibility: 'shared', phaseId: 'ph-pk-1',
    phaseDone: { done: 'Baseline by lane and packaging spec.', next: 'Award the freight RFP.' },
  })
  upd(63, 'u-morgan', 'sp-club', "Sam's Club approved 2 SKUs for a 400-door regional test starting next month.", {
    visibility: 'shared', phaseId: 'ph-cl-1',
    phaseDone: { done: 'Club pack approved; 400-door test slotted.', next: 'Launch the regional test.' },
  })
  upd(56, 'u-alex', 'p-fin', 'Corporate controller hired, starts in two weeks. Close process mapped: 12 business days today.')
  upd(49, 'u-morgan', 'sp-list', 'Price increase letters sent to the top 15 customers; 9 have accepted.', { visibility: 'shared', captured: [0, 0.4] })
  upd(42, 'u-casey', 'sp-dm', '12 of the top 20 SKUs re-bid. Run-rate savings now $1.2M.', { visibility: 'shared', captured: [0.5, 1.2], attachments: ['Award_summary_round2.pdf'] })
  upd(38, 'u-morgan', 'sp-club', 'Regional club test live in 400 doors; sell-through running 15% above plan.', { visibility: 'shared', captured: [0, 0.8] })
  upd(31, 'u-priya', 'sp-addon', 'Management meeting held with the lead target, a regional kettle chip brand; LOI drafting.', { status: ['Not started', 'On track'] })
  upd(27, 'u-morgan', 'sp-list', 'Two largest grocery customers pushing back on the increase; realization may slip a quarter.', { status: ['On track', 'At risk'] })
  pillarStatus(27, 'u-morgan', 'p-price', 'On track', 'At risk')
  upd(19, 'u-jordan', 'sp-line', 'OEE baseline study scheduled with plant leadership; line 3 retrofit quote received.')
  upd(12, 'u-morgan', 'sp-ecom', 'Amazon storefront relaunched with new content; conversion up 22% in the first two weeks.', {
    visibility: 'shared', status: ['Not started', 'On track'], phaseId: 'ph-ec-1',
    phaseDone: { done: 'New content, pricing, and ad plan live.', next: 'Build the DTC subscription offer.' },
  })
  upd(10, 'u-morgan', 'sp-club', 'Club test extended to 650 doors on sell-through; run-rate contribution now $1.1M.', { visibility: 'shared', captured: [0.8, 1.1] })
  upd(9, 'u-casey', 'sp-dm', 'Final 8 SKUs in last-round bids. One supplier is asking for a 3-year volume commitment; raised with the deal team.')
  upd(6, 'u-priya', 'sp-pipe', 'Pipeline at 19 qualified targets; 3 in active dialogue.')
  upd(3, 'u-alex', 'p-fin', 'Controller onboarded; close down to 9 business days. CFO succession discussion set for next month.')

  // KPI and phase activity so feeds and the Progress view can see them
  for (const k of kpis.filter((x) => x.companyId === F)) {
    k.actuals.slice(1).forEach((a, i) =>
      act({ companyId: F, actorId: subPillars.find((s) => s.id === k.subPillarId)?.ownerIds[0] ?? 'u-alex', action: 'logged KPI actual', objectType: 'kpi', objectId: k.id, field: 'actual', oldValue: k.actuals[i].value, newValue: a.value, at: a.date }),
    )
  }

  // Asks
  const hist = (...events: [Ask['status'], number, string, string?][]) =>
    events.map(([status, ago, by, note]) => ({ status, at: d(ago), by, note }))

  asks.push({
    id: 'ask-f-1', companyId: F, type: 'data_request', title: 'Carrier invoices by lane, last 12 months',
    pillarId: 'p-proc', subPillarId: 'sp-pack', createdBy: 'u-jordan', assigneeIds: ['u-sam'], urgency: 'Standard',
    dueDate: d(91), status: 'Closed', flaggedToMd: false, createdAt: d(98), closedAt: d(89),
    description: 'Need full carrier invoice detail by lane for the freight RFP baseline. Want to see whether the current 3PL is padding accessorials before we tell them they are losing the business.',
    mgmtTitle: 'Carrier invoices by lane, last 12 months',
    mgmtDescription: 'Please send all carrier invoices for the last 12 months with lane, weight, and accessorial charges, in Excel, by next Friday.',
    mgmtApprovedBy: 'u-sam', mgmtAssigneeId: 'u-taylor',
    attachments: [
      att('att-f1-raw', 'Carrier_invoices_FY26.xlsx', 2_300_000, 'u-taylor', 93, 'raw'),
      att('att-f1-final', 'Freight_baseline_clean.xlsx', 640_000, 'u-sam', 91, 'final'),
    ],
    history: hist(['New', 98, 'u-jordan'], ['In progress', 97, 'u-sam'], ['Sent to management', 97, 'u-sam'], ['Data received', 93, 'u-taylor'], ['Delivered', 91, 'u-sam'], ['Closed', 89, 'u-jordan']),
  })
  asks.push({
    id: 'ask-f-2', companyId: F, type: 'data_request', title: 'Customer price/volume by SKU, top 15 customers',
    pillarId: 'p-price', subPillarId: 'sp-list', createdBy: 'u-morgan', assigneeIds: ['u-sam'], urgency: 'High',
    dueDate: d(2), status: 'Sent to management', flaggedToMd: false, createdAt: d(5),
    description: 'Need price/volume by SKU for the top 15 customers, FY24 to date, to show the two grocery holdouts what the increase does to their mix. Also tells us whether to concede promo spend.',
    mgmtTitle: 'Price and volume by SKU for top 15 customers',
    mgmtDescription: 'Please send monthly net price and volume by SKU for your top 15 customers, January 2024 to date, in Excel.',
    mgmtApprovedBy: 'u-sam', mgmtAssigneeId: 'u-taylor', attachments: [],
    history: hist(['New', 5, 'u-morgan'], ['In progress', 5, 'u-sam'], ['Sent to management', 4, 'u-sam']),
  })
  asks.push({
    id: 'ask-f-3', companyId: F, type: 'data_request', title: 'Top-10 supplier contract terms',
    pillarId: 'p-proc', subPillarId: 'sp-dm', createdBy: 'u-casey', assigneeIds: ['u-sam'], urgency: 'Standard',
    dueDate: f(1), status: 'Data received', flaggedToMd: false, createdAt: d(6),
    description: 'Need payment terms, volume commitments, and termination clauses for the top 10 suppliers before final-round bids. One supplier is pushing a 3-year commitment and I want to know our exit options.',
    mgmtTitle: 'Contracts for top 10 direct materials suppliers',
    mgmtDescription: 'Please send the current contracts for your top 10 direct materials suppliers, including payment terms, volume commitments, and termination clauses, as PDFs.',
    mgmtApprovedBy: 'u-sam', mgmtAssigneeId: 'u-taylor',
    attachments: [att('att-f3-raw', 'Supplier_contracts_top10.pdf', 5_800_000, 'u-taylor', 1, 'raw')],
    history: hist(['New', 6, 'u-casey'], ['In progress', 6, 'u-sam'], ['Sent to management', 5, 'u-sam'], ['Data received', 1, 'u-taylor']),
  })
  asks.push({
    id: 'ask-f-4', companyId: F, type: 'data_request', title: 'Line-level OEE and downtime logs, last 6 months',
    pillarId: 'p-plant', subPillarId: 'sp-line', createdBy: 'u-jordan', assigneeIds: ['u-sam'], urgency: 'Standard',
    dueDate: f(6), status: 'New', flaggedToMd: false, createdAt: d(1),
    description: "Need line-level OEE and downtime logs to baseline line 3 before the retrofit decision. The plant manager's numbers don't tie to finance's.",
    attachments: [], history: hist(['New', 1, 'u-jordan']),
  })
  asks.push({
    id: 'ask-f-5', companyId: F, type: 'question', title: 'Hold the price increase with the two grocery holdouts, or trade promo spend?',
    pillarId: 'p-price', subPillarId: 'sp-list', createdBy: 'u-morgan', assigneeIds: ['u-sam'], urgency: 'High',
    dueDate: f(1), status: 'Open', flaggedToMd: true, flaggedBy: 'u-sam', flaggedAt: d(4),
    flagNote: 'Needs your call: this decides about $1.2M of the $3.0M list price target.', createdAt: d(5),
    context: 'Both customers will accept the 4% increase if we fund a 2% promo-spend offset. Holding firm risks delisting 6 SKUs; conceding drops realization from 4.0% to about 3.1%.',
    attachments: [], history: hist(['Open', 5, 'u-morgan']),
  })
  asks.push({
    id: 'ask-f-6', companyId: F, type: 'question', title: 'Can we sign a 3-year volume commitment with our largest flour supplier?',
    pillarId: 'p-proc', subPillarId: 'sp-dm', createdBy: 'u-casey', assigneeIds: ['u-sam'], urgency: 'High',
    dueDate: f(2), status: 'Open', flaggedToMd: false, createdAt: d(1),
    context: 'They will take another 4% off for a 3-year volume floor. That could conflict with add-on integration volumes if we buy the kettle chip brand.',
    attachments: [], history: hist(['Open', 1, 'u-casey']),
  })
  asks.push({
    id: 'ask-f-7', companyId: F, type: 'question', title: 'Is the line 3 retrofit capex in the 100-day budget?',
    pillarId: 'p-plant', subPillarId: 'sp-line', createdBy: 'u-jordan', assigneeIds: ['u-priya'], urgency: 'Standard',
    dueDate: d(33), status: 'Answered', flaggedToMd: false, createdAt: d(40),
    context: 'Retrofit quote came in at $1.6M.', answer: 'Yes. $1.8M is in the 100-day capex plan; anything above that needs IC approval.', answeredBy: 'u-priya',
    attachments: [], history: hist(['Open', 40, 'u-jordan'], ['Answered', 38, 'u-priya']),
  })
  for (const a of asks.filter((x) => x.companyId === F))
    for (const h of a.history)
      act({ companyId: F, actorId: h.by, action: h === a.history[0] ? 'created' : `moved to ${h.status}`, objectType: 'ask', objectId: a.id, field: 'status', newValue: h.status, at: h.at })
  act({ companyId: F, actorId: 'u-sam', action: 'flagged to MD', objectType: 'ask', objectId: 'ask-f-5', at: d(4) })

  comments.push(
    { id: 'cm-f-1', companyId: F, parentType: 'pillar', parentId: 'p-proc', authorId: 'u-taylor', visibility: 'shared', createdAt: d(60), text: 'Finance can support savings tracking. We will add a monthly PPV report starting next close.' },
    { id: 'cm-f-2', companyId: F, parentType: 'pillar', parentId: 'p-price', authorId: 'u-priya', visibility: 'internal', createdAt: d(25), text: "Let's discuss the grocery pushback at Monday's deal team meeting before Morgan goes back to them." },
    { id: 'cm-f-3', companyId: F, parentType: 'ask', parentId: 'ask-f-2', authorId: 'u-sam', visibility: 'shared', createdAt: d(4), text: 'Taylor, Excel is fine as is, no need to format it.' },
    { id: 'cm-f-4', companyId: F, parentType: 'ask', parentId: 'ask-f-2', authorId: 'u-sam', visibility: 'internal', createdAt: d(4), text: 'Rewrote it to drop the promo-spend context.' },
    { id: 'cm-f-5', companyId: F, parentType: 'subPillar', parentId: 'sp-club', authorId: 'u-chris', visibility: 'shared', createdAt: d(30), text: 'Great early sell-through. Our sales team is ready to support the national rollout.' },
    { id: 'cm-f-6', companyId: F, parentType: 'subPillar', parentId: 'sp-labor', authorId: 'u-alex', visibility: 'internal', createdAt: d(50), text: 'Hold until the new controller is in seat; we need clean labor cost data first.' },
  )

  // ---------------------------------------------------------------------
  // Kestrel Dental Partners (lighter)
  // ---------------------------------------------------------------------
  const K = 'c-kestrel'
  const kStart = d(400)
  pillar({ id: 'p-k-denovo', companyId: K, name: 'De novo clinic openings', status: 'On track', visibility: 'shared', ownerIds: ['u-jordan'],
    targetImpact: 6.0, capturedImpact: 2.1, startDate: kStart, objective: 'Open 18 de novo clinics in existing metros.' })
  pillar({ id: 'p-k-payer', companyId: K, name: 'Payer contract renegotiation', status: 'On track', visibility: 'shared', ownerIds: ['u-riley'],
    targetImpact: 4.0, capturedImpact: 2.6, startDate: kStart, objective: 'Renegotiate the top 8 PPO contracts.' })
  pillar({ id: 'p-k-addon', companyId: K, name: 'Add-on practice acquisitions', status: 'On track', visibility: 'firm', ownerIds: ['u-priya'],
    targetImpact: 5.0, capturedImpact: 1.5, startDate: d(300), objective: 'Acquire 12 affiliated practices.' })
  pillar({ id: 'p-k-rcm', companyId: K, name: 'Revenue cycle management', status: 'At risk', visibility: 'shared', ownerIds: ['u-riley'],
    targetImpact: 1.0, capturedImpact: 0.2, startDate: kStart, objective: 'Cut days sales outstanding from 48 to 32.' })
  phase('ph-k-1', 'p-k-denovo', 'First 8 clinics', d(400), d(60), 'Complete', 'Open the first 8 clinics.', [], d(60))
  phase('ph-k-2', 'p-k-denovo', 'Next 10 clinics', d(60), f(300), 'In progress', 'Open 10 more clinics.', [])
  phase('ph-k-3', 'p-k-payer', 'Top 8 PPO renegotiations', d(380), f(60), 'In progress', '', [])
  phase('ph-k-4', 'p-k-addon', 'Affiliations 1 to 6', d(350), d(20), 'Complete', '', [], d(20))
  phase('ph-k-5', 'p-k-addon', 'Affiliations 7 to 12', d(20), f(360), 'In progress', '', [])
  phase('ph-k-6', 'p-k-rcm', 'Central billing office', d(200), f(90), 'In progress', '', [])
  upd(40, 'u-jordan', 'p-k-denovo', 'Clinic 8 opened in Raleigh; ramping ahead of the de novo curve.', { visibility: 'shared', captured: [1.8, 2.1] })
  upd(20, 'u-priya', 'p-k-addon', 'Sixth affiliation closed; integration on standard playbook.', { captured: [1.1, 1.5] })
  upd(16, 'u-riley', 'p-k-rcm', 'Central billing office cutover slipped; DSO flat at 47.', { status: ['On track', 'At risk'] })
  upd(5, 'u-riley', 'p-k-payer', 'Delta Dental renewal signed at +6%.', { visibility: 'shared', captured: [2.2, 2.6] })
  vcpVersions.push({ id: 'v-kestrel-1', companyId: K, version: 1, changeNote: 'Initial plan.', approverIds: ['u-dana', 'u-priya', 'u-jordan', 'u-riley'],
    signOffs: ['u-dana', 'u-priya', 'u-jordan', 'u-riley'].map((userId) => ({ userId, at: d(410) })), lockedAt: d(410), createdAt: d(420) })
  asks.push({
    id: 'ask-k-1', companyId: K, type: 'data_request', title: 'Clinic-level DSO by payer', pillarId: 'p-k-rcm', subPillarId: null,
    createdBy: 'u-riley', assigneeIds: ['u-sam'], urgency: 'High', dueDate: f(2), status: 'In progress', flaggedToMd: false, createdAt: d(1),
    description: 'Need DSO by clinic and payer to see where the billing cutover is stuck.', attachments: [],
    history: hist(['New', 1, 'u-riley'], ['In progress', 0, 'u-sam']),
  })

  // ---------------------------------------------------------------------
  // Northgate Industrial Supply (lighter)
  // ---------------------------------------------------------------------
  const N = 'c-northgate'
  const nStart = d(760)
  // Behind plan on purpose: two years in, only sourcing is where the plan said it would be.
  pillar({ id: 'p-n-source', companyId: N, name: 'Strategic sourcing', status: 'On track', visibility: 'shared', ownerIds: ['u-casey'],
    targetImpact: 7.0, capturedImpact: 4.8, startDate: nStart, targetDate: f(330), objective: 'Consolidate the vendor base and re-bid the top 200 SKUs.' })
  pillar({ id: 'p-n-price', companyId: N, name: 'Pricing excellence', status: 'At risk', visibility: 'shared', ownerIds: ['u-ravi'],
    targetImpact: 8.0, capturedImpact: 5.1, startDate: nStart, targetDate: f(300), objective: 'Roll out price waterfall analytics and contract price discipline.' })
  pillar({ id: 'p-n-branch', companyId: N, name: 'Branch network optimization', status: 'Off track', visibility: 'firm', ownerIds: ['u-jordan'],
    targetImpact: 6.0, capturedImpact: 1.0, startDate: nStart, targetDate: f(200), objective: 'Consolidate 14 underperforming branches into hubs.' })
  pillar({ id: 'p-n-ecom', companyId: N, name: 'E-commerce platform', status: 'At risk', visibility: 'shared', ownerIds: ['u-jordan'],
    targetImpact: 4.0, capturedImpact: 1.2, startDate: nStart, targetDate: f(300), objective: 'Move 25% of orders onto a self-serve portal.' })
  phase('ph-n-1', 'p-n-source', 'Top 200 SKU re-bid', d(700), d(200), 'Complete', '', [], d(200))
  phase('ph-n-2', 'p-n-source', 'Vendor consolidation', d(200), f(150), 'In progress', '', [])
  phase('ph-n-3', 'p-n-price', 'Price waterfall rollout', d(600), f(60), 'In progress', '', [])
  phase('ph-n-4', 'p-n-branch', 'Hub consolidation wave 1', d(300), f(30), 'In progress', '', [])
  phase('ph-n-5', 'p-n-ecom', 'Portal launch', d(400), d(80), 'Complete', '', [], d(80))
  phase('ph-n-6', 'p-n-ecom', 'Customer migration', d(80), f(200), 'In progress', '', [])
  upd(30, 'u-casey', 'p-n-source', 'Fastener vendors consolidated from 11 to 3.', { visibility: 'shared', captured: [4.3, 4.8] })
  upd(22, 'u-jordan', 'p-n-branch', 'Wave 1 hub delayed by lease negotiation; two branch closures pushed to Q1.', { status: ['At risk', 'Off track'] })
  upd(11, 'u-ravi', 'p-n-price', 'Contract price compliance at 94%, up from 81%, but the waterfall rollout is a quarter behind in two regions.', { visibility: 'shared', captured: [4.6, 5.1], status: ['On track', 'At risk'] })
  upd(4, 'u-jordan', 'p-n-ecom', 'Portal adoption at 14% of orders; need a sales comp change to push it.', { visibility: 'shared' })
  vcpVersions.push({ id: 'v-northgate-1', companyId: N, version: 1, changeNote: 'Initial plan.', approverIds: ['u-alex', 'u-ravi', 'u-jordan', 'u-casey'],
    signOffs: ['u-alex', 'u-ravi', 'u-jordan', 'u-casey'].map((userId) => ({ userId, at: d(770) })), lockedAt: d(770), createdAt: d(780) })
  vcpVersions.push({ id: 'v-northgate-2', companyId: N, version: 2, changeNote: 'Added e-commerce platform after the portal pilot; trimmed branch target from 8.0 to 6.0.',
    approverIds: ['u-alex', 'u-ravi', 'u-jordan', 'u-casey'],
    signOffs: ['u-alex', 'u-ravi', 'u-jordan', 'u-casey'].map((userId) => ({ userId, at: d(410) })), lockedAt: d(410), createdAt: d(415) })
  asks.push({
    id: 'ask-n-1', companyId: N, type: 'data_request', title: 'Branch-level P&L, trailing 12 months', pillarId: 'p-n-branch', subPillarId: null,
    createdBy: 'u-jordan', assigneeIds: ['u-elena'], urgency: 'Critical', dueDate: d(1), status: 'In progress', flaggedToMd: false, createdAt: d(2),
    description: 'Need branch P&L to re-rank wave 2 closures.', attachments: [],
    history: hist(['New', 2, 'u-jordan'], ['In progress', 2, 'u-elena']),
  })
  asks.push({
    id: 'ask-n-2', companyId: N, type: 'data_request', title: 'Contract price compliance by customer, last 6 months', pillarId: 'p-n-price', subPillarId: null,
    createdBy: 'u-ravi', assigneeIds: ['u-elena'], urgency: 'High', dueDate: f(2), status: 'Sent to management', flaggedToMd: false, createdAt: d(3),
    description: 'Compliance is 94% overall; I want the customer-level view to find who is still buying off-contract before the board pre-read.',
    mgmtTitle: 'Contract price compliance by customer, last 6 months',
    mgmtDescription: 'Please send the monthly contract price compliance report by customer for the last 6 months, in Excel.',
    mgmtApprovedBy: 'u-elena', mgmtAssigneeId: 'u-lee', attachments: [],
    history: hist(['New', 3, 'u-ravi'], ['In progress', 3, 'u-elena'], ['Sent to management', 2, 'u-elena']),
  })
  asks.push({
    id: 'ask-n-3', companyId: N, type: 'question', title: 'Push the Q1 branch closures, or hold for the lease outcome?', pillarId: 'p-n-branch', subPillarId: null,
    createdBy: 'u-jordan', assigneeIds: ['u-ravi'], urgency: 'High', dueDate: f(1), status: 'Open', flaggedToMd: true, flaggedBy: 'u-ravi', flaggedAt: d(1),
    flagNote: 'Needs your call before the board pre-read. About $1.5M of the branch target rides on wave 2 timing.', createdAt: d(2),
    context: 'The landlord wants a 9-month extension on the two hub leases. Closing the branches first means double rent; waiting pushes $1.5M of savings into next year.',
    attachments: [], history: hist(['Open', 2, 'u-jordan']),
  })
  asks.push({
    id: 'ask-n-4', companyId: N, type: 'data_request', title: 'Portal order volume by customer segment', pillarId: 'p-n-ecom', subPillarId: null,
    createdBy: 'u-jordan', assigneeIds: ['u-elena'], urgency: 'Standard', dueDate: d(4), status: 'Delivered', flaggedToMd: false, createdAt: d(12),
    description: 'Which segments are actually using the portal? Need it to size the sales comp change.',
    mgmtTitle: 'Portal order volume by customer segment', mgmtDescription: 'Please send monthly portal orders by customer segment since launch.',
    mgmtApprovedBy: 'u-elena', mgmtAssigneeId: 'u-lee',
    attachments: [att('att-n4-raw', 'Portal_orders_by_segment.xlsx', 410_000, 'u-lee', 7, 'raw'), att('att-n4-final', 'Portal_adoption_by_segment_clean.xlsx', 220_000, 'u-elena', 5, 'final')],
    history: hist(['New', 12, 'u-jordan'], ['In progress', 11, 'u-elena'], ['Sent to management', 11, 'u-elena'], ['Data received', 7, 'u-lee'], ['Delivered', 5, 'u-elena']),
  })
  asks.push({
    id: 'ask-n-5', companyId: N, type: 'data_request', title: 'Vendor rebate agreements, top 20 vendors', pillarId: 'p-n-source', subPillarId: null,
    createdBy: 'u-casey', assigneeIds: ['u-elena'], urgency: 'Standard', dueDate: d(33), status: 'Closed', flaggedToMd: false, createdAt: d(40), closedAt: d(30),
    description: 'Needed for the fastener consolidation; rebates decide whether 3 vendors or 2.',
    mgmtTitle: 'Vendor rebate agreements, top 20 vendors', mgmtDescription: 'Please share the current rebate agreements for the top 20 vendors.',
    mgmtApprovedBy: 'u-elena', mgmtAssigneeId: 'u-lee',
    attachments: [att('att-n5-raw', 'Rebate_agreements_top20.pdf', 3_100_000, 'u-lee', 35, 'raw'), att('att-n5-final', 'Rebate_summary.xlsx', 150_000, 'u-elena', 33, 'final')],
    history: hist(['New', 40, 'u-casey'], ['In progress', 39, 'u-elena'], ['Sent to management', 39, 'u-elena'], ['Data received', 35, 'u-lee'], ['Delivered', 33, 'u-elena'], ['Closed', 30, 'u-casey']),
  })
  for (const a of asks.filter((x) => x.companyId === N))
    for (const h of a.history)
      act({ companyId: N, actorId: h.by, action: h === a.history[0] ? 'created' : `moved to ${h.status}`, objectType: 'ask', objectId: a.id, field: 'status', newValue: h.status, at: h.at })
  act({ companyId: N, actorId: 'u-ravi', action: 'flagged to MD', objectType: 'ask', objectId: 'ask-n-3', at: d(1) })

  // ---------- Derived fields ----------
  for (const p of pillars) {
    const times = updates.filter((u) => u.pillarId === p.id).map((u) => u.createdAt)
    if (times.length) p.lastUpdated = times.sort().at(-1)!
  }
  for (const s of subPillars) {
    const times = updates.filter((u) => u.subPillarId === s.id).map((u) => u.createdAt)
    if (times.length) s.lastUpdated = times.sort().at(-1)!
  }

  return {
    seedVersion: SEED_VERSION,
    users,
    companies,
    memberships,
    documents,
    vcpVersions,
    pillars,
    subPillars,
    phases,
    kpis,
    updates,
    asks,
    comments,
    activity,
    commentary: [],
    settings: Object.fromEntries(companies.map((c) => [c.id, structuredClone(DEFAULT_SETTINGS)])),
    visits: { 'u-alex:c-fernhill': d(7) },
    fileTags: {},
  }
}
