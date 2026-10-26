import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, FileDown, Info, MousePointerClick, RotateCcw, X } from 'lucide-react'
import { onPlan, type View } from '../lib/permissions'
import { fmtDelta, fmtKpi, planTotals, progressFor, useView, type PillarProgress } from '../lib/selectors'
import { asOfLabel, fmtDateYear, sinceLabel, toInputDate, windowFor } from '../lib/dates'
import { usePeriod } from '../lib/period'
import { BRIDGE_MODES, buildBridge, fmtEbitda, fmtPct, type BridgeMode } from '../lib/bridge'
import { pillarColor } from '../lib/colors'
import { progressWorkbook } from '../lib/exports'
import { Avatar, Button, Card, PageHeader, ProgressBar, Segmented, Stat, StatusPill, inputCls } from '../components/ui'
import { EbitdaBridge, BridgeLegend } from '../components/EbitdaBridge'
import { ExportButton } from '../components/ExportButton'

/**
 * Progress reads the plan at two points in time: "as of" the end of the selected period, and
 * "since" the end of the comparison period. Every change on the page is the difference between
 * the two, so comparing a period with itself shows no change.
 */
export default function Progress() {
  const view = useView()
  const { kind, offset, period, prior, compareOffset, defaultCompare, set, query } = usePeriod()
  const [mode, setMode] = useState<BridgeMode>('both')
  const [selected, setSelected] = useState<string | null>(null)
  const rows = useMemo(() => (view ? progressFor(view, period, prior) : []), [view, period, prior])
  if (!view) return null

  const pillarRows = rows.filter((r) => r.level === 'pillar')
  const sumOf = (f: (r: PillarProgress) => number) => pillarRows.reduce((a, r) => a + f(r), 0)
  const bridge = buildBridge(
    view,
    mode,
    new Map(pillarRows.map((r) => [r.id, r.capturedAtEnd])),
    new Map(pillarRows.map((r) => [r.id, r.capturedAtStart])),
  )
  const totals = planTotals(view)
  const isCurrent = period.end.getTime() > Date.now()
  const asOf = asOfLabel(period)
  const since = sinceLabel(prior)
  const window = windowFor(period, prior)
  const empty = window.since.getTime() >= window.asOf.getTime()
  const added = sumOf((r) => r.capturedAdded)
  const atStart = sumOf((r) => r.capturedAtStart)
  const phases = sumOf((r) => r.phasesCompleted.length)
  const asksClosed = sumOf((r) => r.asksClosed)
  const selectedPillar = selected ? view.pillars.find((p) => p.id === selected) : undefined

  // Changing the period resets the comparison to the period just before it.
  const setPeriod = (next: Record<string, string | number | undefined>) => set({ c: undefined, cto: undefined, ...next })
  const today = toInputDate(new Date().toISOString())

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="Where EBITDA stands against the plan, and what has moved since the comparison point."
        actions={
          <>
            <ExportButton build={() => progressWorkbook(view, bridge, rows, period, prior)} />
            <Link to={`/c/${view.company.id}/progress/export?${query}`}>
              <Button variant="primary" icon={<FileDown className="size-3.5" />}>
                Export board supplement
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented
          value={kind}
          onChange={(k) => setPeriod({ p: k, o: 0, to: k === 'custom' ? today : undefined })}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'quarter', label: 'Quarter' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {kind !== 'custom' ? (
          <Stepper label={period.label} onPrev={() => setPeriod({ o: offset - 1 })} onNext={() => setPeriod({ o: offset + 1 })} nextDisabled={offset >= 0} />
        ) : (
          <DateField label="As of" value={toInputDate(new Date(period.end.getTime() - 1).toISOString())} max={today} onChange={(to) => set({ to })} />
        )}
        <span className="text-xs text-zinc-500">compared with</span>
        {kind !== 'custom' ? (
          <Stepper label={prior.label} muted onPrev={() => set({ c: compareOffset - 1 })} onNext={() => set({ c: compareOffset + 1 })} nextDisabled={compareOffset >= offset} />
        ) : (
          <DateField value={toInputDate(new Date(prior.end.getTime() - 1).toISOString())} max={today} onChange={(cto) => set({ cto })} />
        )}
        {!defaultCompare && (
          <Button variant="ghost" size="xs" icon={<RotateCcw className="size-3" />} onClick={() => set({ c: undefined, cto: undefined })}>
            {kind === 'custom' ? 'Reset comparison' : 'Use the period before'}
          </Button>
        )}
      </div>
      <p className={clsx('mb-4 flex items-center gap-1.5 text-xs', empty ? 'text-amber-700' : 'text-zinc-500')}>
        <Info className="size-3.5 shrink-0" />
        {empty ? (
          <>Comparing {period.label} with itself shows no change. Pick an earlier comparison to see what moved.</>
        ) : (
          <>
            Numbers are as of {asOf}. Changes are everything logged since {since}.
          </>
        )}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={isCurrent ? 'Realized to date' : `Realized as of ${asOf}`}
          value={fmtEbitda(bridge.realized)}
          sub={
            isCurrent
              ? onPlan(bridge.realized, totals.planToDate)
                ? `${fmtPct(bridge.realized, totals.target)} of the $${totals.target.toFixed(1)}M plan · on plan`
                : `${fmtPct(bridge.realized, totals.target)} of the $${totals.target.toFixed(1)}M plan · $${(totals.planToDate - bridge.realized).toFixed(1)}M behind plan to date`
              : `${fmtPct(bridge.realized, totals.target)} of the $${totals.target.toFixed(1)}M plan`
          }
          tone={isCurrent && !onPlan(bridge.realized, totals.planToDate) ? 'bad' : 'good'}
        />
        <Stat label={`Added since ${since}`} value={empty ? '—' : fmtDelta(added)} sub={empty ? 'Same point in time' : `${fmtEbitda(atStart)} then, ${fmtEbitda(bridge.realized)} now`} tone={added > 0 ? 'good' : undefined} />
        <Stat label="Phases completed" value={String(phases)} sub={`since ${since}`} />
        <Stat label="Asks closed" value={String(asksClosed)} sub={`since ${since}`} />
      </div>

      <Card
        className="mb-4"
        title={
          <>
            EBITDA bridge <span className="hidden font-normal text-zinc-500 sm:inline">· as of {asOf}</span>
          </>
        }
        action={<Segmented<BridgeMode> value={mode} onChange={setMode} options={BRIDGE_MODES} />}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <EbitdaBridge
              bridge={bridge}
              height={320}
              selectedKey={selected}
              asOf={asOf}
              onSelect={(s) => setSelected(s?.key ?? null)}
              tooltipExtra={(s) => {
                const r = pillarRows.find((x) => x.id === s.key)
                if (!r) return null
                return <div className="mt-1.5 text-[11.5px] text-zinc-500">{r.capturedAdded ? `${fmtDelta(r.capturedAdded)} since ${since}` : `No change since ${since}`}</div>
              }}
            />
          </div>
        </div>
        <BridgeLegend bridge={bridge} sinceLabel={since} className="mt-2" />
      </Card>

      {selectedPillar ? (
        <PillarPanel key={selectedPillar.id} view={view} pillarId={selectedPillar.id} rows={rows} asOf={asOf} since={since} onClose={() => setSelected(null)} />
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-[13px] text-zinc-500">
          <MousePointerClick className="size-4 text-zinc-400" />
          Click a pillar in the bridge to see what moved in it since {since}.
        </div>
      )}
    </div>
  )
}

function Stepper({ label, onPrev, onNext, nextDisabled, muted }: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="sm" onClick={onPrev} aria-label="Earlier period">
        <ChevronLeft className="size-4" />
      </Button>
      <span className={clsx('min-w-[120px] text-center text-[13px] font-medium', muted && 'text-zinc-600')}>{label}</span>
      <Button variant="ghost" size="sm" disabled={nextDisabled} onClick={onNext} aria-label="Later period">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

function DateField({ label, value, max, onChange }: { label?: string; value: string; max?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      {label}
      <input type="date" className={clsx(inputCls, 'w-36')} value={value} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  )
}

/** What the clicked pillar did since the comparison point: the detail that used to be a table for every pillar. */
function PillarPanel({ view, pillarId, rows, asOf, since, onClose }: { view: View; pillarId: string; rows: PillarProgress[]; asOf: string; since: string; onClose: () => void }) {
  const p = view.pillars.find((x) => x.id === pillarId)!
  const r = rows.find((x) => x.id === pillarId && x.level === 'pillar')!
  const subs = view.subPillars.filter((s) => s.pillarId === p.id)
  const subRow = (id: string) => rows.find((x) => x.id === id && x.level === 'sub')
  const phases = view.phases.filter((ph) => ph.pillarId === p.id)
  const owners = p.ownerIds.map((id) => view.members.find((m) => m.user.id === id)).filter(Boolean) as View['members']
  const color = pillarColor(p.num)
  const realized = r.capturedAtEnd
  const gap = Math.max(0, r.target - realized)
  const moved = r.statusChanges.length + r.phasesCompleted.length + r.kpis.length + r.asksClosed > 0 || r.capturedAdded !== 0

  return (
    <Card
      title={
        <>
          <span className="size-2.5 rounded-sm" style={{ background: color }} />
          <span className="text-zinc-400">{p.num}.</span> {p.name}
          <StatusPill status={r.statusAtEnd} />
        </>
      }
      action={
        <>
          <Link to={`/c/${view.company.id}/pillars/${p.id}`}>
            <Button variant="ghost" size="xs" icon={<ArrowRight className="size-3" />}>
              Open pillar
            </Button>
          </Link>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close detail">
            <X className="size-4" />
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <Mini label="Target" value={`+${fmtEbitda(r.target)}`} />
        <Mini label={`Realized · ${asOf}`} value={fmtEbitda(realized)} sub={fmtPct(realized, r.target)} tone="good" />
        <Mini label="To go" value={fmtEbitda(gap)} />
        <Mini label={`Added since ${since}`} value={fmtDelta(r.capturedAdded)} sub={`${fmtEbitda(r.capturedAtStart)} → ${fmtEbitda(realized)}`} tone={r.capturedAdded > 0 ? 'good' : undefined} />
      </div>
      <ProgressBar value={realized} max={r.target} className="mt-3" color={color} />

      {owners.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {owners.map((m) => (
            <span key={m.user.id} className="inline-flex items-center gap-1.5">
              <Avatar name={m.user.name} size={20} />
              <span className="text-[12.5px] font-medium text-zinc-800">{m.user.name}</span>
              <span className="text-[11.5px] text-zinc-500">{m.user.title || m.role}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section>
          <h4 className="mb-1.5 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase">What moved since {since}</h4>
          {moved ? (
            <ul className="space-y-1.5 text-[13px] text-zinc-800">
              {r.phasesCompleted.map((n) => (
                <li key={n} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 shrink-0 text-blue-600" /> Completed <span className="font-medium">{n}</span>
                </li>
              ))}
              {r.statusChanges.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  Status <StatusPill status={c.from} /> <ArrowRight className="size-3 text-zinc-400" /> <StatusPill status={c.to} /> <span className="text-zinc-400">{fmtDateYear(c.at)}</span>
                </li>
              ))}
              {r.kpis.map((k) => (
                <li key={k.name} className="tabular">
                  <span className="text-zinc-600">{k.name}:</span> {fmtKpi(k.from, k.unit)} → <span className="font-medium">{fmtKpi(k.to, k.unit)}</span> <span className="text-zinc-400">(target {fmtKpi(k.target, k.unit)})</span>
                </li>
              ))}
              {subs
                .map((s) => ({ s, sr: subRow(s.id) }))
                .filter(({ sr }) => sr && sr.capturedAdded !== 0)
                .map(({ s, sr }) => (
                  <li key={s.id} className="tabular">
                    <span className="text-zinc-600">{s.name}:</span> <span className="font-medium text-green-700">{fmtDelta(sr!.capturedAdded)}</span> captured
                  </li>
                ))}
              {!subs.length && r.capturedAdded !== 0 && (
                <li className="tabular">
                  <span className="font-medium text-green-700">{fmtDelta(r.capturedAdded)}</span> captured
                </li>
              )}
              {r.asksClosed > 0 && (
                <li>
                  {r.asksClosed} {r.asksClosed === 1 ? 'ask' : 'asks'} closed
                </li>
              )}
            </ul>
          ) : (
            <p className="text-[13px] text-zinc-400">Nothing logged since {since}.</p>
          )}
          <p className="mt-2 text-[11.5px] text-zinc-400">
            {r.updates} {r.updates === 1 ? 'update' : 'updates'} posted since {since}
          </p>
        </section>

        <section>
          <h4 className="mb-1.5 text-[12px] font-semibold tracking-wide text-zinc-500 uppercase">{subs.length ? 'Sub-pillars' : 'Phases'}</h4>
          {subs.length ? (
            <ul className="divide-y divide-zinc-100">
              {subs.map((s) => {
                const sr = subRow(s.id)
                const sRealized = sr?.capturedAtEnd ?? s.capturedImpact
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px]">
                        <span className="text-zinc-400">{s.num}</span> {s.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <ProgressBar value={sRealized} max={s.targetImpact} className="flex-1" color={color} />
                        <span className="tabular text-[11.5px] whitespace-nowrap text-zinc-500">
                          <span className="font-medium text-zinc-800">{fmtEbitda(sRealized)}</span> / {fmtEbitda(s.targetImpact)}
                        </span>
                      </div>
                    </div>
                    <StatusPill status={sr?.statusAtEnd ?? s.status} />
                  </li>
                )
              })}
            </ul>
          ) : phases.length ? (
            <ul className="space-y-1">
              {phases.map((ph) => (
                <li key={ph.id} className="flex items-center gap-2 text-[12.5px]">
                  <StatusPill status={ph.status} className="w-[92px] justify-start" />
                  <span className="min-w-0 flex-1 truncate">{ph.name}</span>
                  <span className="text-[11px] text-zinc-400">{fmtDateYear(ph.endDate)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-zinc-400">No phases planned.</p>
          )}
        </section>
      </div>
    </Card>
  )
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' }) {
  return (
    <div>
      <div className="text-[11.5px] text-zinc-500">{label}</div>
      <div className={clsx('tabular text-[17px] font-semibold', tone === 'good' && 'text-green-700')}>
        {value} {sub && <span className="text-[12px] font-normal text-zinc-400">{sub}</span>}
      </div>
    </div>
  )
}
