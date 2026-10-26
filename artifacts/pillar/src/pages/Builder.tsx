import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  GitBranch,
  GripVertical,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { onPlan, type PillarView, type SubPillarView, type View } from '../lib/permissions'
import { PHASE_STATUSES, PLAN_STATUSES, type Phase, type PhaseStatus, type PlanStatus } from '../lib/types'
import { fmtKpi, isPlanLocked, latestVersion, planTotals, useView, userName } from '../lib/selectors'
import { fmtDate, fmtDateYear, fromInputDate, toInputDate } from '../lib/dates'
import { pillarColor } from '../lib/colors'
import { planWorkbook } from '../lib/exports'
import { ExportButton } from '../components/ExportButton'
import { normalizePlan, regenerate, type Person, type RawPillar, type RawSub } from '../lib/ai'
import {
  Avatar,
  AvatarStack,
  Button,
  Empty,
  InlineNumber,
  InlineText,
  MenuItem,
  Modal,
  Popover,
  ProgressBar,
  Select,
  StatusPill,
  VisibilityBadge,
  VisibilityToggle,
  inputCls,
} from '../components/ui'
import { PhaseTimeline, TimelineAxis, timelineRange } from '../components/PhaseTimeline'
import { UpdateCapturedModal, type CapturedTarget } from '../components/UpdateCaptured'

export default function Builder() {
  const view = useView()
  const addPillar = useStore((s) => s.addPillar)
  const reorderPillars = useStore((s) => s.reorderPillars)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({})
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  if (!view) return null

  const { viewer, company } = view
  const version = latestVersion(view)
  const locked = isPlanLocked(view)
  const canEdit = viewer.canEditPlan
  const structural = canEdit && !locked
  const totals = planTotals(view)
  const offBy = Math.round((totals.target - totals.gap) * 10) / 10
  const isOpen = (id: string) => expanded[id] ?? false
  const setAll = (open: boolean) => {
    setExpanded(Object.fromEntries(view.pillars.map((p) => [p.id, open])))
    if (!open) setOpenSubs({})
  }

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const ids = view.pillars.map((p) => p.id).filter((id) => id !== dragId)
    ids.splice(ids.indexOf(targetId), 0, dragId)
    reorderPillars(company.id, ids)
    setDragId(null)
  }

  const behind = !onPlan(totals.captured, totals.planToDate)
  const vsPlan = Math.round((totals.captured - totals.planToDate) * 10) / 10

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{viewer.isMgmt ? 'Shared plan' : 'Value creation plan'}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-500">
            <span>
              {company.name} · {view.pillars.length} pillars, {view.subPillars.length} sub-pillars
            </span>
            {version ? (
              locked ? (
                <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 text-[12px] font-medium text-zinc-700">
                  <Lock className="size-3" /> v{version.version} · locked {fmtDateYear(version.lockedAt)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 text-[12px] font-medium text-amber-700">Draft v{version.version}</span>
              )
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setAll(false)}>
            Consolidate all
          </Button>
          <Button variant="ghost" onClick={() => setAll(true)}>
            Expand all
          </Button>
          <ExportButton build={() => planWorkbook(view)} />
          {canEdit && locked && (
            <Button icon={<GitBranch className="size-3.5" />} onClick={() => setRevisionOpen(true)}>
              Revise plan
            </Button>
          )}
          {structural && (
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => addPillar(company.id)}>
              Add pillar
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeadStat icon={<Target className="size-4" />} label="Target EBITDA impact" value={`$${totals.target.toFixed(1)}M`} sub={viewer.isMgmt ? 'Across shared pillars, run-rate' : `Covers the $${totals.gap.toFixed(1)}M entry-to-exit gap`} />
        <HeadStat icon={<CalendarCheck className="size-4" />} label="Plan to date" value={`$${totals.planToDate.toFixed(1)}M`} sub="What should have landed by today" />
        <HeadStat
          icon={<TrendingUp className="size-4" />}
          label="Captured to date"
          value={`$${totals.captured.toFixed(1)}M`}
          tone={behind ? 'bad' : 'good'}
          sub={behind ? `$${Math.abs(vsPlan).toFixed(1)}M behind plan` : vsPlan > 0.05 ? `$${vsPlan.toFixed(1)}M ahead of plan` : 'On plan'}
        />
        <div className="rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-xs">
          <div className="flex items-baseline justify-between">
            <span className="tabular text-[20px] font-semibold tracking-tight text-zinc-900">{Math.round(totals.pct * 100)}%</span>
            <span className="text-[11.5px] font-medium tracking-wide text-zinc-500 uppercase">Realized</span>
          </div>
          <ProgressBar value={totals.captured} max={totals.target} className="mt-2 h-2" />
          <div className="mt-1 text-xs text-zinc-500">of the ${totals.target.toFixed(1)}M target</div>
        </div>
      </div>


      {viewer.isFirm && <AlignmentPanel view={view} />}

      {viewer.isFirm && Math.abs(offBy) > Math.max(0.5, totals.gap * 0.05) && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          Pillar targets sum to ${totals.target.toFixed(1)}M, {offBy > 0 ? 'over' : 'short of'} the ${totals.gap.toFixed(1)}M gap from entry (${company.entryEbitda}M) to underwritten exit (${company.exitEbitda}M) by $
          {Math.abs(offBy).toFixed(1)}M.
        </div>
      )}

      {!canEdit && viewer.isFirm && (
        <p className="mb-3 text-xs text-zinc-500">The deal team edits the plan. Post progress from your dashboard or a pillar page.</p>
      )}

      <div className="space-y-3">
        {view.pillars.map((p) => (
          <PillarCard
            key={p.id}
            view={view}
            p={p}
            open={isOpen(p.id)}
            openSubs={openSubs}
            setOpenSubs={setOpenSubs}
            onToggle={() => setExpanded((e) => ({ ...e, [p.id]: !isOpen(p.id) }))}
            canEdit={canEdit}
            structural={structural}
            dragging={dragId === p.id}
            onDragStart={() => setDragId(p.id)}
            onDrop={() => onDrop(p.id)}
          />
        ))}
        {!view.pillars.length && <Empty>No pillars yet.</Empty>}
      </div>

      <RevisionModal view={view} open={revisionOpen} onClose={() => setRevisionOpen(false)} />
    </div>
  )
}

// ---------------------------------------------------------------- Alignment

function AlignmentPanel({ view }: { view: View }) {
  const requestAlignment = useStore((s) => s.requestAlignment)
  const signOff = useStore((s) => s.signOff)
  const version = latestVersion(view)
  if (!version) return null
  const me = view.viewer.user.id
  if (version.lockedAt) {
    return (
      <details className="mb-4 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-[13px]">
        <summary className="cursor-pointer text-zinc-600">
          <span className="font-medium text-zinc-800">Aligned.</span> VCP v{version.version} signed off by {version.signOffs.length} approvers and locked {fmtDateYear(version.lockedAt)}.
          {version.changeNote && <span className="text-zinc-500"> “{version.changeNote}”</span>}
        </summary>
        <div className="mt-2 flex flex-wrap gap-3">
          {version.signOffs.map((s) => (
            <span key={s.userId} className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
              <Avatar name={userName(view, s.userId)} size={18} /> {userName(view, s.userId)} · {fmtDate(s.at)}
            </span>
          ))}
        </div>
        {view.vcpVersions.length > 1 && (
          <div className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
            History:{' '}
            {view.vcpVersions.map((v) => (
              <span key={v.id} className="mr-3">
                v{v.version} ({fmtDateYear(v.lockedAt ?? v.createdAt)}): {v.changeNote}
              </span>
            ))}
          </div>
        )}
      </details>
    )
  }
  const requested = !!version.alignmentRequestedAt && version.approverIds.length > 0
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-amber-900">Draft · VCP v{version.version} is not yet aligned</div>
          <div className="text-xs text-amber-800">
            {requested
              ? `${version.signOffs.length} of ${version.approverIds.length} sign-offs. The plan locks when everyone has signed.`
              : 'Edit, reorder, set visibility, and assign owners. Then request alignment from the MD, VP, and assigned OPs.'}
            {version.changeNote && <> Change note: “{version.changeNote}”</>}
          </div>
        </div>
        {view.viewer.canEditPlan && (
          <Button variant={requested ? 'secondary' : 'primary'} onClick={() => requestAlignment(view.company.id)}>
            {requested ? 'Re-request alignment' : 'Request alignment'}
          </Button>
        )}
        {requested && version.approverIds.includes(me) && !version.signOffs.some((s) => s.userId === me) && (
          <Button variant="primary" icon={<CheckCircle2 className="size-3.5" />} onClick={() => signOff(version.id)}>
            Sign off
          </Button>
        )}
      </div>
      {requested && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {version.approverIds.map((id) => {
            const s = version.signOffs.find((x) => x.userId === id)
            return (
              <span key={id} className={clsx('inline-flex h-6 items-center gap-1.5 rounded-full border bg-white pr-2 pl-0.5 text-xs', s ? 'border-green-200 text-green-800' : 'border-zinc-200 text-zinc-600')}>
                <Avatar name={userName(view, id)} size={20} />
                {userName(view, id)}
                {s ? <CheckCircle2 className="size-3.5 text-green-600" /> : <Circle className="size-3.5 text-zinc-300" />}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RevisionModal({ view, open, onClose }: { view: View; open: boolean; onClose: () => void }) {
  const startRevision = useStore((s) => s.startRevision)
  const [note, setNote] = useState('')
  const next = (latestVersion(view)?.version ?? 0) + 1
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Start VCP v${next}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!note.trim()}
            onClick={() => {
              startRevision(view.company.id, note.trim())
              setNote('')
              onClose()
            }}
          >
            Start revision
          </Button>
        </>
      }
    >
      <p className="mb-2 text-zinc-600">Adding or retiring pillars creates a new version that needs alignment again. Status, owners, and updates keep flowing while you edit.</p>
      <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Change note, e.g. Added integration pillar after the Crisp & Co. add-on." />
    </Modal>
  )
}

// ---------------------------------------------------------------- Pillar card

function PillarCard({
  view,
  p,
  open,
  openSubs,
  setOpenSubs,
  onToggle,
  canEdit,
  structural,
  dragging,
  onDragStart,
  onDrop,
}: {
  view: View
  p: PillarView
  open: boolean
  openSubs: Record<string, boolean>
  setOpenSubs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onToggle: () => void
  canEdit: boolean
  structural: boolean
  dragging: boolean
  onDragStart: () => void
  onDrop: () => void
}) {
  const s = useStore()
  const [armed, setArmed] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [capturedFor, setCapturedFor] = useState<CapturedTarget | null>(null)
  const subs = view.subPillars.filter((x) => x.pillarId === p.id)
  const directPhases = view.phases.filter((ph) => ph.pillarId === p.id && !ph.subPillarId)
  const directKpis = view.kpis.filter((k) => k.pillarId === p.id && !k.subPillarId)
  const mgmt = view.viewer.isMgmt
  // One time axis for every sub-pillar in this pillar, so bars line up and "today" is in the same place.
  const axis = timelineRange(view.phases.filter((ph) => ph.pillarId === p.id))

  return (
    <section
      draggable={armed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={() => setArmed(false)}
      onDragOver={(e) => structural && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop()
        setArmed(false)
      }}
      style={{ borderLeftColor: pillarColor(p.num), borderLeftWidth: 4 }}
      className={clsx('rounded-lg border bg-white shadow-xs transition', dragging ? 'border-accent opacity-60' : 'border-zinc-200')}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        {structural && (
          <span onMouseDown={() => setArmed(true)} onMouseUp={() => setArmed(false)} className="-mr-1 cursor-grab text-zinc-300 hover:text-zinc-500" title="Drag to reorder">
            <GripVertical className="size-4" />
          </span>
        )}
        <button onClick={onToggle} className="text-zinc-400 hover:text-zinc-700" aria-label={`${open ? 'Consolidate' : 'Expand'} ${p.name}`} aria-expanded={open}>
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span className="grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold" style={{ background: `${pillarColor(p.num)}1f`, color: pillarColor(p.num) }}>
          {p.num}
        </span>
        <div className="min-w-[200px] flex-1">
          <div className="text-[14px] font-semibold">
            <InlineText value={p.name} disabled={!canEdit} onSave={(v) => s.updatePillar(p.id, { name: v })} />
          </div>
          {!open && p.objective && <div className="max-w-[560px] truncate text-xs text-zinc-500">{p.objective}</div>}
        </div>
        <div className="tabular w-[72px] shrink-0 text-right">
          <div className="text-[14px] font-semibold text-zinc-900">
            {p.hasSubs || !structural ? (
              <span>${p.target.toFixed(1)}M</span>
            ) : (
              <InlineNumber value={p.targetImpact} onSave={(v) => s.updatePillar(p.id, { targetImpact: v })} />
            )}
          </div>
          <div className="text-[11px] text-zinc-500">Target</div>
        </div>
        {p.target > 0 && (
          <div className="tabular w-[72px] shrink-0 text-right">
            <div className="text-[14px] font-semibold text-zinc-600">${p.planToDate.toFixed(1)}M</div>
            <div className="text-[11px] text-zinc-500">Plan to date</div>
          </div>
        )}
        <div className="tabular w-[72px] shrink-0 text-right">
          {p.hasSubs || p.target === 0 ? (
            <CapturedFigure captured={p.captured} plan={p.planToDate} enabler={p.target === 0} size="lg" />
          ) : (
            <CapturedFigure captured={p.captured} plan={p.planToDate} size="lg" onEdit={view.viewer.canPostUpdates ? () => setCapturedFor({ pillar: p }) : undefined} />
          )}
          <div className="text-[11px] text-zinc-500">Captured</div>
        </div>
        {p.target > 0 && (
          <div className="hidden w-[64px] shrink-0 xl:block" title={`${Math.round((p.captured / p.target) * 100)}% of target realized`}>
            <div className="tabular text-right text-[11px] text-zinc-500">{Math.round((p.captured / p.target) * 100)}%</div>
            <ProgressBar value={p.captured} max={p.target} className="mt-0.5" />
          </div>
        )}
        <div className="w-[150px] shrink-0">
          <OwnerPicker view={view} ownerIds={p.ownerIds} disabled={!canEdit} showName onChange={(ids) => s.updatePillar(p.id, { ownerIds: ids })} />
        </div>
        <div className="flex w-[90px] shrink-0 justify-center">
        {view.viewer.isFirm ? (
          <StatusSelect value={p.status} disabled={!view.viewer.isFirm} onChange={(st) => s.setPlanStatus('pillar', p.id, st)} />
        ) : (
          <StatusPill status={p.status} />
        )}
        </div>
        <div className="flex w-[175px] shrink-0 items-center justify-end gap-1">
        {!mgmt &&
          (canEdit ? (
            <VisibilityToggle value={p.visibility} onChange={(v) => s.setVisibility('pillar', p.id, v)} />
          ) : (
            <VisibilityBadge visibility={p.visibility} />
          ))}
        {canEdit && (
          <Popover
            align="right"
            width={220}
            trigger={(_, toggle) => (
              <button onClick={toggle} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="More">
                <MoreHorizontal className="size-4" />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem icon={<FileText className="size-3.5 text-zinc-500" />} onClick={() => close()}>
                  <Link to={`/c/${view.company.id}/pillars/${p.id}`}>Open pillar page</Link>
                </MenuItem>
                {structural && (
                  <MenuItem
                    icon={<Sparkles className="size-3.5 text-accent" />}
                    onClick={() => {
                      close()
                      setRegenOpen(true)
                    }}
                  >
                    Regenerate with instruction
                  </MenuItem>
                )}
                {structural && (
                  <MenuItem
                    icon={<Plus className="size-3.5 text-zinc-500" />}
                    onClick={() => {
                      close()
                      s.addSubPillar(p.id)
                    }}
                  >
                    Add sub-pillar
                  </MenuItem>
                )}
                {structural && !p.hasSubs && (
                  <MenuItem
                    icon={<Plus className="size-3.5 text-zinc-500" />}
                    onClick={() => {
                      close()
                      s.addPhase(p.id, null)
                    }}
                  >
                    Add phase
                  </MenuItem>
                )}
                {structural && (
                  <MenuItem
                    icon={<Trash2 className="size-3.5 text-red-500" />}
                    onClick={() => {
                      close()
                      if (confirm(`Delete pillar "${p.name}" and everything under it?`)) s.deletePillar(p.id)
                    }}
                  >
                    <span className="text-red-600">Delete pillar</span>
                  </MenuItem>
                )}
              </>
            )}
          </Popover>
        )}
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-100 px-3 pt-2.5 pb-3 sm:pl-[68px]">
          <div className="space-y-2 text-[13px]">
            <div>
              <span className="text-xs font-medium text-zinc-500">Objective </span>
              <InlineText multiline value={p.objective} disabled={!canEdit} onSave={(v) => s.updatePillar(p.id, { objective: v })} className="text-zinc-800" />
            </div>
            {!mgmt && (
              <details className="text-zinc-600">
                <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-800">Investment rationale &amp; source</summary>
                <div className="mt-2 max-w-3xl border-l-2 border-zinc-200 pl-3">
                <InlineText multiline value={p.rationale} disabled={!canEdit} onSave={(v) => s.updatePillar(p.id, { rationale: v })} className="text-zinc-700" />
                {(p.sourceRef || canEdit) && (
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                    <FileText className="size-3" /> Source:{' '}
                    <InlineText value={p.sourceRef} disabled={!canEdit} onSave={(v) => s.updatePillar(p.id, { sourceRef: v })} placeholder="Add document and page" className="text-zinc-600" />
                  </div>
                )}
                </div>
              </details>
            )}
          </div>

          {subs.length > 0 && (
            <div className="mt-3 rounded-md border border-zinc-100">
              <div className={clsx('hidden gap-x-3 rounded-t-md border-b border-zinc-100 bg-zinc-50 px-2.5 py-2 text-[10.5px] font-medium text-zinc-500 lg:grid', SUB_GRID)}>
                <span className="w-3.5" />
                <span>Sub-pillar</span>
                <span className="self-end">{axis ? <TimelineAxis range={axis} /> : 'Timeline'}</span>
                <span>EBITDA impact, run-rate</span>
                <span>Owner</span>
                <span>Status</span>
                <span className="text-right">{!mgmt && 'Access'}</span>
              </div>
              {subs.map((sp) => (
                <SubPillarRow
                  key={sp.id}
                  view={view}
                  sp={sp}
                  open={!!openSubs[sp.id]}
                  onToggle={() => setOpenSubs((o) => ({ ...o, [sp.id]: !o[sp.id] }))}
                  canEdit={canEdit}
                  structural={structural}
                  siblings={subs}
                  axis={axis}
                  onUpdateCaptured={view.viewer.canPostUpdates ? () => setCapturedFor({ pillar: p, sub: sp }) : undefined}
                />
              ))}
            </div>
          )}

          {!subs.length && (
            <div className="mt-3 rounded-md border border-zinc-100 p-2.5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>Phases {p.target === 0 && <span className="font-normal text-zinc-400">· enabler, no direct EBITDA</span>}</span>
              </div>
              <PhaseTimeline phases={directPhases} />
              <PhaseList view={view} phases={directPhases} canEdit={canEdit} structural={structural} onAdd={() => s.addPhase(p.id, null)} />
              {directKpis.length > 0 && <KpiList view={view} kpiIds={directKpis.map((k) => k.id)} />}
            </div>
          )}
        </div>
      )}
      <RegenerateModal view={view} open={regenOpen} onClose={() => setRegenOpen(false)} target={{ kind: 'pillar', pillar: p }} />
      {capturedFor && <UpdateCapturedModal key={capturedFor.sub?.id ?? capturedFor.pillar.id} view={view} open onClose={() => setCapturedFor(null)} target={capturedFor} />}
    </section>
  )
}

const SUB_GRID = 'lg:grid-cols-[auto_minmax(0,1.15fr)_minmax(0,1.35fr)_236px_150px_104px_150px]'

function HeadStat({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-xs">
      <span className={clsx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', tone === 'bad' ? 'bg-rose-50 text-rose-600' : tone === 'good' ? 'bg-green-50 text-green-700' : 'bg-accent-soft text-accent')}>{icon}</span>
      <div className="min-w-0">
        <div className={clsx('tabular text-[20px] font-semibold tracking-tight', tone === 'good' && 'text-green-700', tone === 'bad' && 'text-rose-600', !tone && 'text-zinc-900')}>{value}</div>
        <div className="text-[11.5px] font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-zinc-500">{sub}</div>}
      </div>
    </div>
  )
}

/**
 * Captured EBITDA, green when at or ahead of plan to date and pink when behind.
 * Clickable (pencil on hover) when the viewer can post updates: that is where the number gets changed.
 */
function CapturedFigure({ captured, plan, onEdit, size = 'sm', enabler }: { captured: number; plan: number; onEdit?: () => void; size?: 'sm' | 'lg'; enabler?: boolean }) {
  const good = enabler || onPlan(captured, plan)
  const cls = clsx(
    'tabular inline-flex items-center gap-1 rounded px-1 font-semibold',
    size === 'lg' ? 'text-[14px]' : 'text-[13px]',
    good ? 'text-green-700' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  )
  const title = enabler ? 'Enabler: no direct EBITDA target' : good ? `$${captured.toFixed(1)}M captured vs $${plan.toFixed(1)}M planned to date: on plan` : `$${captured.toFixed(1)}M captured vs $${plan.toFixed(1)}M planned to date: behind plan`
  if (!onEdit) return <span className={cls} title={title}>${captured.toFixed(1)}M</span>
  return (
    <button type="button" onClick={onEdit} className={clsx(cls, 'group/cap -mx-1 cursor-pointer hover:bg-zinc-100', !good && 'hover:bg-rose-100')} title={`${title}. Click to update captured EBITDA.`} aria-label={`Update captured EBITDA, currently $${captured.toFixed(1)}M`}>
      ${captured.toFixed(1)}M
      <Pencil className="size-3 text-zinc-400 opacity-0 transition group-hover/cap:opacity-100" />
    </button>
  )
}

// ---------------------------------------------------------------- Sub-pillar

function SubPillarRow({
  view,
  sp,
  open,
  onToggle,
  canEdit,
  structural,
  siblings,
  axis,
  onUpdateCaptured,
}: {
  view: View
  sp: SubPillarView
  open: boolean
  onToggle: () => void
  canEdit: boolean
  structural: boolean
  siblings: SubPillarView[]
  axis: ReturnType<typeof timelineRange>
  onUpdateCaptured?: () => void
}) {
  const s = useStore()
  const [regenOpen, setRegenOpen] = useState(false)
  const phases = view.phases.filter((ph) => ph.subPillarId === sp.id)
  const kpis = view.kpis.filter((k) => k.subPillarId === sp.id)
  const parent = view.pillars.find((p) => p.id === sp.pillarId)!
  const mgmt = view.viewer.isMgmt
  const idx = siblings.findIndex((x) => x.id === sp.id)
  const move = (dir: -1 | 1) => {
    const ids = siblings.map((x) => x.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    s.reorderSubPillars(sp.pillarId, ids)
  }
  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <div className={clsx('grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 px-2.5 py-2 hover:bg-zinc-50/60', SUB_GRID)}>
        <button onClick={onToggle} className="text-zinc-400 hover:text-zinc-700" aria-label={`${open ? 'Consolidate' : 'Expand'} ${sp.name}`} aria-expanded={open}>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <div className="min-w-0 text-[13px]">
          <span className="tabular mr-1.5 text-zinc-400">{sp.num}</span>
          <InlineText value={sp.name} disabled={!canEdit} onSave={(v) => s.updateSubPillar(sp.id, { name: v })} className="font-medium" />
          <div className="truncate text-xs text-zinc-500">{sp.objective}</div>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <PhaseTimeline phases={phases} labels={false} range={axis} />
        </div>
        <div className="tabular col-span-2 text-xs whitespace-nowrap lg:col-span-1">
          {sp.targetImpact > 0 || structural ? (
            <div className="grid grid-cols-3 gap-x-2">
              <div>
                {structural ? (
                  <InlineNumber value={sp.targetImpact} onSave={(v) => s.updateSubPillar(sp.id, { targetImpact: v })} className="text-[13px] font-semibold text-zinc-900" />
                ) : (
                  <span className="text-[13px] font-semibold text-zinc-900">${sp.targetImpact.toFixed(1)}M</span>
                )}
                <div className="text-[10.5px] text-zinc-400">Target</div>
              </div>
              <div>
                <span className="text-[13px] font-semibold text-zinc-600">${sp.planToDate.toFixed(1)}M</span>
                <div className="text-[10.5px] text-zinc-400">Plan to date</div>
              </div>
              <div>
                <CapturedFigure captured={sp.capturedImpact} plan={sp.planToDate} onEdit={onUpdateCaptured} />
                <div className="text-[10.5px] text-zinc-400">Captured</div>
              </div>
            </div>
          ) : (
            <span className="text-zinc-400">Enabler, no direct EBITDA</span>
          )}
          {sp.targetImpact > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <ProgressBar value={sp.capturedImpact} max={sp.targetImpact} className="w-28" color={onPlan(sp.capturedImpact, sp.planToDate) ? 'var(--color-ontrack)' : '#e11d48'} />
              <span className="text-[10.5px] text-zinc-400">{Math.round((sp.capturedImpact / sp.targetImpact) * 100)}%</span>
            </div>
          )}
        </div>
        <OwnerPicker view={view} ownerIds={sp.ownerIds} disabled={!canEdit} showName onChange={(ids) => s.updateSubPillar(sp.id, { ownerIds: ids })} size={22} />
        <div>{view.viewer.isFirm ? <StatusSelect value={sp.status} onChange={(st) => s.setPlanStatus('subPillar', sp.id, st)} /> : <StatusPill status={sp.status} />}</div>
        <div className="flex items-center justify-end gap-1">
          {!mgmt &&
            (parent.visibility === 'firm' ? (
              <VisibilityBadge visibility="firm" hint="Firm only because the whole pillar is Firm only. Share the pillar first to share this." />
            ) : canEdit ? (
              <VisibilityToggle value={sp.visibility} onChange={(v) => s.setVisibility('subPillar', sp.id, v)} />
            ) : (
              <VisibilityBadge visibility={sp.visibility} />
            ))}
          {structural && (
            <Popover
              align="right"
              width={210}
              trigger={(_, toggle) => (
                <button onClick={toggle} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                  <MoreHorizontal className="size-3.5" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon={<Sparkles className="size-3.5 text-accent" />}
                    onClick={() => {
                      close()
                      setRegenOpen(true)
                    }}
                  >
                    Regenerate with instruction
                  </MenuItem>
                  {idx > 0 && (
                    <MenuItem
                      onClick={() => {
                        close()
                        move(-1)
                      }}
                    >
                      Move up
                    </MenuItem>
                  )}
                  {idx < siblings.length - 1 && (
                    <MenuItem
                      onClick={() => {
                        close()
                        move(1)
                      }}
                    >
                      Move down
                    </MenuItem>
                  )}
                  <MenuItem
                    icon={<Trash2 className="size-3.5 text-red-500" />}
                    onClick={() => {
                      close()
                      if (confirm(`Delete sub-pillar "${sp.name}"?`)) s.deleteSubPillar(sp.id)
                    }}
                  >
                    <span className="text-red-600">Delete</span>
                  </MenuItem>
                </>
              )}
            </Popover>
          )}
        </div>
      </div>
      {open && (
        <div className="grid gap-4 bg-zinc-50/50 px-3 pt-1 pb-3 sm:pl-9 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-500">Objective</div>
            <InlineText multiline value={sp.objective} disabled={!canEdit} onSave={(v) => s.updateSubPillar(sp.id, { objective: v })} className="text-[13px]" />
            <div className="mt-3 mb-1 text-xs font-medium text-zinc-500">Phases</div>
            <PhaseTimeline phases={phases} />
            <PhaseList view={view} phases={phases} canEdit={canEdit} structural={structural} onAdd={() => s.addPhase(sp.pillarId, sp.id)} />
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-500">KPIs</div>
            {kpis.length ? <KpiList view={view} kpiIds={kpis.map((k) => k.id)} /> : <div className="text-xs text-zinc-400">No KPIs</div>}
            {sp.targetImpact > 0 && (
              <div className="mt-3 rounded border border-zinc-100 bg-white px-2 py-1.5 text-[11.5px] text-zinc-500">
                <div className="text-xs font-medium text-zinc-500">How plan to date is set</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  Straight line from
                  {canEdit ? (
                    <input type="date" value={toInputDate(sp.startDate)} onChange={(e) => e.target.value && s.updateSubPillar(sp.id, { startDate: fromInputDate(e.target.value) })} className="rounded border border-zinc-200 px-1 text-[11.5px]" aria-label="Capture starts" />
                  ) : (
                    <span className="font-medium text-zinc-700">{fmtDateYear(sp.startDate)}</span>
                  )}
                  to full run-rate by
                  {canEdit ? (
                    <input type="date" value={toInputDate(sp.targetDate)} onChange={(e) => e.target.value && s.updateSubPillar(sp.id, { targetDate: fromInputDate(e.target.value) })} className="rounded border border-zinc-200 px-1 text-[11.5px]" aria-label="Full run-rate by" />
                  ) : (
                    <span className="font-medium text-zinc-700">{fmtDateYear(sp.targetDate)}</span>
                  )}
                  <span>· today that is ${sp.planToDate.toFixed(1)}M of ${sp.targetImpact.toFixed(1)}M.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <RegenerateModal view={view} open={regenOpen} onClose={() => setRegenOpen(false)} target={{ kind: 'subPillar', pillar: parent, sub: sp }} />
    </div>
  )
}

// ---------------------------------------------------------------- Phases & KPIs

function PhaseList({ view, phases, canEdit, structural, onAdd }: { view: View; phases: Phase[]; canEdit: boolean; structural: boolean; onAdd: () => void }) {
  const s = useStore()
  const firm = view.viewer.isFirm
  return (
    <div className="mt-2 space-y-1">
      {phases.map((ph, i) => (
        <div key={ph.id} className="group grid grid-cols-[16px_1fr_auto] items-start gap-2 rounded px-1 py-1 text-[12.5px] hover:bg-white sm:grid-cols-[16px_minmax(0,1fr)_200px_120px_20px]">
          <span className="tabular pt-0.5 text-[11px] text-zinc-400">{i + 1}</span>
          <div className="min-w-0">
            <InlineText value={ph.name} disabled={!canEdit} onSave={(v) => s.updatePhase(ph.id, { name: v })} className="font-medium" />
            {(ph.description || ph.deliverables.length > 0) && (
              <div className="text-[11.5px] text-zinc-500">
                {ph.description}
                {ph.deliverables.length > 0 && <span className="text-zinc-400"> · Deliverables: {ph.deliverables.join(', ')}</span>}
              </div>
            )}
          </div>
          <div className="col-span-2 flex items-center gap-1 text-[11.5px] text-zinc-500 sm:col-span-1">
            {canEdit ? (
              <>
                <input type="date" value={toInputDate(ph.startDate)} onChange={(e) => e.target.value && s.updatePhase(ph.id, { startDate: fromInputDate(e.target.value) })} className="w-[96px] rounded border border-transparent bg-transparent px-1 hover:border-zinc-200" />
                –
                <input type="date" value={toInputDate(ph.endDate)} onChange={(e) => e.target.value && s.updatePhase(ph.id, { endDate: fromInputDate(e.target.value) })} className="w-[96px] rounded border border-transparent bg-transparent px-1 hover:border-zinc-200" />
              </>
            ) : (
              <span>
                {fmtDate(ph.startDate)} – {fmtDateYear(ph.endDate)}
              </span>
            )}
          </div>
          <div>
            {firm ? (
              <Select<PhaseStatus> value={ph.status} onChange={(v) => s.updatePhase(ph.id, { status: v })} options={PHASE_STATUSES} className="w-[118px] [&_select]:py-0.5 [&_select]:text-xs" />
            ) : (
              <StatusPill status={ph.status} />
            )}
          </div>
          {structural ? (
            <button onClick={() => s.deletePhase(ph.id)} className="pt-1 text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-red-500" aria-label="Delete phase">
              <Trash2 className="size-3.5" />
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {!phases.length && <div className="text-xs text-zinc-400">No phases yet.</div>}
      {structural && (
        <button onClick={onAdd} className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
          <Plus className="size-3" /> Add phase
        </button>
      )}
    </div>
  )
}

function KpiList({ view, kpiIds }: { view: View; kpiIds: string[] }) {
  const kpis = view.kpis.filter((k) => kpiIds.includes(k.id))
  return (
    <div className="space-y-1.5">
      {kpis.map((k) => {
        const latest = k.actuals.at(-1)?.value ?? k.baseline
        const progress = k.target === k.baseline ? 0 : (latest - k.baseline) / (k.target - k.baseline)
        return (
          <div key={k.id} className="rounded border border-zinc-100 bg-white px-2 py-1.5">
            <div className="text-[12.5px] font-medium">{k.name}</div>
            <div className="tabular mt-0.5 flex items-center gap-2 text-[11.5px] text-zinc-500">
              <span>Baseline {fmtKpi(k.baseline, k.unit)}</span>
              <span>→</span>
              <span>Target {fmtKpi(k.target, k.unit)}</span>
              <span className="ml-auto font-medium text-zinc-800">Now {fmtKpi(latest, k.unit)}</span>
            </div>
            <ProgressBar value={Math.max(0, progress)} max={1} className="mt-1" color="var(--color-accent)" />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- Shared controls

export function StatusSelect({ value, onChange, disabled }: { value: PlanStatus; onChange: (s: PlanStatus) => void; disabled?: boolean }) {
  return (
    <Popover
      align="right"
      width={170}
      trigger={(_, toggle) => (
        <button disabled={disabled} onClick={toggle} className="rounded-full disabled:cursor-default" title="Change status">
          <StatusPill status={value} />
        </button>
      )}
    >
      {(close) =>
        PLAN_STATUSES.map((st) => (
          <MenuItem
            key={st}
            active={st === value}
            onClick={() => {
              close()
              onChange(st)
            }}
          >
            <StatusPill status={st} />
          </MenuItem>
        ))
      }
    </Popover>
  )
}


function OwnerLabel({ view, ownerIds, size, names }: { view: View; ownerIds: string[]; size: number; names: string[] }) {
  const first = view.members.find((m) => m.user.id === ownerIds[0])
  if (!first) return <span className="text-xs text-zinc-400">Unassigned</span>
  return (
    <span
      tabIndex={0}
      className="flex min-w-0 items-center gap-1.5 text-left"
      title={ownerIds.map((id) => { const m = view.members.find((x) => x.user.id === id); return m ? `${m.user.name}, ${m.user.title || m.role} (${m.role})` : '' }).filter(Boolean).join('\n')}
    >
      <AvatarStack names={names} size={size} max={2} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12px] font-medium text-zinc-800">{first.user.name}</span>
        <span className="block truncate text-[11px] text-zinc-500">{first.user.title || first.role}</span>
      </span>
    </span>
  )
}

export function OwnerPicker({ view, ownerIds, onChange, disabled, size = 20, showName }: { view: View; ownerIds: string[]; onChange: (ids: string[]) => void; disabled?: boolean; size?: number; showName?: boolean }) {
  const firm = view.members.filter((m) => m.role !== 'Management')
  const names = ownerIds.map((id) => userName(view, id))
  if (disabled) return showName ? <OwnerLabel view={view} ownerIds={ownerIds} size={size} names={names} /> : <AvatarStack names={names} size={size} />
  return (
    <Popover
      align="right"
      width={250}
      trigger={(_, toggle) => (
        <button onClick={toggle} className="flex max-w-full items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-100" title={ownerIds.map((id) => { const m = view.members.find((x) => x.user.id === id); return m ? `${m.user.name}, ${m.user.title || m.role} (${m.role})` : '' }).filter(Boolean).join('\n') || 'Assign owners'}>
          {names.length ? showName ? <OwnerLabel view={view} ownerIds={ownerIds} size={size} names={names} /> : <AvatarStack names={names} size={size} /> : <UserPlus className="size-4 text-zinc-400" />}
        </button>
      )}
    >
      {() => (
        <>
          <div className="px-2.5 pt-1 pb-1 text-[11px] font-medium text-zinc-400 uppercase">Owners</div>
          {firm.map((m) => {
            const on = ownerIds.includes(m.user.id)
            return (
              <MenuItem key={m.user.id} active={on} icon={<Avatar name={m.user.name} size={18} />} hint={m.role} onClick={() => onChange(on ? ownerIds.filter((x) => x !== m.user.id) : [...ownerIds, m.user.id])}>
                {m.user.name} · {m.user.title}
              </MenuItem>
            )
          })}
        </>
      )}
    </Popover>
  )
}

// ---------------------------------------------------------------- Regenerate

type RegenTarget = { kind: 'pillar'; pillar: PillarView } | { kind: 'subPillar'; pillar: PillarView; sub: SubPillarView }

function monthsAfter(closeIso: string, iso: string) {
  const a = new Date(closeIso)
  const b = new Date(iso)
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth())
}

function RegenerateModal({ view, open, onClose, target }: { view: View; open: boolean; onClose: () => void; target: RegenTarget }) {
  const s = useStore()
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = view.company.closeDate
  const people: Person[] = view.members.filter((m) => m.role !== 'Management').map((m) => ({ id: m.user.id, name: m.user.name, role: m.role, title: m.user.title }))

  const toRawSub = (sp: SubPillarView): RawSub => ({
    name: sp.name,
    objective: sp.objective,
    targetImpact: sp.targetImpact,
    visibility: sp.visibility,
    owners: sp.ownerIds.map((id) => userName(view, id)),
    startMonth: monthsAfter(close, sp.startDate),
    targetMonth: monthsAfter(close, sp.targetDate),
    phases: view.phases
      .filter((ph) => ph.subPillarId === sp.id)
      .map((ph) => ({ name: ph.name, description: ph.description, deliverables: ph.deliverables, startMonth: monthsAfter(close, ph.startDate), endMonth: monthsAfter(close, ph.endDate) })),
    kpis: view.kpis.filter((k) => k.subPillarId === sp.id).map((k) => ({ name: k.name, unit: k.unit, baseline: k.baseline, target: k.target })),
  })
  const toRawPillar = (p: PillarView): RawPillar => ({
    name: p.name,
    objective: p.objective,
    rationale: p.rationale,
    sourceRef: p.sourceRef,
    targetImpact: p.target,
    visibility: p.visibility,
    owners: p.ownerIds.map((id) => userName(view, id)),
    startMonth: monthsAfter(close, p.startDate),
    targetMonth: monthsAfter(close, p.targetDate),
    subPillars: view.subPillars.filter((x) => x.pillarId === p.id).map(toRawSub),
    phases: view.phases
      .filter((ph) => ph.pillarId === p.id && !ph.subPillarId)
      .map((ph) => ({ name: ph.name, description: ph.description, deliverables: ph.deliverables, startMonth: monthsAfter(close, ph.startDate), endMonth: monthsAfter(close, ph.endDate) })),
    kpis: view.kpis.filter((k) => k.pillarId === p.id && !k.subPillarId).map((k) => ({ name: k.name, unit: k.unit, baseline: k.baseline, target: k.target })),
  })

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      if (target.kind === 'pillar') {
        const result = (await regenerate('pillar', toRawPillar(target.pillar), instruction, { company: view.company.name, people })) as RawPillar
        const [gp] = normalizePlan({ pillars: [result] }, people, close).pillars
        s.replacePillarFromAi(target.pillar.id, gp)
      } else {
        const result = (await regenerate('subPillar', toRawSub(target.sub), instruction, { company: view.company.name, people, parentPillar: target.pillar.name })) as RawSub
        const [gp] = normalizePlan({ pillars: [{ name: target.pillar.name, targetImpact: Number(result.targetImpact) || 0, visibility: target.pillar.visibility, subPillars: [result] }] }, people, close).pillars
        s.replaceSubPillarFromAi(target.sub.id, gp.subPillars[0])
      }
      s.showToast('Regenerated with AI. Review the changes.')
      setInstruction('')
      onClose()
    } catch (err) {
      setError(`${err instanceof Error ? err.message : String(err)} Nothing was changed.`)
    } finally {
      setBusy(false)
    }
  }

  const label = target.kind === 'pillar' ? target.pillar.name : target.sub.name
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" /> Regenerate “{label}”
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!instruction.trim() || busy} onClick={run}>
            {busy ? 'Working…' : 'Regenerate'}
          </Button>
        </>
      }
    >
      <p className="mb-2 text-zinc-600">One line on what to change. Everything else stays as is.</p>
      <input autoFocus value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && instruction.trim() && !busy && run()} className={inputCls} placeholder="Split freight from packaging and push the timeline out a quarter" />
      {error && <p className="mt-2 text-[12.5px] text-red-600">{error}</p>}
    </Modal>
  )
}
