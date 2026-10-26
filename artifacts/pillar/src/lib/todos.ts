// "In your court": the things only one person can move forward.
// The dashboard court card builds one list per person from that person's own view.

import type { View } from './permissions'
import type { Ask, Urgency } from './types'
import { isOverdue, isStale, sortAsks } from './selectors'
import { daysSince } from './dates'

export interface Todo {
  id: string
  /** What the person has to do, in plain words. */
  action: string
  title: string
  /** Where clicking takes them. */
  to: string
  kind: 'ask' | 'pillar' | 'flag'
  urgency?: Urgency
  dueDate?: string
  overdue?: boolean
  /** Flagged updates can be cleared right from the list. */
  updateId?: string
  /** Lower sorts first. */
  rank: number
}

/** Why an ask is in this viewer's court, or null if it is not. */
export function askNeeds(view: View, a: Ask): string | null {
  const me = view.viewer.user.id
  const { role, isMgmt, canTriageAsks } = view.viewer
  if (isMgmt) return a.status === 'Sent to management' && a.mgmtAssigneeId === me ? 'Upload the file' : null
  if (a.status === 'Closed') return null
  if ((role === 'MD' || role === 'Principal') && a.flaggedToMd && !a.flagResolvedAt) return a.type === 'question' ? 'Your call: answer it' : 'Flagged to you'
  if ((a.status === 'Delivered' || a.status === 'Answered') && a.createdBy === me) return a.type === 'question' ? 'Read the answer and close' : 'Check the file and close'
  if (!canTriageAsks || !a.assigneeIds.includes(me)) return null
  if (a.status === 'New') return 'Pick up, or send to management'
  if (a.status === 'Open') return 'Answer'
  if (a.status === 'In progress') return a.type === 'question' ? 'Answer' : 'Deliver, or send to management'
  if (a.status === 'Data received') return 'Clean up the file and deliver'
  return null
}

export function todosFor(view: View): Todo[] {
  const base = `/c/${view.company.id}`
  const items: Todo[] = []
  for (const a of sortAsks(view.asks)) {
    const action = askNeeds(view, a)
    if (!action) continue
    const overdue = isOverdue(a)
    const flagged = !!a.flaggedToMd && !a.flagResolvedAt
    items.push({
      id: a.id,
      kind: flagged ? 'flag' : 'ask',
      action,
      title: a.title,
      to: `${base}/asks/${a.id}`,
      urgency: a.urgency,
      dueDate: a.dueDate,
      overdue,
      rank: overdue ? 0 : flagged ? 1 : a.status === 'Delivered' || a.status === 'Answered' ? 3 : 2,
    })
  }
  if (view.viewer.isFirm) {
    const me = view.viewer.user.id
    if (view.viewer.role === 'MD' || view.viewer.role === 'Principal') {
      for (const u of view.updates.filter((u) => u.flaggedToMd && !u.flagResolvedAt)) {
        const p = view.pillars.find((x) => x.id === u.pillarId)
        items.push({
          id: `flag-${u.id}`,
          kind: 'flag',
          action: u.flagNote ? `Flagged update: ${u.flagNote}` : 'Flagged update',
          title: `${p ? `${p.num}. ${p.name}: ` : ''}“${u.text}”`,
          to: `${base}/pillars/${u.pillarId}`,
          urgency: 'High',
          updateId: u.id,
          rank: 1,
        })
      }
    }
    for (const p of view.pillars) {
      const owned = p.ownerIds.includes(me) || view.subPillars.some((s) => s.pillarId === p.id && s.ownerIds.includes(me))
      if (owned && isStale(view, p))
        items.push({
          id: `stale-${p.id}`,
          kind: 'pillar',
          action: `No update in ${daysSince(p.lastUpdated)} days: post one or confirm no change`,
          title: `${p.num}. ${p.name}`,
          to: `${base}/pillars/${p.id}`,
          rank: 4,
        })
    }
  }
  return items.sort((a, b) => a.rank - b.rank)
}

export type TodoGroup = { key: string; label: string; tone: 'bad' | 'warn' | 'normal' | 'muted'; items: Todo[] }

/** Buckets for the court list: overdue first, then by urgency, then things without a deadline. */
export function groupTodos(todos: Todo[]): TodoGroup[] {
  const groups: TodoGroup[] = [
    { key: 'overdue', label: 'Overdue', tone: 'bad', items: [] },
    { key: 'Critical', label: 'Critical', tone: 'bad', items: [] },
    { key: 'High', label: 'High', tone: 'warn', items: [] },
    { key: 'Standard', label: 'Standard', tone: 'normal', items: [] },
    { key: 'Low', label: 'Low', tone: 'muted', items: [] },
    { key: 'none', label: 'No deadline', tone: 'muted', items: [] },
  ]
  for (const t of todos) {
    const key = t.overdue ? 'overdue' : t.urgency ?? 'none'
    groups.find((g) => g.key === key)!.items.push(t)
  }
  return groups.filter((g) => g.items.length)
}
