// The one permission function (SPEC.md section 4).
//
// Every page reads company data only through scopeFor(). It checks company
// membership first and visibility second, and returns a view that is already
// filtered and rewritten for the viewer. Management views carry no trace of
// Firm only items: no placeholders, no counts, no numbering gaps, and pillar
// totals that only include sub-pillars they can see.

import type {
  Activity,
  Ask,
  Comment,
  Commentary,
  Company,
  DB,
  Document,
  KPI,
  Membership,
  Phase,
  Pillar,
  Role,
  Settings,
  SubPillar,
  Update,
  User,
  VCPVersion,
  WorkstreamRef,
} from './types'
import { DEAL_TEAM_ROLES } from './types'

export interface PillarView extends Pillar {
  num: number
  target: number
  captured: number
  /** What the plan says should be captured by today (sum of sub-pillars, or the pillar's own ramp). */
  planToDate: number
  hasSubs: boolean
}

export interface SubPillarView extends SubPillar {
  num: string
  planToDate: number
}

/**
 * Plan to date: a straight-line ramp from the item's start date (when run-rate savings begin to land)
 * to its target date (full run-rate). Zero before the start, the full target after the target date.
 */
export function planToDate(item: { startDate: string; targetDate: string; targetImpact: number }, now = Date.now()): number {
  const start = new Date(item.startDate).getTime()
  const end = new Date(item.targetDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || item.targetImpact <= 0) return 0
  if (now <= start) return 0
  if (now >= end || end <= start) return item.targetImpact
  return Math.round(item.targetImpact * ((now - start) / (end - start)) * 100) / 100
}

/** Captured is "on plan" when it is at or above plan to date (with a $50k rounding allowance). */
export function onPlan(captured: number, plan: number): boolean {
  return captured + 0.05 >= plan
}

export interface Member {
  user: User
  role: Role
}

export interface Viewer {
  user: User
  role: Role
  isFirm: boolean
  isMgmt: boolean
  canEditPlan: boolean
  canTriageAsks: boolean
  canReassign: boolean
  canPostUpdates: boolean
}

export interface View {
  viewer: Viewer
  company: Company
  members: Member[]
  pillars: PillarView[]
  subPillars: SubPillarView[]
  phases: Phase[]
  kpis: KPI[]
  updates: Update[]
  /**
   * Updates posted on plan items that have since been retired or removed (and so are no longer in
   * `updates`). Firm only, so the Files tab keeps listing their attachments; nothing else reads them.
   */
  retiredUpdates: Update[]
  asks: Ask[]
  comments: Comment[]
  activity: Activity[]
  documents: Document[]
  vcpVersions: VCPVersion[]
  commentary: Commentary[]
  settings: Settings
  /** Workstream overrides on attachments, limited to plan items this viewer can see. */
  fileTags: Record<string, WorkstreamRef>
}

/** Data requests reach management only once the deal team routes them. */
const MGMT_ASK_STATUSES = new Set(['Sent to management', 'Data received', 'Delivered', 'Closed'])

export function roleOf(db: DB, userId: string, companyId: string): Role | null {
  return db.memberships.find((m) => m.userId === userId && m.companyId === companyId)?.role ?? null
}

/** Companies this user holds a membership in (their deal folders). */
export function companiesFor(db: DB, userId: string): Company[] {
  const ids = new Set(db.memberships.filter((m) => m.userId === userId).map((m) => m.companyId))
  return db.companies.filter((c) => ids.has(c.id))
}

function makeViewer(user: User, role: Role): Viewer {
  const isMgmt = role === 'Management'
  return {
    user,
    role,
    isFirm: !isMgmt,
    isMgmt,
    canEditPlan: DEAL_TEAM_ROLES.includes(role),
    canTriageAsks: DEAL_TEAM_ROLES.includes(role),
    canReassign: role === 'VP' || role === 'Principal' || role === 'MD',
    canPostUpdates: !isMgmt,
  }
}

/**
 * `asManagement` lets a firm member preview exactly what management would see
 * (used for the board supplement, which goes into the deck management builds).
 */
export function scopeFor(db: DB, userId: string, companyId: string, opts: { asManagement?: boolean } = {}): View | null {
  // 1. Membership.
  const user = db.users.find((u) => u.id === userId)
  const company = db.companies.find((c) => c.id === companyId)
  const memberRole = roleOf(db, userId, companyId)
  if (!user || !company || !memberRole) return null
  const role: Role = opts.asManagement ? 'Management' : memberRole
  const viewer = makeViewer(user, role)

  const inCo = <T extends { companyId: string }>(xs: T[]) => xs.filter((x) => x.companyId === companyId)
  const allPillars = inCo(db.pillars).filter((p) => !p.retiredAt)
  const allSubs = inCo(db.subPillars).filter((s) => allPillars.some((p) => p.id === s.pillarId))

  // 2. Visibility.
  const mgmt = viewer.isMgmt
  const pillarIds = new Set(allPillars.filter((p) => !mgmt || p.visibility === 'shared').map((p) => p.id))
  const subIds = new Set(
    allSubs.filter((s) => pillarIds.has(s.pillarId) && (!mgmt || s.visibility === 'shared')).map((s) => s.id),
  )
  /** Is the most specific plan item this object hangs off visible? */
  const planVisible = (pillarId: string | null, subPillarId: string | null) =>
    subPillarId ? subIds.has(subPillarId) : pillarId ? pillarIds.has(pillarId) : !mgmt

  const subPillarsRaw = allSubs.filter((s) => subIds.has(s.id))
  const pillars: PillarView[] = allPillars
    .filter((p) => pillarIds.has(p.id))
    .sort((a, b) => a.order - b.order)
    .map((p, i) => {
      // Totals roll up from the sub-pillars this viewer can see.
      const everySub = allSubs.filter((s) => s.pillarId === p.id)
      const subs = subPillarsRaw.filter((s) => s.pillarId === p.id)
      const hasSubs = everySub.length > 0
      return {
        ...p,
        // Rationale comes from the IC memo; it stays inside the firm.
        ...(mgmt ? { rationale: '', sourceRef: '' } : {}),
        num: i + 1,
        hasSubs: subs.length > 0,
        target: hasSubs ? sum(subs.map((s) => s.targetImpact)) : p.targetImpact,
        captured: hasSubs ? sum(subs.map((s) => s.capturedImpact)) : p.capturedImpact,
        planToDate: hasSubs ? sum(subs.map((s) => planToDate(s))) : planToDate(p),
      }
    })
  const subPillars: SubPillarView[] = pillars.flatMap((p) =>
    subPillarsRaw
      .filter((s) => s.pillarId === p.id)
      .sort((a, b) => a.order - b.order)
      .map((s, j) => ({ ...s, num: `${p.num}.${j + 1}`, planToDate: planToDate(s) })),
  )

  const phases = inCo(db.phases)
    .filter((ph) => planVisible(ph.pillarId, ph.subPillarId))
    .sort((a, b) => a.order - b.order)
  const phaseIds = new Set(phases.map((p) => p.id))
  const kpis = inCo(db.kpis).filter((k) => planVisible(k.pillarId, k.subPillarId))
  const kpiIds = new Set(kpis.map((k) => k.id))

  const byNewest = (a: Update, b: Update) => b.createdAt.localeCompare(a.createdAt)
  const updates = inCo(db.updates)
    .filter(
      (u) =>
        planVisible(u.pillarId, u.subPillarId) &&
        (!mgmt || (u.visibility === 'shared' && (!u.phaseId || phaseIds.has(u.phaseId)))),
    )
    .map((u) => (mgmt ? { ...u, flaggedToMd: false, flagNote: undefined } : u))
    .sort(byNewest)
  const updateIds = new Set(updates.map((u) => u.id))
  // For the firm, the only way an update fails planVisible is that its pillar or sub-pillar is gone
  // from the plan. Management never sees these: a retired item is no longer part of the plan it is shown.
  const retiredUpdates = mgmt ? [] : inCo(db.updates).filter((u) => !planVisible(u.pillarId, u.subPillarId)).sort(byNewest)

  const asks = inCo(db.asks)
    .filter((a) => !mgmt || (a.type === 'data_request' && !!a.mgmtAssigneeId && MGMT_ASK_STATUSES.has(a.status)))
    .map((a) => (mgmt ? managementVersion(a, planVisible) : a))
  const askIds = new Set(asks.map((a) => a.id))

  const comments = inCo(db.comments).filter((c) => {
    if (mgmt && c.visibility !== 'shared') return false
    switch (c.parentType) {
      case 'pillar':
        return pillarIds.has(c.parentId)
      case 'subPillar':
        return subIds.has(c.parentId)
      case 'update':
        return updateIds.has(c.parentId)
      case 'ask':
        return askIds.has(c.parentId)
    }
  })
  const commentIds = new Set(comments.map((c) => c.id))

  const activity = inCo(db.activity)
    .filter((a) => {
      switch (a.objectType) {
        case 'pillar':
          return pillarIds.has(a.objectId)
        case 'subPillar':
          return subIds.has(a.objectId)
        case 'phase':
          return phaseIds.has(a.objectId)
        case 'kpi':
          return kpiIds.has(a.objectId)
        case 'update':
          return updateIds.has(a.objectId)
        case 'comment':
          return commentIds.has(a.objectId)
        case 'ask':
          return askIds.has(a.objectId) && (!mgmt || (a.field === 'status' && MGMT_ASK_STATUSES.has(String(a.newValue))))
        case 'vcp':
        case 'document':
          return !mgmt
      }
    })
    .sort((a, b) => b.at.localeCompare(a.at))

  const members: Member[] = db.memberships
    .filter((m: Membership) => m.companyId === companyId)
    .map((m) => ({ user: db.users.find((u) => u.id === m.userId)!, role: m.role }))
    .filter((m) => m.user)

  return {
    viewer,
    company,
    members,
    pillars,
    subPillars,
    phases,
    kpis,
    updates,
    retiredUpdates,
    asks,
    comments,
    activity,
    documents: mgmt ? [] : inCo(db.documents),
    vcpVersions: inCo(db.vcpVersions)
      .sort((a, b) => a.version - b.version)
      .map((v) => (mgmt ? { ...v, changeNote: '', approverIds: [], signOffs: [] } : v)),
    commentary: mgmt ? [] : inCo(db.commentary),
    settings: db.settings[companyId],
    fileTags: Object.fromEntries(
      Object.entries(db.fileTags ?? {}).filter(([, t]) => planVisible(t.pillarId, t.subPillarId)),
    ),
  }
}

/** What management sees of a routed data request: the approved rewrite only. */
function managementVersion(a: Ask, planVisible: (p: string | null, s: string | null) => boolean): Ask {
  const linkVisible = planVisible(a.pillarId, a.subPillarId)
  const pillarVisible = planVisible(a.pillarId, null)
  return {
    ...a,
    title: a.mgmtTitle ?? '',
    description: a.mgmtDescription ?? '',
    mgmtTitle: undefined,
    mgmtDescription: undefined,
    context: undefined,
    createdBy: a.mgmtApprovedBy ?? a.assigneeIds[0],
    pillarId: linkVisible || pillarVisible ? a.pillarId : null,
    subPillarId: linkVisible ? a.subPillarId : null,
    flaggedToMd: false,
    flagNote: undefined,
    flaggedBy: undefined,
    // Management sees what it uploaded and the context the deal team chose to share; never the cleaned final files.
    attachments: a.attachments.filter((x) => x.stage === 'raw' || x.stage === 'context'),
    history: a.history.filter((h) => MGMT_ASK_STATUSES.has(h.status)).map((h) => ({ ...h, note: undefined })),
  }
}

export function sum(xs: number[]): number {
  return Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100
}
