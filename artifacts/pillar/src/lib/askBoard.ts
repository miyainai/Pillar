// Kanban rules for the Asks board: which column an ask sits in, and what dragging it somewhere means.

import type { Ask, AskStatus } from './types'
import type { View } from './permissions'

export type ColumnKey = 'new' | 'team' | 'mgmt' | 'delivered' | 'resolved'

export const COLUMNS: { key: Exclude<ColumnKey, 'resolved'>; label: string; hint: string }[] = [
  { key: 'new', label: 'New', hint: 'Nobody has picked these up yet' },
  { key: 'team', label: 'With deal team', hint: 'Being worked on inside the firm' },
  { key: 'mgmt', label: 'With management', hint: 'Waiting on the company to upload' },
  { key: 'delivered', label: 'Delivered', hint: 'Back with whoever asked, to check and resolve' },
]

const ORDER: ColumnKey[] = ['new', 'team', 'mgmt', 'delivered', 'resolved']

export function columnOf(a: Ask): ColumnKey {
  switch (a.status) {
    case 'New':
    case 'Open':
      return 'new'
    case 'In progress':
    case 'Data received':
      return 'team'
    case 'Sent to management':
      return 'mgmt'
    case 'Delivered':
    case 'Answered':
      return 'delivered'
    case 'Closed':
      return 'resolved'
  }
}

export function columnLabel(key: ColumnKey): string {
  return key === 'resolved' ? 'Resolved' : COLUMNS.find((c) => c.key === key)!.label
}

/** The status an ask gets when it is moved back to an earlier column. */
export function statusForColumn(a: Ask, to: Exclude<ColumnKey, 'mgmt' | 'resolved'>): AskStatus {
  const q = a.type === 'question'
  if (to === 'new') return q ? 'Open' : 'New'
  if (to === 'team') return 'In progress'
  return q ? 'Answered' : 'Delivered'
}

/**
 * What a drop asks the user for. Each kind has its own small form.
 * `back` is any move to an earlier column: it always asks why and what happens next.
 */
export type MoveKind = 'pickup' | 'route' | 'deliver' | 'answer' | 'resolve' | 'back'

export type Move = { kind: MoveKind; to: ColumnKey } | { blocked: string }

/** Can this viewer drag this card at all? */
export function canDrag(view: View, a: Ask): boolean {
  if (view.viewer.isMgmt) return false
  if (view.viewer.canTriageAsks) return true
  return columnOf(a) === 'delivered' && a.createdBy === view.viewer.user.id
}

/** What happens if `a` is dropped on column `to`, or why it cannot be. */
export function moveFor(view: View, a: Ask, to: ColumnKey): Move | null {
  const from = columnOf(a)
  if (from === to) return null
  const q = a.type === 'question'
  const backward = ORDER.indexOf(to) < ORDER.indexOf(from)
  if (!view.viewer.canTriageAsks) {
    const mine = from === 'delivered' && a.createdBy === view.viewer.user.id
    if (mine && to === 'resolved') return { kind: 'resolve', to }
    if (mine && to === 'team') return { kind: 'back', to }
    return { blocked: 'Only the deal team moves asks. Once yours is delivered you can resolve it, or send it back to the deal team.' }
  }
  if (backward) {
    if (to === 'mgmt') return { blocked: 'To ask management again, move it to With deal team first, then send it from there.' }
    return { kind: 'back', to }
  }
  switch (to) {
    case 'team':
      return { kind: 'pickup', to }
    case 'mgmt':
      if (q) return { blocked: 'Questions stay inside the firm. Answer it, or drop it on Delivered.' }
      return { kind: 'route', to }
    case 'delivered':
      if (from === 'mgmt') return { blocked: 'Management has not uploaded yet. Once their file arrives it moves back to the deal team, and you can deliver from there.' }
      return { kind: q ? 'answer' : 'deliver', to }
    case 'resolved':
      return { kind: 'resolve', to }
    default:
      return null
  }
}

export const RESOLVE_REASONS = ['Got what we needed', 'Answered in conversation', 'No longer needed', 'Duplicate of another ask', 'Other'] as const

export const BACK_REASONS = ['Not what we needed', 'Needs more work', 'Picked up by mistake', 'Reopening', 'Other'] as const
