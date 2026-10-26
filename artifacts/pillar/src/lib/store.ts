// App state: the demo database (persisted in the browser) plus the View as session.
// Every write goes through an action here, and each action checks the actor's
// role in that company before changing anything.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Activity,
  Ask,
  AskStatus,
  Attachment,
  Comment,
  CommentParent,
  DB,
  DocType,
  KPI,
  Phase,
  Pillar,
  PlanStatus,
  PostVisibility,
  Role,
  Settings,
  SubPillar,
  Update,
  Urgency,
  Visibility,
  WorkstreamRef,
} from './types'
import { DEAL_TEAM_ROLES } from './types'
import { SEED_VERSION, buildSeed, uid, DEFAULT_SETTINGS, applyDemoOrganicDefaults } from './seed'
import { canUpgrade, dropDanglingWorkstreamRefs, dropWorkstreamRefs, upgradeDb } from './migrate'
import { roleOf } from './permissions'
import { addHours, nowIso } from './dates'
import { clearFiles, isRealFile, saveFile, type UploadInput } from './files'

export interface NewUpdate {
  companyId: string
  pillarId: string
  subPillarId: string | null
  phaseId: string | null
  text: string
  status?: PlanStatus
  captured?: number
  completePhase?: { done: string; next: string }
  attachments: UploadInput[]
  visibility: PostVisibility
}

export interface NewAsk {
  companyId: string
  type: Ask['type']
  title: string
  pillarId: string | null
  subPillarId: string | null
  urgency: Urgency
  dueDate: string
  description?: string
  context?: string
}

export interface GeneratedPlan {
  pillars: (Omit<Pillar, 'id' | 'companyId' | 'order' | 'lastUpdated' | 'capturedImpact'> & {
    subPillars: (Omit<SubPillar, 'id' | 'companyId' | 'pillarId' | 'order' | 'lastUpdated' | 'capturedImpact'> & {
      phases: Omit<Phase, 'id' | 'companyId' | 'pillarId' | 'subPillarId' | 'order'>[]
      kpis: Omit<KPI, 'id' | 'companyId' | 'pillarId' | 'subPillarId'>[]
    })[]
    phases: Omit<Phase, 'id' | 'companyId' | 'pillarId' | 'subPillarId' | 'order'>[]
    kpis: Omit<KPI, 'id' | 'companyId' | 'pillarId' | 'subPillarId'>[]
  })[]
}

export interface NewCompany {
  name: string
  sector: string
  closeDate: string
  holdYears: number
  entryEbitda: number
  exitEbitda: number
  people: { userId?: string; name?: string; email?: string; title?: string; role: Role }[]
  documents: { name: string; size: number; type: DocType }[]
  plan: GeneratedPlan
  aiNote: string
}

interface State {
  db: DB
  userId: string
  companyId: string
  toast: string | null

  setUser: (userId: string) => void
  setCompany: (companyId: string) => void
  resetDemo: () => void
  showToast: (msg: string) => void

  // Plan
  saveOrganicEbitda: (companyId: string, target: number, realized: number) => boolean
  updatePillar: (id: string, patch: Partial<Pillar>) => void
  updateSubPillar: (id: string, patch: Partial<SubPillar>) => void
  updatePhase: (id: string, patch: Partial<Phase>) => void
  setPlanStatus: (kind: 'pillar' | 'subPillar', id: string, status: PlanStatus) => void
  setVisibility: (kind: 'pillar' | 'subPillar', id: string, v: Visibility) => void
  addPillar: (companyId: string) => string | undefined
  addSubPillar: (pillarId: string) => string | undefined
  addPhase: (pillarId: string, subPillarId: string | null) => void
  deletePillar: (id: string) => void
  deleteSubPillar: (id: string) => void
  deletePhase: (id: string) => void
  reorderPillars: (companyId: string, orderedIds: string[]) => void
  reorderSubPillars: (pillarId: string, orderedIds: string[]) => void
  replacePillarFromAi: (pillarId: string, plan: GeneratedPlan['pillars'][number]) => void
  replaceSubPillarFromAi: (subPillarId: string, sp: GeneratedPlan['pillars'][number]['subPillars'][number]) => void
  addKpiActual: (kpiId: string, value: number) => void

  // Alignment
  requestAlignment: (companyId: string) => void
  signOff: (versionId: string) => void
  startRevision: (companyId: string, note: string) => void

  // Updates
  postUpdate: (u: NewUpdate) => void
  confirmNoChange: (pillarId: string) => void

  // Asks
  createAsk: (a: NewAsk) => string | undefined
  patchAsk: (id: string, patch: Partial<Ask>) => void
  transitionAsk: (id: string, status: AskStatus, note?: string) => void
  routeToManagement: (id: string, mgmtTitle: string, mgmtDescription: string, mgmtAssigneeId: string) => void
  uploadToAsk: (id: string, files: UploadInput[], stage: 'raw' | 'final' | 'context') => void
  answerQuestion: (id: string, answer: string) => void
  flagToMd: (kind: 'ask' | 'update', id: string, note: string) => void
  resolveFlag: (kind: 'ask' | 'update', id: string) => void

  // Comments, commentary, visits, settings
  addComment: (companyId: string, parentType: CommentParent, parentId: string, text: string, visibility: PostVisibility) => void
  setCommentary: (companyId: string, pillarId: string, periodKey: string, text: string) => void
  markVisit: (companyId: string, userId: string) => void
  updateSettings: (companyId: string, patch: Partial<Settings>) => void
  setMemberRole: (companyId: string, userId: string, role: Role | null) => void
  addPerson: (companyId: string, name: string, email: string, title: string, role: Role) => void

  // Files
  addDocuments: (companyId: string, files: { name: string; size: number }[], type: DocType, workstream: WorkstreamRef | null, note: string) => void
  moveFile: (fileId: string, to: { type?: DocType; workstream?: WorkstreamRef | null }) => void

  createCompany: (c: NewCompany) => string
}

const fresh = () => buildSeed()

/** Attachment records for uploads; real browser files also get their bytes stored for download. */
function attach(files: UploadInput[], actor: string, at: string, stage?: Attachment['stage']): Attachment[] {
  return files.map((f) => {
    const id = uid('att')
    if (isRealFile(f)) void saveFile(id, f).catch(() => undefined)
    return { id, name: f.name, size: f.size, uploadedBy: actor, at, ...(stage ? { stage } : {}) }
  })
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Clone, change, save. Cheap at demo scale and keeps writes simple. */
      const mutate = (fn: (db: DB, actor: string) => void) => {
        const db = structuredClone(get().db)
        fn(db, get().userId)
        set({ db })
      }
      const roleIn = (db: DB, companyId: string) => roleOf(db, get().userId, companyId)
      const isDealTeam = (db: DB, companyId: string) => DEAL_TEAM_ROLES.includes(roleIn(db, companyId) as Role)
      const isFirm = (db: DB, companyId: string) => {
        const r = roleIn(db, companyId)
        return !!r && r !== 'Management'
      }
      const log = (db: DB, a: Omit<Activity, 'id' | 'at' | 'actorId'> & { at?: string }) =>
        db.activity.push({ id: uid('a'), actorId: get().userId, at: nowIso(), ...a })

      const touch = (db: DB, pillarId: string, subPillarId: string | null) => {
        const at = nowIso()
        const p = db.pillars.find((x) => x.id === pillarId)
        if (p) p.lastUpdated = at
        const s = subPillarId ? db.subPillars.find((x) => x.id === subPillarId) : null
        if (s) s.lastUpdated = at
      }

      const nextOrder = (xs: { order: number }[]) => (xs.length ? Math.max(...xs.map((x) => x.order)) + 1 : 0)

      const pushAskStatus = (db: DB, a: Ask, status: AskStatus, note?: string) => {
        const at = nowIso()
        log(db, { companyId: a.companyId, action: `moved to ${status}`, objectType: 'ask', objectId: a.id, field: 'status', oldValue: a.status, newValue: status })
        a.status = status
        a.history.push({ status, at, by: get().userId, note })
        // Reopening clears the close date so the ask counts as open again everywhere.
        a.closedAt = status === 'Closed' ? at : undefined
      }

      return {
        db: fresh(),
        userId: 'u-alex',
        companyId: 'c-fernhill',
        toast: null,

        setUser: (userId) => {
          const { db, companyId } = get()
          if (roleOf(db, userId, companyId)) {
            set({ userId })
            return
          }
          const first = db.memberships.find((m) => m.userId === userId)
          set({ userId, companyId: first?.companyId ?? companyId })
        },
        setCompany: (companyId) => set({ companyId }),
        resetDemo: () => {
          void clearFiles()
          set({ db: fresh(), userId: 'u-alex', companyId: 'c-fernhill', toast: 'Demo reset to seed data' })
        },
        showToast: (toast) => set({ toast }),

        // ---------------- Plan ----------------
        saveOrganicEbitda: (companyId, target, realized) => {
          const { db } = get()
          const company = db.companies.find((c) => c.id === companyId)
          if (!company || !isDealTeam(db, companyId)) return false
          if (![target, realized].every((v) => Number.isFinite(v) && v >= 0)) return false
          const version = db.vcpVersions.filter((v) => v.companyId === companyId).sort((a, b) => b.version - a.version)[0]
          if (version?.lockedAt && target !== (company.organicTargetEbitda ?? 0)) return false
          mutate((draft) => {
            const c = draft.companies.find((x) => x.id === companyId)!
            c.organicTargetEbitda = target
            c.organicRealizedEbitda = realized
          })
          return true
        },
        updatePillar: (id, patch) =>
          mutate((db) => {
            const p = db.pillars.find((x) => x.id === id)
            if (!p || !isDealTeam(db, p.companyId)) return
            for (const [k, v] of Object.entries(patch)) {
              const old = (p as unknown as Record<string, unknown>)[k]
              if (old !== v && ['name', 'targetImpact', 'ownerIds'].includes(k))
                log(db, { companyId: p.companyId, action: `edited ${k === 'targetImpact' ? 'target' : k === 'ownerIds' ? 'owners' : k}`, objectType: 'pillar', objectId: id, field: k, oldValue: String(old), newValue: String(v) })
            }
            Object.assign(p, patch)
          }),
        updateSubPillar: (id, patch) =>
          mutate((db) => {
            const s = db.subPillars.find((x) => x.id === id)
            if (!s) return
            const owner = s.ownerIds.includes(get().userId)
            // Owners can enter captured impact; structural edits are deal team only.
            const ownerOnly = Object.keys(patch).every((k) => k === 'capturedImpact')
            if (!isDealTeam(db, s.companyId) && !(owner && ownerOnly)) return
            if (patch.capturedImpact !== undefined && patch.capturedImpact !== s.capturedImpact) {
              log(db, { companyId: s.companyId, action: 'updated captured EBITDA', objectType: 'subPillar', objectId: id, field: 'captured', oldValue: s.capturedImpact, newValue: patch.capturedImpact })
              touch(db, s.pillarId, s.id)
            }
            if (patch.targetImpact !== undefined && patch.targetImpact !== s.targetImpact)
              log(db, { companyId: s.companyId, action: 'edited target', objectType: 'subPillar', objectId: id, field: 'targetImpact', oldValue: s.targetImpact, newValue: patch.targetImpact })
            Object.assign(s, patch)
          }),
        updatePhase: (id, patch) =>
          mutate((db) => {
            const ph = db.phases.find((x) => x.id === id)
            if (!ph || !isFirm(db, ph.companyId)) return
            if (patch.status && patch.status !== ph.status) {
              log(db, { companyId: ph.companyId, action: patch.status === 'Complete' ? 'completed phase' : `set phase ${patch.status.toLowerCase()}`, objectType: 'phase', objectId: id, field: 'status', oldValue: ph.status, newValue: patch.status })
              ph.completedAt = patch.status === 'Complete' ? nowIso() : undefined
            }
            Object.assign(ph, patch)
          }),
        setPlanStatus: (kind, id, status) =>
          mutate((db) => {
            const obj = kind === 'pillar' ? db.pillars.find((x) => x.id === id) : db.subPillars.find((x) => x.id === id)
            if (!obj || !isFirm(db, obj.companyId) || obj.status === status) return
            log(db, { companyId: obj.companyId, action: 'changed status', objectType: kind, objectId: id, field: 'status', oldValue: obj.status, newValue: status })
            obj.status = status
            touch(db, kind === 'pillar' ? id : (obj as SubPillar).pillarId, kind === 'subPillar' ? id : null)
          }),
        setVisibility: (kind, id, v) =>
          mutate((db) => {
            const obj = kind === 'pillar' ? db.pillars.find((x) => x.id === id) : db.subPillars.find((x) => x.id === id)
            if (!obj || !isDealTeam(db, obj.companyId) || obj.visibility === v) return
            log(db, { companyId: obj.companyId, action: v === 'shared' ? 'shared with management' : 'made Firm only', objectType: kind, objectId: id, field: 'visibility', oldValue: obj.visibility, newValue: v })
            obj.visibility = v
          }),
        addPillar: (companyId) => {
          let id: string | undefined
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            id = uid('p')
            const vis = db.settings[companyId]?.defaultVisibility ?? 'firm'
            db.pillars.push({
              id, companyId, name: 'New pillar', objective: '', rationale: '', sourceRef: '', targetImpact: 0, capturedImpact: 0,
              ownerIds: [], status: 'Not started', visibility: vis, order: nextOrder(db.pillars.filter((p) => p.companyId === companyId)),
              startDate: nowIso(), targetDate: addHours(nowIso(), 24 * 365), lastUpdated: nowIso(),
            })
            log(db, { companyId, action: 'added pillar', objectType: 'pillar', objectId: id })
          })
          return id
        },
        addSubPillar: (pillarId) => {
          let id: string | undefined
          mutate((db) => {
            const p = db.pillars.find((x) => x.id === pillarId)
            if (!p || !isDealTeam(db, p.companyId)) return
            id = uid('sp')
            const firstSub = !db.subPillars.some((s) => s.pillarId === pillarId)
            db.subPillars.push({
              id, companyId: p.companyId, pillarId, name: 'New sub-pillar', objective: '',
              // The first sub-pillar inherits the pillar's own target so totals don't jump.
              targetImpact: firstSub ? p.targetImpact : 0, capturedImpact: firstSub ? p.capturedImpact : 0,
              ownerIds: [...p.ownerIds], status: 'Not started', visibility: 'firm',
              order: nextOrder(db.subPillars.filter((s) => s.pillarId === pillarId)),
              startDate: p.startDate, targetDate: p.targetDate, lastUpdated: nowIso(),
            })
            log(db, { companyId: p.companyId, action: 'added sub-pillar', objectType: 'subPillar', objectId: id })
          })
          return id
        },
        addPhase: (pillarId, subPillarId) =>
          mutate((db) => {
            const p = db.pillars.find((x) => x.id === pillarId)
            if (!p || !isDealTeam(db, p.companyId)) return
            const siblings = db.phases.filter((x) => x.pillarId === pillarId && x.subPillarId === subPillarId)
            const last = siblings.sort((a, b) => a.order - b.order).at(-1)
            const start = last?.endDate ?? nowIso()
            db.phases.push({
              id: uid('ph'), companyId: p.companyId, pillarId, subPillarId, name: `Phase ${siblings.length + 1}`,
              description: '', deliverables: [], startDate: start, endDate: addHours(start, 24 * 90), status: 'Not started',
              order: nextOrder(siblings),
            })
          }),
        deletePillar: (id) =>
          mutate((db) => {
            const p = db.pillars.find((x) => x.id === id)
            if (!p || !isDealTeam(db, p.companyId)) return
            const locked = db.vcpVersions.some((v) => v.companyId === p.companyId && v.lockedAt) &&
              !db.vcpVersions.some((v) => v.companyId === p.companyId && !v.lockedAt)
            if (locked) {
              // After lock, removing a pillar retires it so the history stays intact.
              p.retiredAt = nowIso()
              log(db, { companyId: p.companyId, action: 'retired pillar', objectType: 'pillar', objectId: id })
              return
            }
            db.pillars = db.pillars.filter((x) => x.id !== id)
            const subIds = new Set(db.subPillars.filter((s) => s.pillarId === id).map((s) => s.id))
            db.subPillars = db.subPillars.filter((s) => s.pillarId !== id)
            db.phases = db.phases.filter((x) => x.pillarId !== id)
            db.kpis = db.kpis.filter((x) => x.pillarId !== id)
            db.comments = db.comments.filter((c) => !(c.parentId === id || subIds.has(c.parentId)))
            // Folder tags and document workstreams that pointed at the pillar go with it.
            dropWorkstreamRefs(db, (ref) => ref.pillarId === id || (!!ref.subPillarId && subIds.has(ref.subPillarId)), () => null)
          }),
        deleteSubPillar: (id) =>
          mutate((db) => {
            const s = db.subPillars.find((x) => x.id === id)
            if (!s || !isDealTeam(db, s.companyId)) return
            db.subPillars = db.subPillars.filter((x) => x.id !== id)
            db.phases = db.phases.filter((x) => x.subPillarId !== id)
            db.kpis = db.kpis.filter((x) => x.subPillarId !== id)
            // Tags fall back to the file's own origin; documents keep the parent pillar as their workstream.
            dropWorkstreamRefs(db, (ref) => ref.subPillarId === id, (ref) => ({ pillarId: ref.pillarId, subPillarId: null }))
            log(db, { companyId: s.companyId, action: `removed sub-pillar ${s.name}`, objectType: 'pillar', objectId: s.pillarId })
          }),
        deletePhase: (id) =>
          mutate((db) => {
            const ph = db.phases.find((x) => x.id === id)
            if (!ph || !isDealTeam(db, ph.companyId)) return
            db.phases = db.phases.filter((x) => x.id !== id)
          }),
        reorderPillars: (companyId, orderedIds) =>
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            orderedIds.forEach((id, i) => {
              const p = db.pillars.find((x) => x.id === id)
              if (p) p.order = i
            })
          }),
        reorderSubPillars: (pillarId, orderedIds) =>
          mutate((db) => {
            const p = db.pillars.find((x) => x.id === pillarId)
            if (!p || !isDealTeam(db, p.companyId)) return
            orderedIds.forEach((id, i) => {
              const s = db.subPillars.find((x) => x.id === id)
              if (s) s.order = i
            })
          }),
        replacePillarFromAi: (pillarId, gp) =>
          mutate((db) => {
            const p = db.pillars.find((x) => x.id === pillarId)
            if (!p || !isDealTeam(db, p.companyId)) return
            Object.assign(p, {
              name: gp.name, objective: gp.objective, rationale: gp.rationale, sourceRef: gp.sourceRef,
              targetImpact: gp.targetImpact, visibility: gp.visibility,
            })
            db.subPillars = db.subPillars.filter((s) => s.pillarId !== pillarId)
            db.phases = db.phases.filter((x) => x.pillarId !== pillarId)
            db.kpis = db.kpis.filter((x) => x.pillarId !== pillarId)
            insertChildren(db, p, gp)
            log(db, { companyId: p.companyId, action: 'regenerated pillar with AI', objectType: 'pillar', objectId: pillarId })
          }),
        replaceSubPillarFromAi: (subPillarId, gs) =>
          mutate((db) => {
            const s = db.subPillars.find((x) => x.id === subPillarId)
            if (!s || !isDealTeam(db, s.companyId)) return
            Object.assign(s, { name: gs.name, objective: gs.objective, targetImpact: gs.targetImpact, visibility: gs.visibility })
            db.phases = db.phases.filter((x) => x.subPillarId !== subPillarId)
            db.kpis = db.kpis.filter((x) => x.subPillarId !== subPillarId)
            gs.phases.forEach((ph, i) => db.phases.push({ ...ph, id: uid('ph'), companyId: s.companyId, pillarId: s.pillarId, subPillarId, order: i }))
            gs.kpis.forEach((k) => db.kpis.push({ ...k, id: uid('k'), companyId: s.companyId, pillarId: s.pillarId, subPillarId }))
            log(db, { companyId: s.companyId, action: 'regenerated sub-pillar with AI', objectType: 'subPillar', objectId: subPillarId })
          }),
        addKpiActual: (kpiId, value) =>
          mutate((db) => {
            const k = db.kpis.find((x) => x.id === kpiId)
            if (!k || !isFirm(db, k.companyId)) return
            const prev = k.actuals.at(-1)?.value ?? k.baseline
            k.actuals.push({ date: nowIso(), value })
            log(db, { companyId: k.companyId, action: 'logged KPI actual', objectType: 'kpi', objectId: kpiId, field: 'actual', oldValue: prev, newValue: value })
          }),

        // ---------------- Alignment ----------------
        requestAlignment: (companyId) =>
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            const v = db.vcpVersions.filter((x) => x.companyId === companyId).sort((a, b) => b.version - a.version)[0]
            if (!v || v.lockedAt) return
            const role = (r: Role) => db.memberships.filter((m) => m.companyId === companyId && m.role === r).map((m) => m.userId)
            const ownerOps = new Set(
              db.pillars.filter((p) => p.companyId === companyId && !p.retiredAt).flatMap((p) => p.ownerIds)
                .concat(db.subPillars.filter((s) => s.companyId === companyId).flatMap((s) => s.ownerIds))
                .filter((uid) => roleOf(db, uid, companyId) === 'OP'),
            )
            v.approverIds = [...new Set([...role('MD'), ...role('VP'), ...ownerOps])]
            v.alignmentRequestedAt = nowIso()
            v.signOffs = []
            log(db, { companyId, action: `requested alignment on VCP v${v.version}`, objectType: 'vcp', objectId: v.id })
          }),
        signOff: (versionId) =>
          mutate((db, actor) => {
            const v = db.vcpVersions.find((x) => x.id === versionId)
            if (!v || v.lockedAt || !v.approverIds.includes(actor) || v.signOffs.some((s) => s.userId === actor)) return
            v.signOffs.push({ userId: actor, at: nowIso() })
            log(db, { companyId: v.companyId, action: `signed off on VCP v${v.version}`, objectType: 'vcp', objectId: v.id })
            if (v.approverIds.every((id) => v.signOffs.some((s) => s.userId === id))) {
              v.lockedAt = nowIso()
              log(db, { companyId: v.companyId, action: `locked VCP v${v.version}`, objectType: 'vcp', objectId: v.id })
            }
          }),
        startRevision: (companyId, note) =>
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            const latest = db.vcpVersions.filter((x) => x.companyId === companyId).sort((a, b) => b.version - a.version)[0]
            if (latest && !latest.lockedAt) return
            const version = (latest?.version ?? 0) + 1
            const id = uid('v')
            db.vcpVersions.push({ id, companyId, version, changeNote: note, approverIds: [], signOffs: [], createdAt: nowIso() })
            log(db, { companyId, action: `started VCP v${version}: ${note}`, objectType: 'vcp', objectId: id })
          }),

        // ---------------- Updates ----------------
        postUpdate: (u) =>
          mutate((db, actor) => {
            if (!isFirm(db, u.companyId)) return
            const at = nowIso()
            const id = uid('upd')
            const target = u.subPillarId ? db.subPillars.find((s) => s.id === u.subPillarId) : db.pillars.find((p) => p.id === u.pillarId)
            if (!target) return
            const upd: Update = {
              id, companyId: u.companyId, pillarId: u.pillarId, subPillarId: u.subPillarId, phaseId: u.phaseId,
              authorId: actor, text: u.text.trim(), visibility: u.visibility, createdAt: at,
              attachments: attach(u.attachments, actor, at),
            }
            const kind = u.subPillarId ? 'subPillar' : 'pillar'
            if (u.status && u.status !== target.status) {
              upd.statusChange = { from: target.status, to: u.status }
              log(db, { companyId: u.companyId, action: 'changed status', objectType: kind, objectId: target.id, field: 'status', oldValue: target.status, newValue: u.status })
              target.status = u.status
            }
            if (u.captured !== undefined && Number.isFinite(u.captured) && u.captured !== target.capturedImpact) {
              upd.capturedChange = { from: target.capturedImpact, to: u.captured }
              log(db, { companyId: u.companyId, action: 'updated captured EBITDA', objectType: kind, objectId: target.id, field: 'captured', oldValue: target.capturedImpact, newValue: u.captured })
              target.capturedImpact = u.captured
            }
            if (u.phaseId && u.completePhase) {
              const ph = db.phases.find((x) => x.id === u.phaseId)
              if (ph && ph.status !== 'Complete') {
                log(db, { companyId: u.companyId, action: 'completed phase', objectType: 'phase', objectId: ph.id, field: 'status', oldValue: ph.status, newValue: 'Complete' })
                ph.status = 'Complete'
                ph.completedAt = at
                upd.phaseCompleted = u.completePhase
                // Start the next phase in line.
                const next = db.phases
                  .filter((x) => x.pillarId === ph.pillarId && x.subPillarId === ph.subPillarId && x.order > ph.order && x.status === 'Not started')
                  .sort((a, b) => a.order - b.order)[0]
                if (next) next.status = 'In progress'
              }
            }
            db.updates.push(upd)
            log(db, { companyId: u.companyId, action: 'posted an update', objectType: 'update', objectId: id })
            touch(db, u.pillarId, u.subPillarId)
          }),
        confirmNoChange: (pillarId) =>
          mutate((db, actor) => {
            const p = db.pillars.find((x) => x.id === pillarId)
            if (!p || !isFirm(db, p.companyId)) return
            const id = uid('upd')
            db.updates.push({
              id, companyId: p.companyId, pillarId, subPillarId: null, phaseId: null, authorId: actor,
              text: 'No change this week.', noChange: true, attachments: [], visibility: 'internal', createdAt: nowIso(),
            })
            log(db, { companyId: p.companyId, action: 'confirmed no change', objectType: 'update', objectId: id })
            touch(db, pillarId, null)
          }),

        // ---------------- Asks ----------------
        createAsk: (a) => {
          let id: string | undefined
          mutate((db, actor) => {
            if (!isFirm(db, a.companyId)) return
            id = uid('ask')
            // New requests auto-assign to the deal's associate.
            const associate = db.memberships.find((m) => m.companyId === a.companyId && m.role === 'Associate')?.userId
            const vp = db.memberships.find((m) => m.companyId === a.companyId && m.role === 'VP')?.userId
            const status: AskStatus = a.type === 'data_request' ? 'New' : 'Open'
            db.asks.push({
              id, companyId: a.companyId, type: a.type, title: a.title.trim(), pillarId: a.pillarId, subPillarId: a.subPillarId,
              createdBy: actor, assigneeIds: [associate ?? vp ?? actor], urgency: a.urgency, dueDate: a.dueDate, status,
              flaggedToMd: false, createdAt: nowIso(), attachments: [],
              description: a.description, context: a.context,
              history: [{ status, at: nowIso(), by: actor }],
            })
            log(db, { companyId: a.companyId, action: 'created', objectType: 'ask', objectId: id, field: 'status', newValue: status })
          })
          return id
        },
        patchAsk: (id, patch) =>
          mutate((db, actor) => {
            const a = db.asks.find((x) => x.id === id)
            if (!a || !isFirm(db, a.companyId)) return
            if (patch.assigneeIds && patch.assigneeIds.join() !== a.assigneeIds.join()) {
              if (!['VP', 'Principal', 'MD'].includes(roleIn(db, a.companyId) ?? '')) return
              if (!patch.assigneeIds.length) return // an ask always has at least one owner
              log(db, { companyId: a.companyId, action: 'reassigned', objectType: 'ask', objectId: id, field: 'assignee', oldValue: a.assigneeIds.join(', '), newValue: patch.assigneeIds.join(', ') })
            }
            if (patch.mgmtTitle !== undefined || patch.mgmtDescription !== undefined) patch = { ...patch, mgmtApprovedBy: actor }
            Object.assign(a, patch)
          }),
        transitionAsk: (id, status, note) =>
          mutate((db) => {
            const a = db.asks.find((x) => x.id === id)
            if (!a || !isFirm(db, a.companyId) || a.status === status) return
            pushAskStatus(db, a, status, note)
          }),
        routeToManagement: (id, mgmtTitle, mgmtDescription, mgmtAssigneeId) =>
          mutate((db, actor) => {
            const a = db.asks.find((x) => x.id === id)
            if (!a || a.type !== 'data_request' || !isDealTeam(db, a.companyId)) return
            Object.assign(a, { mgmtTitle: mgmtTitle.trim(), mgmtDescription: mgmtDescription.trim(), mgmtAssigneeId, mgmtApprovedBy: actor })
            if (a.status === 'New') pushAskStatus(db, a, 'In progress')
            pushAskStatus(db, a, 'Sent to management')
          }),
        uploadToAsk: (id, files, stage) =>
          mutate((db, actor) => {
            const a = db.asks.find((x) => x.id === id)
            if (!a) return
            const role = roleIn(db, a.companyId)
            if (stage === 'raw' && !(role === 'Management' && a.mgmtAssigneeId && a.status === 'Sent to management') && !isDealTeam(db, a.companyId)) return
            if ((stage === 'final' || stage === 'context') && !isDealTeam(db, a.companyId)) return
            const at = nowIso()
            a.attachments.push(...attach(files, actor, at, stage))
            if (stage === 'raw' && a.status === 'Sent to management') pushAskStatus(db, a, 'Data received')
            if (stage === 'final' && ['New', 'In progress', 'Data received'].includes(a.status)) pushAskStatus(db, a, 'Delivered')
          }),
        answerQuestion: (id, answer) =>
          mutate((db, actor) => {
            const a = db.asks.find((x) => x.id === id)
            if (!a || a.type !== 'question' || !isFirm(db, a.companyId)) return
            a.answer = answer.trim()
            a.answeredBy = actor
            pushAskStatus(db, a, 'Answered')
            if (a.flaggedToMd && !a.flagResolvedAt) a.flagResolvedAt = nowIso()
          }),
        flagToMd: (kind, id, note) =>
          mutate((db, actor) => {
            const obj = kind === 'ask' ? db.asks.find((x) => x.id === id) : db.updates.find((x) => x.id === id)
            if (!obj || !isDealTeam(db, obj.companyId)) return
            Object.assign(obj, { flaggedToMd: true, flagNote: note.trim(), flagResolvedAt: undefined })
            if (kind === 'ask') Object.assign(obj, { flaggedBy: actor, flaggedAt: nowIso() })
            log(db, { companyId: obj.companyId, action: 'flagged to MD', objectType: kind, objectId: id })
          }),
        resolveFlag: (kind, id) =>
          mutate((db) => {
            const obj = kind === 'ask' ? db.asks.find((x) => x.id === id) : db.updates.find((x) => x.id === id)
            if (!obj || !isDealTeam(db, obj.companyId)) return
            obj.flagResolvedAt = nowIso()
            log(db, { companyId: obj.companyId, action: 'resolved flag', objectType: kind, objectId: id })
          }),

        // ---------------- Comments, commentary, visits, settings ----------------
        addComment: (companyId, parentType, parentId, text, visibility) =>
          mutate((db, actor) => {
            const role = roleIn(db, companyId)
            if (!role) return
            const c: Comment = {
              id: uid('cm'), companyId, parentType, parentId, authorId: actor, text: text.trim(),
              // Management comments are always visible to management.
              visibility: role === 'Management' ? 'shared' : visibility, createdAt: nowIso(),
            }
            db.comments.push(c)
            log(db, { companyId, action: 'commented', objectType: 'comment', objectId: c.id })
          }),
        setCommentary: (companyId, pillarId, periodKey, text) =>
          mutate((db, actor) => {
            if (!isFirm(db, companyId)) return
            const existing = db.commentary.find((c) => c.companyId === companyId && c.pillarId === pillarId && c.periodKey === periodKey)
            if (existing) Object.assign(existing, { text, authorId: actor, updatedAt: nowIso() })
            else db.commentary.push({ id: uid('cmt'), companyId, pillarId, periodKey, text, authorId: actor, updatedAt: nowIso() })
          }),
        markVisit: (companyId, userId) => {
          const key = `${userId}:${companyId}`
          set((s) => ({ db: { ...s.db, visits: { ...s.db.visits, [key]: nowIso() } } }))
        },
        updateSettings: (companyId, patch) =>
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            db.settings[companyId] = { ...(db.settings[companyId] ?? DEFAULT_SETTINGS), ...patch }
          }),
        setMemberRole: (companyId, userId, role) =>
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            db.memberships = db.memberships.filter((m) => !(m.companyId === companyId && m.userId === userId))
            if (role) db.memberships.push({ id: uid('m'), companyId, userId, role })
          }),
        addPerson: (companyId, name, email, title, role) =>
          mutate((db) => {
            if (!isDealTeam(db, companyId)) return
            const id = uid('u')
            db.users.push({ id, name: name.trim(), email: email.trim(), title: title.trim() })
            db.memberships.push({ id: uid('m'), companyId, userId: id, role })
          }),

        // ---------------- Files ----------------
        addDocuments: (companyId, files, type, workstream, note) =>
          mutate((db, actor) => {
            if (!isFirm(db, companyId) || !files.length) return
            const at = nowIso()
            for (const f of files) {
              const id = uid('doc')
              db.documents.push({
                id, companyId, type, name: f.name, size: f.size, uploadedBy: actor, date: at,
                workstream: workstream ?? undefined, note: note.trim() || undefined,
              })
              log(db, { companyId, action: `added ${f.name} to files`, objectType: 'document', objectId: id })
            }
          }),
        moveFile: (fileId, to) =>
          mutate((db) => {
            const doc = db.documents.find((d) => d.id === fileId)
            if (doc) {
              if (!isFirm(db, doc.companyId)) return
              if (to.type) doc.type = to.type
              if (to.workstream !== undefined) doc.workstream = to.workstream ?? undefined
              log(db, { companyId: doc.companyId, action: `moved ${doc.name} to ${doc.type}`, objectType: 'document', objectId: doc.id })
              return
            }
            // Attachments stay on their update or request; the tag only changes which folder they file under.
            const holder = db.updates.find((u) => u.attachments.some((a) => a.id === fileId)) ?? db.asks.find((a) => a.attachments.some((x) => x.id === fileId))
            if (!holder || !isFirm(db, holder.companyId) || to.workstream === undefined) return
            db.fileTags ??= {}
            if (to.workstream) db.fileTags[fileId] = to.workstream
            else delete db.fileTags[fileId]
          }),

        createCompany: (c) => {
          const companyId = uid('c')
          mutate((db, actor) => {
            db.companies.push({
              id: companyId, name: c.name, sector: c.sector, closeDate: c.closeDate, holdYears: c.holdYears,
              entryEbitda: c.entryEbitda, exitEbitda: c.exitEbitda,
            })
            db.settings[companyId] = structuredClone(DEFAULT_SETTINGS)
            const seen = new Set<string>()
            for (const p of c.people) {
              let userId = p.userId
              if (!userId && p.name) {
                userId = uid('u')
                db.users.push({ id: userId, name: p.name, email: p.email ?? '', title: p.title ?? '' })
              }
              if (!userId || seen.has(userId)) continue
              seen.add(userId)
              db.memberships.push({ id: uid('m'), companyId, userId, role: p.role })
            }
            if (!seen.has(actor)) db.memberships.push({ id: uid('m'), companyId, userId: actor, role: 'VP' })
            for (const d of c.documents)
              db.documents.push({ id: uid('doc'), companyId, type: d.type, name: d.name, size: d.size, uploadedBy: actor, date: nowIso() })
            c.plan.pillars.forEach((gp, i) => {
              const p: Pillar = {
                id: uid('p'), companyId, order: i, lastUpdated: nowIso(), capturedImpact: 0,
                name: gp.name, objective: gp.objective, rationale: gp.rationale, sourceRef: gp.sourceRef,
                targetImpact: gp.targetImpact, ownerIds: gp.ownerIds, status: 'Not started', visibility: gp.visibility,
                startDate: gp.startDate, targetDate: gp.targetDate,
              }
              db.pillars.push(p)
              insertChildren(db, p, gp)
            })
            const vid = uid('v')
            db.vcpVersions.push({ id: vid, companyId, version: 1, changeNote: c.aiNote, approverIds: [], signOffs: [], createdAt: nowIso() })
            log(db, { companyId, action: 'generated draft VCP', objectType: 'vcp', objectId: vid })
          })
          set({ companyId })
          return companyId
        },
      }
    },
    {
      name: 'pillar-demo',
      version: SEED_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ db: s.db, userId: s.userId, companyId: s.companyId }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<State> | undefined
        // Plans saved at the current version may still hold folder tags for pillars deleted before
        // deletion cleaned them up; the version-change upgrade never runs for those, so tidy here.
        const db = saved?.db ? dropDanglingWorkstreamRefs(saved.db) : current.db
        return { ...current, ...saved, db: applyDemoOrganicDefaults(db) }
      },
      // A new seed version keeps what the user saved and fills in new fields;
      // only data older than OLDEST_UPGRADABLE is replaced with a fresh seed.
      migrate: (persisted, version) => {
        const saved = persisted as Partial<Pick<State, 'db' | 'userId' | 'companyId'>> | undefined
        if (!saved || !canUpgrade(version, saved.db)) return { db: fresh(), userId: 'u-alex', companyId: 'c-fernhill' } as unknown as State
        return { ...saved, db: upgradeDb(saved.db), toast: 'Your saved data was kept. Use Reset demo to load the latest sample data.' } as unknown as State
      },
    },
  ),
)

function insertChildren(db: DB, p: Pillar, gp: GeneratedPlan['pillars'][number]) {
  gp.subPillars.forEach((gs, j) => {
    const sid = uid('sp')
    db.subPillars.push({
      id: sid, companyId: p.companyId, pillarId: p.id, order: j, lastUpdated: nowIso(), capturedImpact: 0,
      name: gs.name, objective: gs.objective, targetImpact: gs.targetImpact, ownerIds: gs.ownerIds,
      status: 'Not started', visibility: gs.visibility, startDate: gs.startDate, targetDate: gs.targetDate,
    })
    gs.phases.forEach((ph, k) => db.phases.push({ ...ph, id: uid('ph'), companyId: p.companyId, pillarId: p.id, subPillarId: sid, order: k }))
    gs.kpis.forEach((kp) => db.kpis.push({ ...kp, id: uid('k'), companyId: p.companyId, pillarId: p.id, subPillarId: sid }))
  })
  gp.phases.forEach((ph, k) => db.phases.push({ ...ph, id: uid('ph'), companyId: p.companyId, pillarId: p.id, subPillarId: null, order: k }))
  gp.kpis.forEach((kp) => db.kpis.push({ ...kp, id: uid('k'), companyId: p.companyId, pillarId: p.id, subPillarId: null }))
}

