// Read-side helpers. All of them take a View (already permission-scoped).

import { useMemo } from 'react'
import { useStore } from './store'
import { scopeFor, sum, type PillarView, type View } from './permissions'
import type { Ask, PlanStatus } from './types'
import { daysSince, inWindow, isPast, windowFor, type Period } from './dates'

export function useView(companyId?: string): View | null {
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const current = useStore((s) => s.companyId)
  const id = companyId ?? current
  return useMemo(() => scopeFor(db, userId, id), [db, userId, id])
}

export const userName = (v: View, id: string | undefined) =>
  v.members.find((m) => m.user.id === id)?.user.name ?? (id ? 'Former member' : '—')

export function planTotals(v: View) {
  const target = sum(v.pillars.map((p) => p.target))
  const captured = sum(v.pillars.map((p) => p.captured))
  const planToDate = sum(v.pillars.map((p) => p.planToDate))
  const gap = Math.round((v.company.exitEbitda - v.company.entryEbitda) * 100) / 100
  return { target, captured, planToDate, gap, pct: target ? captured / target : 0 }
}

/** Whether this person is one of the ask's deal-team owners. */
export const isAssignee = (a: Ask, userId: string) => a.assigneeIds.includes(userId)

export function isAskOpen(a: Ask) {
  return !['Delivered', 'Closed', 'Answered'].includes(a.status)
}

export function isOverdue(a: Ask) {
  return isAskOpen(a) && isPast(a.dueDate)
}

const URGENCY_RANK = { Critical: 0, High: 1, Standard: 2, Low: 3 }
export function sortAsks(asks: Ask[]) {
  return [...asks].sort(
    (a, b) =>
      Number(isOverdue(b)) - Number(isOverdue(a)) ||
      URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
      a.dueDate.localeCompare(b.dueDate),
  )
}

export function isStale(v: View, p: PillarView) {
  return p.status !== 'Complete' && daysSince(p.lastUpdated) > (v.settings?.staleDays ?? 14)
}

export function healthOf(v: View): { label: string; status: PlanStatus } {
  const counts = statusCounts(v)
  if (counts['Off track'] > 0) return { label: 'Off track', status: 'Off track' }
  if (counts['At risk'] > 0) return { label: 'Watch', status: 'At risk' }
  if (v.pillars.length && counts['Complete'] === v.pillars.length) return { label: 'Complete', status: 'Complete' }
  return { label: 'Healthy', status: 'On track' }
}

export function statusCounts(v: View): Record<PlanStatus, number> {
  const c: Record<PlanStatus, number> = { 'Not started': 0, 'On track': 0, 'At risk': 0, 'Off track': 0, Complete: 0 }
  for (const p of v.pillars) c[p.status] += 1
  return c
}

export function latestVersion(v: View) {
  return v.vcpVersions.at(-1)
}

export function isPlanLocked(v: View) {
  return !!latestVersion(v)?.lockedAt
}

/** Pillars and sub-pillars this person owns. */
export function ownedBy(v: View, userId: string) {
  const subs = v.subPillars.filter((s) => s.ownerIds.includes(userId))
  const pillars = v.pillars.filter((p) => p.ownerIds.includes(userId) || subs.some((s) => s.pillarId === p.id))
  return { pillars, subs }
}

export function lastUpdateBy(v: View, userId: string) {
  return v.updates.find((u) => u.authorId === userId)
}

export function openFlags(v: View) {
  const asks = v.asks.filter((a) => a.flaggedToMd && !a.flagResolvedAt).sort((a, b) => (b.flaggedAt ?? '').localeCompare(a.flaggedAt ?? ''))
  const updates = v.updates.filter((u) => u.flaggedToMd && !u.flagResolvedAt)
  return { asks, updates, count: asks.length + updates.length }
}

// ---------------- Progress view ----------------

export interface PillarProgress {
  id: string
  name: string
  num: string
  level: 'pillar' | 'sub'
  /** Status changes logged in the comparison window. */
  statusChanges: { from: string; to: string; at: string }[]
  statusAtEnd: string
  phasesCompleted: string[]
  /** Captured EBITDA added in the window (realized as of the period end minus realized at the comparison point). */
  capturedAdded: number
  /** Realized at the comparison point. */
  capturedAtStart: number
  /** Realized as of the period end. */
  capturedAtEnd: number
  target: number
  kpis: { name: string; unit: string; from: number; to: number; target: number }[]
  asksClosed: number
  updates: number
}

/**
 * Built from the dated event log, not from snapshots. Everything is read as of the end of
 * `period`; every "change" is what was logged after the end of `prior` (see windowFor).
 */
export function progressFor(v: View, period: Period, prior: Period): PillarProgress[] {
  const rows: PillarProgress[] = []
  const w = windowFor(period, prior)
  const beforeEnd = (iso: string) => new Date(iso).getTime() < w.asOf.getTime()
  const beforeSince = (iso: string) => new Date(iso).getTime() < w.since.getTime()

  const row = (
    level: 'pillar' | 'sub',
    id: string,
    name: string,
    num: string,
    status: string,
    target: number,
    capturedNow: number,
    match: { objectIds: string[]; phaseFilter: (pillarId: string, subId: string | null) => boolean; askFilter: (a: Ask) => boolean },
  ): PillarProgress => {
    const events = v.activity.filter((a) => match.objectIds.includes(a.objectId))
    const statusEvents = events
      .filter((a) => a.field === 'status' && (a.objectType === 'pillar' || a.objectType === 'subPillar') && a.objectId === id)
      .sort((a, b) => a.at.localeCompare(b.at))
    const statusChanges = statusEvents
      .filter((a) => inWindow(a.at, w))
      .map((a) => ({ from: String(a.oldValue), to: String(a.newValue), at: a.at }))
    // Status at period end: the last change before the end, else the status before any later change.
    const lastBefore = statusEvents.filter((a) => beforeEnd(a.at)).at(-1)
    const firstAfter = statusEvents.find((a) => !beforeEnd(a.at))
    const statusAtEnd = lastBefore ? String(lastBefore.newValue) : firstAfter ? String(firstAfter.oldValue) : status

    const captured = events.filter((a) => a.field === 'captured')
    const deltaOf = (a: { oldValue?: unknown; newValue?: unknown }) => Number(a.newValue) - Number(a.oldValue)
    const later = sum(captured.filter((a) => !beforeEnd(a.at)).map(deltaOf))
    const added = sum(captured.filter((a) => inWindow(a.at, w)).map(deltaOf))
    const capturedAtEnd = Math.round((capturedNow - later) * 100) / 100

    const phasesCompleted = v.phases
      .filter((ph) => match.phaseFilter(ph.pillarId, ph.subPillarId) && inWindow(ph.completedAt, w))
      .map((ph) => ph.name)

    const kpis = v.kpis
      .filter((k) => match.phaseFilter(k.pillarId, k.subPillarId))
      .map((k) => {
        const from = k.actuals.filter((a) => beforeSince(a.date)).at(-1)?.value ?? k.baseline
        const to = k.actuals.filter((a) => beforeEnd(a.date)).at(-1)?.value ?? k.baseline
        return { name: k.name, unit: k.unit, from, to, target: k.target }
      })
      .filter((k) => k.from !== k.to)

    const asksClosed = v.asks
      .filter(match.askFilter)
      .filter((a) => inWindow(a.closedAt ?? a.history.find((h) => h.status === 'Delivered' || h.status === 'Answered')?.at, w)).length

    const updates = v.updates.filter((u) => match.objectIds.includes(u.subPillarId ?? u.pillarId) && inWindow(u.createdAt, w)).length

    return {
      id,
      name,
      num,
      level,
      statusChanges,
      statusAtEnd,
      phasesCompleted,
      capturedAdded: Math.round(added * 100) / 100,
      capturedAtStart: Math.round((capturedAtEnd - added) * 100) / 100,
      capturedAtEnd,
      target,
      kpis,
      asksClosed,
      updates,
    }
  }

  for (const p of v.pillars) {
    const subs = v.subPillars.filter((s) => s.pillarId === p.id)
    const subRows = subs.map((s) =>
      row('sub', s.id, s.name, s.num, s.status, s.targetImpact, s.capturedImpact, {
        objectIds: [s.id],
        phaseFilter: (_pid, sid) => sid === s.id,
        askFilter: (a) => a.subPillarId === s.id,
      }),
    )
    const pRow = row('pillar', p.id, p.name, String(p.num), p.status, p.target, p.captured, {
      objectIds: [p.id, ...subs.map((s) => s.id)],
      phaseFilter: (pid) => pid === p.id,
      askFilter: (a) => a.pillarId === p.id,
    })
    if (subs.length) {
      // Pillar captured rolls up from its sub-pillars.
      pRow.capturedAdded = sum(subRows.map((r) => r.capturedAdded))
      pRow.capturedAtStart = sum(subRows.map((r) => r.capturedAtStart))
      pRow.capturedAtEnd = sum(subRows.map((r) => r.capturedAtEnd))
    }
    rows.push(pRow, ...subRows)
  }
  return rows
}

export function fmtM(n: number, digits = 1) {
  return `$${n.toFixed(digits)}M`
}

export function fmtDelta(n: number) {
  if (Math.abs(n) < 0.005) return '—'
  return `${n > 0 ? '+' : '−'}$${Math.abs(n).toFixed(1)}M`
}

export function fmtSize(bytes: number) {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function fmtKpi(value: number, unit: string) {
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === '$') return `$${value.toFixed(2)}`
  if (unit === '$M') return `$${value.toFixed(2)}M`
  return `${value.toLocaleString()} ${unit}`
}
