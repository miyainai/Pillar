import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { View } from '../lib/permissions'
import { buildDashboardBridge, fmtEbitda } from '../lib/bridge'
import { dashboardBridgeWorkbook } from '../lib/exports'
import { isPlanLocked } from '../lib/selectors'
import { useStore } from '../lib/store'
import { BridgeLegend, EbitdaBridge } from './EbitdaBridge'
import { ExportButton } from './ExportButton'
import { Button, Card, inputCls } from './ui'

export function DashboardBridge({ view, className }: { view: View; className?: string }) {
  const bridge = buildDashboardBridge(view)
  const svgRef = useRef<SVGSVGElement>(null)
  const navigate = useNavigate()
  const [selected, setSelected] = useState(false)
  return <Card className={className} title="EBITDA bridge"
    action={<ExportButton size="xs" variant="ghost" label="Export" build={() => dashboardBridgeWorkbook(view, bridge)} />}>
    <p className="mb-2 text-xs text-zinc-500">Entry → organic / steady-state growth → pillars → target</p>
    <div className="overflow-x-auto"><div className="min-w-[680px]">
      <EbitdaBridge bridge={bridge} height={280} svgRef={svgRef} selectedKey={selected ? 'organic' : null}
        onSelect={(step) => {
          if (step?.kind === 'pillar') navigate(`/c/${view.company.id}/pillars/${step.key}`)
          else setSelected(step?.kind === 'organic')
        }} />
    </div></div>
    <BridgeLegend bridge={bridge} className="mt-2" />
    <p className="mt-2 text-xs text-zinc-500">Organic is incremental growth in the existing business, excluding entry earnings and all pillar initiatives. It is specified independently, not inferred from the IC case.</p>
    <Button size="xs" variant="ghost" className="mt-2" onClick={() => setSelected(!selected)}>{selected ? 'Close organic details' : 'Organic details / configure'}</Button>
    {selected && <OrganicPanel key={view.company.id} view={view} />}
  </Card>
}

function OrganicPanel({ view }: { view: View }) {
  const { company, viewer } = view
  const save = useStore((s) => s.saveOrganicEbitda)
  const locked = isPlanLocked(view)
  const [editing, setEditing] = useState(false)
  const [target, setTarget] = useState('')
  const [realized, setRealized] = useState('')
  const [message, setMessage] = useState('')
  const savedTarget = company.organicTargetEbitda ?? 0
  const savedRealized = company.organicRealizedEbitda ?? 0
  return <section aria-label="Organic EBITDA details" className="mt-3 border-t border-zinc-200 pt-3">
    <h3 className="text-sm font-semibold">Organic / steady-state</h3>
    <p className="mt-1 text-xs text-zinc-600">Target {fmtEbitda(savedTarget)} · Realized {fmtEbitda(savedRealized)} · Yet to realize {fmtEbitda(Math.max(0, savedTarget - savedRealized))}</p>
    {viewer.canEditPlan && !editing && <Button size="xs" className="mt-2" onClick={() => {
      setTarget(String(savedTarget)); setRealized(String(savedRealized)); setMessage(''); setEditing(true)
    }}>Edit organic EBITDA</Button>}
    {editing && <form className="mt-3 space-y-2" onSubmit={(e) => {
      e.preventDefault()
      if (!target.trim() || !realized.trim() || !save(company.id, Number(target), Number(realized))) {
        setMessage('Enter finite, nonnegative amounts. A locked target requires a plan revision.')
        return
      }
      setEditing(false); setMessage('Organic EBITDA saved.')
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Organic target ($M)<input className={`${inputCls} mt-1 w-full`} type="number" min="0" step="any" required disabled={locked} value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <label className="text-xs">Organic realized run-rate ($M)<input className={`${inputCls} mt-1 w-full`} type="number" min="0" step="any" required value={realized} onChange={(e) => setRealized(e.target.value)} /></label>
      </div>
      <div className="flex gap-2"><Button type="submit" size="xs" variant="primary">Save organic EBITDA</Button><Button type="button" size="xs" onClick={() => { setEditing(false); setMessage('') }}>Cancel</Button></div>
    </form>}
    {viewer.canEditPlan && locked && <p className="mt-2 text-xs text-zinc-500">The target is locked. <Link className="underline" to={`/c/${company.id}/plan`}>Start a plan revision</Link> to change it. Realized EBITDA can still be updated.</p>}
    {!viewer.canEditPlan && <p className="mt-2 text-xs text-zinc-500">Only plan editors can change organic EBITDA.</p>}
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </section>
}
