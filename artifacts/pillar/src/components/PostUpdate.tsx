import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Paperclip, SlidersHorizontal, X } from 'lucide-react'
import type { View } from '../lib/permissions'
import { useStore } from '../lib/store'
import { PLAN_STATUSES, type PlanStatus } from '../lib/types'
import { ownedBy } from '../lib/selectors'
import { Button, Field, Select, VisibilityToggle, inputCls } from './ui'

type Target = `p:${string}` | `s:${string}`

/**
 * The Post update flow: pick a pillar or sub-pillar, type a line or two,
 * optionally change status, enter captured EBITDA, complete a phase, attach files.
 */
export function PostUpdateForm({ view, defaultTarget, onDone, compact }: { view: View; defaultTarget?: Target; onDone?: () => void; compact?: boolean }) {
  const postUpdate = useStore((s) => s.postUpdate)
  const showToast = useStore((s) => s.showToast)
  const me = view.viewer.user.id

  const initialTarget = useMemo<Target>(() => {
    if (defaultTarget) return defaultTarget
    const mine = ownedBy(view, me)
    if (mine.subs[0]) return `s:${mine.subs[0].id}`
    if (mine.pillars[0]) return `p:${mine.pillars[0].id}`
    return `p:${view.pillars[0]?.id}`
  }, [defaultTarget, view, me])

  const [target, setTarget] = useState<Target>(initialTarget)
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(!compact)
  const [status, setStatus] = useState<PlanStatus | ''>('')
  const [captured, setCaptured] = useState<string>('')
  const [phaseId, setPhaseId] = useState('')
  const [completePhase, setCompletePhase] = useState(false)
  const [done, setDone] = useState('')
  const [next, setNext] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [vis, setVis] = useState<'internal' | 'shared'>('internal')

  const isSub = target.startsWith('s:')
  const id = target.slice(2)
  const sub = isSub ? view.subPillars.find((s) => s.id === id) : undefined
  const pillar = view.pillars.find((p) => p.id === (sub ? sub.pillarId : id))
  const current = sub ?? pillar
  const capturedEditable = !!sub || (!!pillar && !pillar.hasSubs)
  const currentCaptured = sub ? sub.capturedImpact : pillar?.captured ?? 0
  const parentShared = !!current && current.visibility === 'shared' && (!sub || pillar?.visibility === 'shared')
  const phases = view.phases.filter((ph) => (sub ? ph.subPillarId === sub.id : ph.pillarId === pillar?.id && !ph.subPillarId))
  const openPhases = phases.filter((ph) => ph.status !== 'Complete')

  const options = view.pillars.flatMap((p) => [
    { value: `p:${p.id}` as Target, label: `${p.num}. ${p.name}` },
    ...view.subPillars.filter((s) => s.pillarId === p.id).map((s) => ({ value: `s:${s.id}` as Target, label: `    ${s.num} ${s.name}` })),
  ])

  const reset = () => {
    setText('')
    setStatus('')
    setCaptured('')
    setPhaseId('')
    setCompletePhase(false)
    setDone('')
    setNext('')
    setFiles([])
    setVis('internal')
    if (compact) setExpanded(false)
  }

  const submit = () => {
    if (!pillar || !text.trim()) return
    const cap = captured.trim() === '' ? undefined : Number(captured)
    postUpdate({
      companyId: view.company.id,
      pillarId: pillar.id,
      subPillarId: sub?.id ?? null,
      phaseId: phaseId || null,
      text,
      status: status || undefined,
      captured: capturedEditable && cap !== undefined && Number.isFinite(cap) ? cap : undefined,
      completePhase: phaseId && completePhase ? { done: done.trim() || text.trim(), next: next.trim() } : undefined,
      attachments: files,
      visibility: parentShared ? vis : 'internal',
    })
    showToast('Update posted')
    reset()
    onDone?.()
  }

  if (!view.pillars.length) return null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="space-y-3"
    >
      <div className={clsx('flex gap-2', compact ? 'flex-col sm:flex-row' : 'flex-col')}>
        <Select<Target>
          className={compact ? 'sm:w-64' : ''}
          value={target}
          onChange={(v) => {
            setTarget(v)
            setPhaseId('')
            setCompletePhase(false)
          }}
          options={options}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What moved? One or two lines."
          className={clsx(inputCls, 'flex-1')}
          onFocus={() => compact && setExpanded(true)}
        />
        {compact && (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" icon={<SlidersHorizontal className="size-3.5" />} onClick={() => setExpanded((x) => !x)}>
              Details
            </Button>
            <Button type="submit" variant="primary" disabled={!text.trim()}>
              Post update
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 sm:grid-cols-3">
          <Field label="Status">
            <Select<PlanStatus | ''>
              value={status}
              onChange={setStatus}
              options={[{ value: '', label: `No change (${current?.status ?? ''})` }, ...PLAN_STATUSES.filter((s) => s !== current?.status).map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          <Field label="Captured run-rate EBITDA to date ($M)" hint={capturedEditable ? `Currently $${currentCaptured.toFixed(1)}M` : 'Rolls up from sub-pillars'}>
            <input
              type="number"
              step="0.1"
              disabled={!capturedEditable}
              value={captured}
              placeholder={currentCaptured.toFixed(1)}
              onChange={(e) => setCaptured(e.target.value)}
              className={clsx(inputCls, 'tabular')}
            />
          </Field>
          <Field label="Phase (optional)">
            <Select
              value={phaseId}
              onChange={(v) => {
                setPhaseId(v)
                if (!v) setCompletePhase(false)
              }}
              options={[{ value: '', label: 'None' }, ...phases.map((ph) => ({ value: ph.id, label: `${ph.name}${ph.status === 'Complete' ? ' (complete)' : ''}` }))]}
            />
          </Field>

          {phaseId && openPhases.some((ph) => ph.id === phaseId) && (
            <div className="sm:col-span-3">
              <label className="inline-flex items-center gap-2 text-[13px] font-medium">
                <input type="checkbox" checked={completePhase} onChange={(e) => setCompletePhase(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
                <CheckCircle2 className="size-4 text-blue-600" /> Mark this phase complete
              </label>
              {completePhase && (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <Field label="What was done">
                    <textarea rows={2} value={done} onChange={(e) => setDone(e.target.value)} className={inputCls} placeholder="Top 20 SKUs re-bid; awards signed." />
                  </Field>
                  <Field label="What is next">
                    <textarea rows={2} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} placeholder="Start long-tail consolidation." />
                  </Field>
                  {capturedEditable && !captured && (
                    <p className="text-[12px] text-amber-700 sm:col-span-2">Enter captured EBITDA to date above so the plan reflects this phase.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] font-medium shadow-xs hover:bg-zinc-50">
              <Paperclip className="size-3.5" /> Attach email or file
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const fs = Array.from(e.target.files ?? [])
                  setFiles((x) => [...x, ...fs])
                  e.target.value = ''
                }}
              />
            </label>
            {files.map((f, i) => (
              <span key={i} className="inline-flex h-6 items-center gap-1 rounded bg-white px-2 text-xs ring-1 ring-zinc-200">
                {f.name}
                <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                  <X className="size-3 text-zinc-400" />
                </button>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-2">
              <VisibilityToggle post value={parentShared ? vis : 'internal'} disabled={!parentShared} onChange={(v) => setVis(v === 'shared' ? 'shared' : 'internal')} />
              {!parentShared && <span className="text-[11.5px] text-zinc-400">Firm only item: stays internal</span>}
            </span>
          </div>
          {!compact && (
            <div className="flex justify-end gap-2 sm:col-span-3">
              {onDone && (
                <Button type="button" variant="ghost" onClick={onDone}>
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="primary" disabled={!text.trim()}>
                Post update
              </Button>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
