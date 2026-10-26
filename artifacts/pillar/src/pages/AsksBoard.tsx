import { useState, type DragEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { CheckCircle2, ChevronDown, ChevronRight, Database, Flag, GripVertical, HelpCircle, Plus } from 'lucide-react'
import type { Ask } from '../lib/types'
import { URGENCIES } from '../lib/types'
import { isOverdue, sortAsks, useView } from '../lib/selectors'
import type { View } from '../lib/permissions'
import { fmtDate } from '../lib/dates'
import { COLUMNS, canDrag, columnOf, moveFor, type ColumnKey, type MoveKind } from '../lib/askBoard'
import { useStore } from '../lib/store'
import { Avatar, AvatarStack, AskStatusPill, Button, PageHeader, Segmented, Select, UrgencyBadge } from '../components/ui'
import { NewAskModal } from '../components/NewAsk'
import { AskMoveModal } from '../components/AskMoves'
import { ExportButton } from '../components/ExportButton'
import { asksWorkbook } from '../lib/exports'

const MGMT_COLUMNS: { key: string; label: string; hint: string; match: (a: Ask) => boolean }[] = [
  { key: 'you', label: 'Waiting on you', hint: 'Upload from the request page', match: (a) => a.status === 'Sent to management' },
  { key: 'team', label: 'With the deal team', hint: 'Nothing to do for now', match: (a) => a.status !== 'Sent to management' && a.status !== 'Closed' },
]

export default function AsksBoard() {
  const view = useView()
  const showToast = useStore((s) => s.showToast)
  const [type, setType] = useState<'all' | 'data_request' | 'question'>('all')
  const [urgency, setUrgency] = useState('')
  // The plan links here with ?pillar= (filter) and ?new=1 (start an ask for that pillar).
  const [params, setParams] = useSearchParams()
  const [pillar, setPillar] = useState(params.get('pillar') ?? '')
  const [assignee, setAssignee] = useState('')
  const [open, setOpen] = useState(params.get('new') === '1')
  const [showResolved, setShowResolved] = useState(false)
  const [dragging, setDragging] = useState<Ask | null>(null)
  const [pending, setPending] = useState<{ a: Ask; kind: MoveKind; to: ColumnKey } | null>(null)
  if (!view) return null
  const mgmt = view.viewer.isMgmt

  const filtered = sortAsks(
    view.asks.filter(
      (a) =>
        (type === 'all' || a.type === type) &&
        (!urgency || a.urgency === urgency) &&
        (!pillar || a.pillarId === pillar) &&
        (!assignee || a.assigneeIds.includes(assignee) || a.mgmtAssigneeId === assignee || (['Delivered', 'Answered'].includes(a.status) && a.createdBy === assignee)),
    ),
  )
  const overdue = filtered.filter((a) => a.status !== 'Closed' && isOverdue(a)).length
  const dealTeam = view.members.filter((m) => view.asks.some((a) => a.assigneeIds.includes(m.user.id) || a.mgmtAssigneeId === m.user.id || (['Delivered', 'Answered'].includes(a.status) && a.createdBy === m.user.id)))
  const byColumn = (key: ColumnKey) => filtered.filter((a) => columnOf(a) === key)
  const resolved = byColumn('resolved')
  const openCount = filtered.length - resolved.length
  const withMgmt = byColumn('mgmt').length
  const dragEnabled = !mgmt && view.asks.some((a) => canDrag(view, a))

  const drop = (to: ColumnKey) => (e: DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/ask') || dragging?.id
    const a = view.asks.find((x) => x.id === id)
    setDragging(null)
    if (!a) return
    const move = moveFor(view, a, to)
    if (!move) return
    if ('blocked' in move) showToast(move.blocked)
    else setPending({ a, kind: move.kind, to: move.to })
  }
  const dropState = (to: ColumnKey): 'idle' | 'ok' | 'no' => {
    if (!dragging) return 'idle'
    const move = moveFor(view, dragging, to)
    return !move || 'blocked' in move ? 'no' : 'ok'
  }

  return (
    <div>
      <PageHeader
        title={mgmt ? 'Data requests' : 'Asks'}
        subtitle={
          mgmt
            ? 'What the deal team has asked the company for. Open a request to upload the file.'
            : [
                `${openCount} open`,
                withMgmt ? `${withMgmt} with management` : null,
                overdue ? `${overdue} overdue` : null,
                dragEnabled ? 'Drag a card forward or back; you will be asked for the details on the way.' : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        actions={
          <>
            <ExportButton build={() => asksWorkbook(view, filtered, filtered.length === view.asks.length ? `All ${filtered.length} asks` : `${filtered.length} of ${view.asks.length} asks (current filters)`)} />
            {!mgmt && (
              <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
                New ask
              </Button>
            )}
          </>
        }
      />
      {!mgmt && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Segmented<'all' | 'data_request' | 'question'>
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'data_request', label: 'Data requests' },
              { value: 'question', label: 'Questions' },
            ]}
          />
          <Select value={urgency} onChange={setUrgency} options={[{ value: '', label: 'Any urgency' }, ...URGENCIES.map((u) => ({ value: u, label: u }))]} className="w-36" />
          <Select value={pillar} onChange={setPillar} options={[{ value: '', label: 'Any pillar' }, ...view.pillars.map((p) => ({ value: p.id, label: `${p.num}. ${p.name}` }))]} className="w-56" />
          <Select
            value={assignee}
            onChange={setAssignee}
            options={[{ value: '', label: 'Anyone' }, ...dealTeam.map((m) => ({ value: m.user.id, label: `${m.user.name} · ${m.user.title || m.role} (${m.role})` }))]}
            className="w-72 max-w-full"
          />
        </div>
      )}

      {mgmt ? (
        <div className="grid gap-4 md:grid-cols-2">
          {MGMT_COLUMNS.map((c) => {
            const cards = filtered.filter(c.match)
            return (
              <Column key={c.key} title={c.label} hint={c.hint} count={cards.length}>
                {cards.map((a) => (
                  <AskCard key={a.id} view={view} a={a} showStatus />
                ))}
              </Column>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => {
            const cards = byColumn(c.key)
            return (
              <Column key={c.key} title={c.label} hint={c.hint} count={cards.length} drop={dropState(c.key)} onDragOver={(e) => e.preventDefault()} onDrop={drop(c.key)}>
                {cards.map((a) => (
                  <AskCard
                    key={a.id}
                    view={view}
                    a={a}
                    showStatus={c.key === 'team'}
                    draggable={canDrag(view, a)}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/ask', a.id)
                      setDragging(a)
                    }}
                    onDragEnd={() => setDragging(null)}
                  />
                ))}
              </Column>
            )
          })}
        </div>
      )}

      {/* Resolved: out of the way until someone wants it, but a drop target while dragging. */}
      <section
        className={clsx('mt-5 rounded-lg border transition', dropState('resolved') === 'ok' ? 'border-accent bg-accent-soft/50 ring-2 ring-accent/30' : 'border-zinc-200 bg-white')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={drop('resolved')}
      >
        <button
          onClick={() => setShowResolved((v) => !v)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50"
          aria-expanded={showResolved}
        >
          {showResolved ? <ChevronDown className="size-4 text-zinc-400" /> : <ChevronRight className="size-4 text-zinc-400" />}
          <CheckCircle2 className="size-4 text-green-600" />
          Resolved
          <span className="tabular rounded bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600">{resolved.length}</span>
          <span className="ml-auto text-xs font-normal text-zinc-400">
            {dragging && dropState('resolved') === 'ok' ? 'Drop here to resolve' : showResolved ? 'Hide' : 'Show'}
          </span>
        </button>
        {showResolved && (
          <div className="grid gap-2 border-t border-zinc-100 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {resolved.map((a) => (
              <AskCard
                key={a.id}
                view={view}
                a={a}
                draggable={canDrag(view, a)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/ask', a.id)
                  setDragging(a)
                }}
                onDragEnd={() => setDragging(null)}
              />
            ))}
            {!resolved.length && <div className="text-[13px] text-zinc-400">Nothing resolved yet{filtered.length !== view.asks.length ? ' with these filters' : ''}.</div>}
          </div>
        )}
      </section>

      <NewAskModal
        view={view}
        open={open}
        defaultPillarId={params.get('pillar') ?? undefined}
        onClose={() => {
          setOpen(false)
          if (params.has('new')) setParams((q) => (q.delete('new'), q), { replace: true })
        }}
      />
      {pending && <AskMoveModal key={pending.a.id + pending.kind + pending.to} view={view} a={pending.a} kind={pending.kind} to={pending.to} onClose={() => setPending(null)} />}
    </div>
  )
}

function Column({
  title,
  hint,
  count,
  children,
  drop = 'idle',
  onDragOver,
  onDrop,
}: {
  title: string
  hint?: string
  count: number
  children: React.ReactNode
  drop?: 'idle' | 'ok' | 'no'
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
}) {
  return (
    <div className="min-w-0" onDragOver={onDragOver} onDrop={onDrop}>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-[13px] font-semibold text-zinc-800">{title}</h2>
        <span className="tabular rounded bg-zinc-200/70 px-1.5 text-[11px] font-medium text-zinc-600">{count}</span>
      </div>
      {hint && <div className="mb-2 px-1 text-[11.5px] text-zinc-400">{hint}</div>}
      <div
        className={clsx(
          'min-h-[140px] space-y-2 rounded-lg p-2 transition',
          drop === 'ok' ? 'bg-accent-soft/70 ring-2 ring-accent/50' : drop === 'no' ? 'bg-zinc-100/40 opacity-60' : 'bg-zinc-100/70',
        )}
      >
        {children}
        {count === 0 && <div className="px-2 py-8 text-center text-[13px] text-zinc-400">{drop === 'ok' ? 'Drop here' : 'Nothing here'}</div>}
      </div>
    </div>
  )
}

function AskCard({
  view,
  a,
  showStatus,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  view: View
  a: Ask
  showStatus?: boolean
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragEnd?: () => void
}) {
  const mgmt = view.viewer.isMgmt
  const closed = a.status === 'Closed'
  const delivered = a.status === 'Delivered' || a.status === 'Answered'
  const od = !closed && isOverdue(a)
  const p = view.pillars.find((x) => x.id === a.pillarId)
  // Whose court it is in right now; resolved asks just show who asked.
  const ownerIds = closed ? [a.createdBy] : a.status === 'Sent to management' ? [a.mgmtAssigneeId] : delivered ? [a.createdBy] : a.assigneeIds
  const owners = ownerIds.map((id) => view.members.find((m) => m.user.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  const owner = owners[0]
  const creator = view.members.find((m) => m.user.id === a.createdBy)
  const courtNote = closed ? 'Asked for it' : a.status === 'Sent to management' ? 'Uploading the file' : delivered ? 'Checking the result' : a.status === 'New' || a.status === 'Open' ? 'Next to pick it up' : 'Working on it'
  const flagged = a.flaggedToMd && !a.flagResolvedAt && !mgmt
  return (
    <Link
      to={`/c/${view.company.id}/asks/${a.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={clsx(
        'group block rounded-md border bg-white p-2.5 shadow-xs transition hover:shadow-sm',
        od ? 'border-red-300' : 'border-zinc-200',
        draggable && 'cursor-grab active:cursor-grabbing',
        closed && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-1.5">
        {a.type === 'question' ? <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-zinc-400" /> : <Database className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />}
        <div className="min-w-0 flex-1 break-words text-[13px] leading-snug font-medium">{a.title}</div>
        {draggable && <GripVertical className="size-3.5 shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100" aria-hidden />}
      </div>
      {p && (
        <div className="mt-1 truncate text-[11.5px] text-zinc-500">
          {p.num}. {p.name}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <UrgencyBadge urgency={a.urgency} />
        {showStatus && <AskStatusPill status={a.status} mgmt={mgmt} />}
        {flagged && (
          <span className="inline-flex h-5 items-center gap-1 rounded bg-red-100 px-1.5 text-[11px] font-medium text-red-700" title="Flagged to the MD">
            <Flag className="size-3" /> MD
          </span>
        )}
      </div>
      <div className="mt-2 border-t border-zinc-100 pt-2">
        <div className="flex items-center gap-1.5">
          {owner && !(mgmt && owner.role === 'Management') ? (
            <>
              {owners.length > 1 ? <AvatarStack names={owners.map((m) => m.user.name)} size={22} /> : <Avatar name={owner.user.name} size={22} />}
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12px] font-medium text-zinc-800">{owners.length > 1 ? owners.map((m) => m.user.name.split(' ')[0]).join(', ') : owner.user.name}</div>
                <div className="truncate text-[11px] text-zinc-500">
                  {courtNote}
                  {owners.length === 1 && ` · ${owner.user.title || owner.role}`}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1" />
          )}
          {closed ? (
            a.closedAt && <span className="tabular shrink-0 text-[11px] text-zinc-400">Resolved {fmtDate(a.closedAt)}</span>
          ) : delivered ? (
            <span className="tabular shrink-0 rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700">
              {a.status} {fmtDate(a.history.at(-1)?.at)}
            </span>
          ) : (
            <span className={clsx('tabular shrink-0 rounded px-1.5 py-0.5 text-[11px]', od ? 'bg-red-50 font-semibold text-red-700' : 'bg-zinc-50 text-zinc-500')}>
              {od ? 'Overdue · ' : 'Due '}
              {fmtDate(a.dueDate)}
            </span>
          )}
        </div>
        {creator && !ownerIds.includes(creator.user.id) && <div className="mt-1 truncate text-[11px] text-zinc-400">Asked by {creator.user.name}</div>}
      </div>
    </Link>
  )
}
