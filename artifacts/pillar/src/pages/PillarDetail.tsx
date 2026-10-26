import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, FileText, Plus } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { onPlan, type View } from '../lib/permissions'
import { fmtKpi, isStale, sortAsks, useView, userName } from '../lib/selectors'
import { daysSince, fmtDate, fmtDateYear } from '../lib/dates'
import { AvatarStack, Button, Card, Empty, ProgressBar, Select, StatusPill, VisibilityBadge, inputCls } from '../components/ui'
import { PhaseTimeline } from '../components/PhaseTimeline'
import { PostUpdateForm } from '../components/PostUpdate'
import { UpdateItem } from '../components/Feed'
import { Comments } from '../components/Comments'
import { AskRows } from '../components/AskRows'
import { ExportButton } from '../components/ExportButton'
import { kpiWorkbook } from '../lib/exports'
import { useHashTarget } from '../lib/useHashTarget'
import { StatusSelect } from './Builder'

export default function PillarDetail() {
  const { pillarId } = useParams()
  const view = useView()
  const setPlanStatus = useStore((s) => s.setPlanStatus)
  const confirmNoChange = useStore((s) => s.confirmNoChange)
  const targetUpdateId = useHashTarget()
  if (!view) return null
  const p = view.pillars.find((x) => x.id === pillarId)
  if (!p)
    return (
      <div className="mt-20 text-center text-zinc-500">
        Pillar not found.{' '}
        <Link className="text-accent" to={`/c/${view.company.id}/plan`}>
          Back to the plan
        </Link>
      </div>
    )
  const subs = view.subPillars.filter((s) => s.pillarId === p.id)
  const updates = view.updates.filter((u) => u.pillarId === p.id)
  const base = `/c/${view.company.id}`
  const asks = sortAsks(view.asks.filter((a) => a.pillarId === p.id))
  const openAsks = asks.filter((a) => a.status !== 'Closed')
  const kpis = view.kpis.filter((k) => k.pillarId === p.id)
  const firm = view.viewer.isFirm
  const stale = firm && isStale(view, p)

  return (
    <div>
      <Link to={`/c/${view.company.id}/plan`} className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="size-3" /> Plan
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[19px] font-semibold tracking-tight">
            <span className="text-zinc-400">{p.num}.</span> {p.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {firm ? <StatusSelect value={p.status} onChange={(st) => setPlanStatus('pillar', p.id, st)} /> : <StatusPill status={p.status} />}
            {firm && <VisibilityBadge visibility={p.visibility} />}
            <AvatarStack names={p.ownerIds.map((id) => userName(view, id))} size={20} />
            <span>{p.ownerIds.map((id) => userName(view, id)).join(', ')}</span>
            <span>·</span>
            <span>
              {fmtDate(p.startDate, { year: 'numeric' })} – {fmtDateYear(p.targetDate)}
            </span>
            <span>·</span>
            <span className={stale ? 'font-medium text-amber-700' : ''}>Last update {daysSince(p.lastUpdated)}d ago</span>
            {stale && (
              <Button size="xs" onClick={() => confirmNoChange(p.id)}>
                Confirm no change
              </Button>
            )}
          </div>
        </div>
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-xs">
          <div className="flex items-baseline justify-between text-xs text-zinc-500">
            <span>Run-rate EBITDA</span>
            <span className="text-zinc-400">{p.target ? `${Math.round((p.captured / p.target) * 100)}% realized` : 'Enabler'}</span>
          </div>
          <div className="tabular mt-1 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[18px] font-semibold text-zinc-900">${p.target.toFixed(1)}M</div>
              <div className="text-[10.5px] text-zinc-500 uppercase">Target</div>
            </div>
            <div>
              <div className="text-[18px] font-semibold text-zinc-600">${p.planToDate.toFixed(1)}M</div>
              <div className="text-[10.5px] text-zinc-500 uppercase">Plan to date</div>
            </div>
            <div>
              <div className={p.target === 0 || onPlan(p.captured, p.planToDate) ? 'text-[18px] font-semibold text-green-700' : 'inline-block rounded bg-rose-50 px-1 text-[18px] font-semibold text-rose-700 ring-1 ring-rose-200'}>${p.captured.toFixed(1)}M</div>
              <div className="text-[10.5px] text-zinc-500 uppercase">Captured</div>
            </div>
          </div>
          <ProgressBar value={p.captured} max={p.target} className="mt-2" color={p.target > 0 && !onPlan(p.captured, p.planToDate) ? '#e11d48' : undefined} />
          {p.target > 0 && !onPlan(p.captured, p.planToDate) && <div className="mt-1 text-[11.5px] font-medium text-rose-600">${(p.planToDate - p.captured).toFixed(1)}M behind plan</div>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card title="Objective">
            <p className="text-[13px] text-zinc-800">{p.objective || <span className="text-zinc-400">No objective yet.</span>}</p>
            {firm && p.rationale && (
              <>
                <div className="mt-3 text-xs font-medium text-zinc-500">Rationale</div>
                <p className="text-[13px] text-zinc-700">{p.rationale}</p>
                {p.sourceRef && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
                    <FileText className="size-3" /> {p.sourceRef}
                  </div>
                )}
              </>
            )}
          </Card>

          {firm && (
            <Card title="Post update">
              <PostUpdateForm view={view} compact defaultTarget={subs[0] ? `s:${subs.find((s) => s.ownerIds.includes(view.viewer.user.id))?.id ?? subs[0].id}` : `p:${p.id}`} />
            </Card>
          )}

          <Card title={`Updates (${updates.length})`} pad={false}>
            <div className="divide-y divide-zinc-50 px-3.5">
              {updates.map((u) => (
                <UpdateItem key={u.id} view={view} u={u} showTarget={!!u.subPillarId} anchor highlighted={targetUpdateId === u.id} />
              ))}
              {!updates.length && <Empty>No updates yet.</Empty>}
            </div>
          </Card>

          <Card title="Comments">
            <Comments view={view} parentType="pillar" parentId={p.id} parentShared={p.visibility === 'shared'} />
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {subs.length > 0 ? (
            <Card title="Sub-pillars" pad={false}>
              <div className="divide-y divide-zinc-100">
                {subs.map((s) => (
                  <div key={s.id} className="px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        <span className="text-zinc-400">{s.num}</span> {s.name}
                      </span>
                      {firm && (s.visibility === 'firm' || p.visibility === 'firm') && <VisibilityBadge visibility="firm" hint={p.visibility === 'firm' ? 'Firm only because the whole pillar is Firm only' : undefined} />}
                      <StatusPill status={s.status} />
                    </div>
                    <div className="tabular mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span title={s.targetImpact > 0 ? `Plan to date $${s.planToDate.toFixed(1)}M` : undefined}>
                        <span className={s.targetImpact === 0 || onPlan(s.capturedImpact, s.planToDate) ? 'text-green-700' : 'rounded bg-rose-50 px-1 text-rose-700'}>${s.capturedImpact.toFixed(1)}M</span> / ${s.targetImpact.toFixed(1)}M
                        {s.targetImpact > 0 && <span className="text-zinc-400"> · plan ${s.planToDate.toFixed(1)}M</span>}
                      </span>
                      <ProgressBar value={s.capturedImpact} max={s.targetImpact} className="flex-1" color={s.targetImpact > 0 && !onPlan(s.capturedImpact, s.planToDate) ? '#e11d48' : undefined} />
                      <AvatarStack names={s.ownerIds.map((id) => userName(view, id))} size={18} />
                    </div>
                    <PhaseTimeline className="mt-2" phases={view.phases.filter((ph) => ph.subPillarId === s.id)} />
                    <div className="mt-1 space-y-0.5">
                      {view.phases
                        .filter((ph) => ph.subPillarId === s.id)
                        .map((ph) => (
                          <div key={ph.id} className="flex items-center gap-2 text-[12px]">
                            <StatusPill status={ph.status} className="w-[92px] justify-start" />
                            <span className="min-w-0 flex-1 truncate">{ph.name}</span>
                            <span className="text-[11px] text-zinc-400">{fmtDate(ph.endDate, { year: '2-digit' })}</span>
                          </div>
                        ))}
                    </div>
                    {firm || s.visibility === 'shared' ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11.5px] text-zinc-500 hover:text-zinc-800">Comments on this sub-pillar</summary>
                        <div className="mt-2">
                          <Comments view={view} parentType="subPillar" parentId={s.id} parentShared={p.visibility === 'shared' && s.visibility === 'shared'} />
                        </div>
                      </details>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card title="Phases">
              <PhaseTimeline phases={view.phases.filter((ph) => ph.pillarId === p.id)} />
              <div className="mt-2 space-y-1">
                {view.phases
                  .filter((ph) => ph.pillarId === p.id)
                  .map((ph) => (
                    <div key={ph.id} className="flex items-center gap-2 text-[12.5px]">
                      <StatusPill status={ph.status} className="w-[92px]" />
                      <span className="flex-1">{ph.name}</span>
                      <span className="text-[11px] text-zinc-400">{fmtDateYear(ph.endDate)}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}

          {kpis.length > 0 && <KpiChart view={view} kpiIds={kpis.map((k) => k.id)} />}

          {/* Asks are worked in the Asks tab; this is a read-only window onto the ones linked here. */}
          {firm ? (
            <Card
              title={`Asks linked here (${openAsks.length} open)`}
              pad={false}
              action={
                <div className="flex items-center gap-1">
                  <Link to={`${base}/asks?pillar=${p.id}`} className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                    Open in Asks <ArrowUpRight className="size-3" />
                  </Link>
                  <Link to={`${base}/asks?new=1&pillar=${p.id}`} className="inline-flex h-6 items-center gap-1 rounded-md border border-zinc-200 px-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100">
                    <Plus className="size-3" /> New ask
                  </Link>
                </div>
              }
            >
              <AskRows view={view} asks={openAsks} empty="No open asks linked to this pillar." />
            </Card>
          ) : (
            asks.length > 0 && (
              <Card
                title="Data requests"
                pad={false}
                action={
                  <Link to={`${base}/asks?pillar=${p.id}`} className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                    Open in Data requests <ArrowUpRight className="size-3" />
                  </Link>
                }
              >
                <AskRows view={view} asks={asks} />
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function KpiChart({ view, kpiIds }: { view: View; kpiIds: string[] }) {
  const addKpiActual = useStore((s) => s.addKpiActual)
  const [selected, setSelected] = useState(kpiIds[0])
  const [value, setValue] = useState('')
  const k = view.kpis.find((x) => x.id === selected) ?? view.kpis.find((x) => x.id === kpiIds[0])!
  const data = [
    ...(k.actuals.length && new Date(k.actuals[0].date) > new Date(view.company.closeDate) ? [{ date: view.company.closeDate, value: k.baseline }] : []),
    ...k.actuals,
  ].map((a) => ({ label: fmtDate(a.date), value: a.value }))
  const latest = k.actuals.at(-1)?.value ?? k.baseline
  return (
    <Card
      title="KPIs"
      action={
        <>
          {kpiIds.length > 1 && (
            <Select
              value={k.id}
              onChange={setSelected}
              options={kpiIds.map((id) => ({ value: id, label: view.kpis.find((x) => x.id === id)!.name }))}
              className="w-56 [&_select]:py-0.5 [&_select]:text-xs"
            />
          )}
          <ExportButton size="xs" variant="ghost" label="Export" build={() => kpiWorkbook(view, k)} />
        </>
      }
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div className="text-[13px] font-medium">{k.name}</div>
        <div className="tabular text-xs text-zinc-500">
          Baseline {fmtKpi(k.baseline, k.unit)} · Target {fmtKpi(k.target, k.unit)} · <span className="font-medium text-zinc-900">Now {fmtKpi(latest, k.unit)}</span>
        </div>
      </div>
      {data.length ? (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={{ stroke: '#e4e4e7' }} />
              <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => fmtKpi(Number(v), k.unit)} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <ReferenceLine y={k.target} stroke="#16a34a" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 10, fill: '#16a34a', position: 'insideTopRight' }} />
              <Line type="monotone" dataKey="value" stroke="#5e6ad2" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty>No actuals logged yet.</Empty>
      )}
      {view.viewer.isFirm && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(value)
            if (value.trim() && Number.isFinite(n)) {
              addKpiActual(k.id, n)
              setValue('')
            }
          }}
        >
          <input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Log today's actual (${k.unit})`} className={inputCls} />
          <Button type="submit" size="sm" disabled={!value.trim()}>
            Log
          </Button>
        </form>
      )}
    </Card>
  )
}
