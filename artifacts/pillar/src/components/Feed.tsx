import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Flag } from 'lucide-react'
import { AttachmentRow } from './AttachmentRow'
import type { View } from '../lib/permissions'
import type { Activity, Update } from '../lib/types'
import { useStore } from '../lib/store'
import { userName } from '../lib/selectors'
import { relTime, fmtDate } from '../lib/dates'
import { Avatar, Button, Modal, StatusPill, VisibilityBadge, inputCls } from './ui'

/**
 * One update in a feed. Pass `anchor` on pages that deep-link to updates (`#<updateId>`): the
 * row gets the update id as its element id and `highlighted` flashes it briefly on arrival.
 */
export function UpdateItem({ view, u, showTarget = true, anchor = false, highlighted = false }: { view: View; u: Update; showTarget?: boolean; anchor?: boolean; highlighted?: boolean }) {
  const flagToMd = useStore((s) => s.flagToMd)
  const [flagOpen, setFlagOpen] = useState(false)
  const [note, setNote] = useState('')
  const pillar = view.pillars.find((p) => p.id === u.pillarId)
  const sub = view.subPillars.find((s) => s.id === u.subPillarId)
  const phase = view.phases.find((p) => p.id === u.phaseId)
  const author = userName(view, u.authorId)
  const canFlag = view.viewer.canTriageAsks && view.viewer.role !== 'MD' && !(u.flaggedToMd && !u.flagResolvedAt)

  return (
    <div
      id={anchor ? u.id : undefined}
      data-highlighted={highlighted || undefined}
      className={`group flex gap-2.5 py-2.5 transition-[background-color,box-shadow] duration-700 ${highlighted ? 'rounded-md bg-accent-soft shadow-[0_0_0_4px_var(--color-accent-soft)]' : ''}`}
    >
      <Avatar name={author} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-medium text-zinc-800">{author}</span>
          {showTarget && pillar && (
            <Link to={`/c/${view.company.id}/pillars/${pillar.id}`} className="truncate text-zinc-500 hover:text-zinc-800 hover:underline">
              {sub ? `${sub.num} ${sub.name}` : `${pillar.num}. ${pillar.name}`}
            </Link>
          )}
          <span className="text-zinc-400" title={new Date(u.createdAt).toLocaleString()}>
            {relTime(u.createdAt)}
          </span>
          {!view.viewer.isMgmt && <VisibilityBadge visibility={u.visibility} post />}
          {u.flaggedToMd && !u.flagResolvedAt && !view.viewer.isMgmt && (
            <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 text-[11px] font-medium text-red-700">
              <Flag className="size-3" /> Flagged to MD
            </span>
          )}
        </div>
        <p className={u.noChange ? 'mt-0.5 text-[13px] text-zinc-400 italic' : 'mt-0.5 text-[13px] text-zinc-800'}>{u.text}</p>
        {(u.statusChange || u.capturedChange || u.phaseCompleted || u.attachments.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
            {u.statusChange && (
              <span className="inline-flex items-center gap-1">
                <StatusPill status={u.statusChange.from} />
                <ArrowRight className="size-3 text-zinc-400" />
                <StatusPill status={u.statusChange.to} />
              </span>
            )}
            {u.capturedChange && (
              <span className="tabular rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-700">
                Captured ${u.capturedChange.from.toFixed(1)}M → ${u.capturedChange.to.toFixed(1)}M
              </span>
            )}
            {u.phaseCompleted && phase && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                <CheckCircle2 className="size-3" /> {phase.name} complete
              </span>
            )}
            {u.attachments.map((a) => (
              <AttachmentRow key={a.id} view={view} file={a} about={u.text} compact />
            ))}
          </div>
        )}
        {u.phaseCompleted?.next && <p className="mt-1 text-xs text-zinc-500">Next: {u.phaseCompleted.next}</p>}
        {u.flaggedToMd && u.flagNote && !u.flagResolvedAt && !view.viewer.isMgmt && <p className="mt-1 text-xs text-red-700">Flag: {u.flagNote}</p>}
      </div>
      {canFlag && (
        <button onClick={() => setFlagOpen(true)} className="h-6 shrink-0 self-start rounded px-1.5 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-red-600" title="Flag to MD">
          <Flag className="size-3.5" />
        </button>
      )}
      <Modal
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        title="Flag update to MD"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFlagOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!note.trim()}
              onClick={() => {
                flagToMd('update', u.id, note)
                setFlagOpen(false)
              }}
            >
              Flag to MD
            </Button>
          </>
        }
      >
        <p className="mb-2 text-zinc-600">It will sit at the top of the MD's dashboard until resolved.</p>
        <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What call do you need from the MD?" className={inputCls} />
      </Modal>
    </div>
  )
}

/** One line in a "changes since your last visit" style feed. */
export function ActivityLine({ view, a }: { view: View; a: Activity }) {
  const target = describeObject(view, a)
  const detail =
    a.field === 'status' && a.oldValue !== undefined && (a.objectType === 'pillar' || a.objectType === 'subPillar') ? (
      <span className="inline-flex items-center gap-1">
        <StatusPill status={String(a.oldValue)} /> <ArrowRight className="size-3 text-zinc-400" /> <StatusPill status={String(a.newValue)} />
      </span>
    ) : a.field === 'captured' ? (
      <span className="tabular text-green-700">
        ${Number(a.oldValue).toFixed(1)}M → ${Number(a.newValue).toFixed(1)}M
      </span>
    ) : null
  return (
    <div className="flex items-start gap-2 py-1.5 text-[12.5px]">
      <Avatar name={userName(view, a.actorId)} size={18} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{userName(view, a.actorId).split(' ')[0]}</span> <span className="text-zinc-500">{a.action}</span>{' '}
        {target && (
          <Link to={target.href} className="text-zinc-800 hover:underline">
            {target.label}
          </Link>
        )}{' '}
        {detail}
      </div>
      <span className="shrink-0 text-[11px] text-zinc-400" title={fmtDate(a.at)}>
        {relTime(a.at)}
      </span>
    </div>
  )
}

function describeObject(view: View, a: Activity): { label: string; href: string } | null {
  const base = `/c/${view.company.id}`
  switch (a.objectType) {
    case 'pillar': {
      const p = view.pillars.find((x) => x.id === a.objectId)
      return p ? { label: p.name, href: `${base}/pillars/${p.id}` } : null
    }
    case 'subPillar': {
      const s = view.subPillars.find((x) => x.id === a.objectId)
      return s ? { label: s.name, href: `${base}/pillars/${s.pillarId}` } : null
    }
    case 'phase': {
      const ph = view.phases.find((x) => x.id === a.objectId)
      return ph ? { label: ph.name, href: `${base}/pillars/${ph.pillarId}` } : null
    }
    case 'kpi': {
      const k = view.kpis.find((x) => x.id === a.objectId)
      return k ? { label: k.name, href: `${base}/pillars/${k.pillarId}` } : null
    }
    case 'update': {
      const u = view.updates.find((x) => x.id === a.objectId)
      const p = u && view.pillars.find((x) => x.id === u.pillarId)
      return p ? { label: `on ${p.name}`, href: `${base}/pillars/${p.id}` } : null
    }
    case 'ask': {
      const k = view.asks.find((x) => x.id === a.objectId)
      return k ? { label: k.title, href: `${base}/asks/${k.id}` } : null
    }
    case 'vcp':
      return { label: '', href: `${base}/plan` }
    default:
      return null
  }
}
