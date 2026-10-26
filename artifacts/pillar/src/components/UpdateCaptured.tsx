import { useState } from 'react'
import clsx from 'clsx'
import type { PillarView, SubPillarView } from '../lib/permissions'
import { onPlan, type View } from '../lib/permissions'
import { useStore } from '../lib/store'
import { Button, Field, Modal, VisibilityToggle, inputCls } from './ui'

export type CapturedTarget = { pillar: PillarView; sub?: SubPillarView }

/**
 * The one place captured EBITDA gets changed from the plan. It posts a normal update
 * (with the new number attached) so the feed, the bridge and the Progress tab all pick it up.
 */
export function UpdateCapturedModal({ view, open, onClose, target }: { view: View; open: boolean; onClose: () => void; target: CapturedTarget }) {
  const postUpdate = useStore((s) => s.postUpdate)
  const showToast = useStore((s) => s.showToast)
  const item = target.sub ?? target.pillar
  const current = target.sub ? target.sub.capturedImpact : target.pillar.captured
  const targetImpact = target.sub ? target.sub.targetImpact : target.pillar.target
  const plan = item.planToDate
  const shared = item.visibility === 'shared' && target.pillar.visibility === 'shared'
  const [value, setValue] = useState(String(current))
  const [text, setText] = useState('')
  const [vis, setVis] = useState<'internal' | 'shared'>(shared ? 'shared' : 'internal')
  const n = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0 && text.trim().length > 0
  const label = target.sub ? `${target.sub.num} ${target.sub.name}` : `${target.pillar.num}. ${target.pillar.name}`

  const submit = () => {
    if (!valid) return
    postUpdate({
      companyId: view.company.id,
      pillarId: target.pillar.id,
      subPillarId: target.sub?.id ?? null,
      phaseId: null,
      text: text.trim(),
      captured: Math.round(n * 100) / 100,
      attachments: [],
      visibility: shared ? vis : 'internal',
    })
    showToast(`Captured updated to $${n.toFixed(1)}M for ${label}`)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Update captured EBITDA" width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>Save and post update</Button>
        </>
      }
    >
      <div className="mb-3 text-[13px] font-medium text-zinc-800">{label}</div>
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-center">
        <Figure label="Target" value={targetImpact} />
        <Figure label="Plan to date" value={plan} />
        <Figure label="Captured now" value={current} tone={onPlan(current, plan) ? 'good' : 'bad'} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit() }} className="space-y-3">
        <Field label="Captured run-rate EBITDA to date ($M)" hint="Annualized run-rate that is already landing, not the full-year target.">
          <input autoFocus type="number" min={0} step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className={clsx(inputCls, 'tabular w-40')} />
        </Field>
        <Field label="What changed?" hint="One or two lines on where the number comes from. This goes into the update feed.">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="e.g. 12 of the top 20 SKUs re-bid; run-rate savings now $1.2M." />
        </Field>
        {shared ? (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            Who sees this update <VisibilityToggle post value={vis} onChange={(v) => setVis(v === 'shared' ? 'shared' : 'internal')} />
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Firm only item, so this update stays inside the firm.</p>
        )}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  )
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return (
    <div>
      <div className={clsx('tabular text-[15px] font-semibold', tone === 'good' && 'text-green-700', tone === 'bad' && 'text-rose-600', !tone && 'text-zinc-800')}>${value.toFixed(1)}M</div>
      <div className="text-[10.5px] font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
    </div>
  )
}
