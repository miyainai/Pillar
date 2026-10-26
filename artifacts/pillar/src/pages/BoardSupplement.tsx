import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { useStore } from '../lib/store'
import { scopeFor } from '../lib/permissions'
import { fmtDelta, fmtKpi, planTotals, progressFor, useView } from '../lib/selectors'
import { asOfLabel, fmtDateYear, sinceLabel } from '../lib/dates'
import { usePeriod } from '../lib/period'
import { buildBridge, fmtEbitda, fmtPct } from '../lib/bridge'
import { progressWorkbook } from '../lib/exports'
import { Button, StatusPill } from '../components/ui'
import { Logo } from '../components/TopBar'
import { EbitdaBridge, BridgeLegend } from '../components/EbitdaBridge'
import { ExportButton } from '../components/ExportButton'

/**
 * Supplemental VCP pages for the board deck management builds. Compiled from
 * logged updates; the per-pillar commentary is the only written part and is
 * edited right here. "Export to PDF" is the browser's print dialog (Save as PDF).
 */
export default function BoardSupplement() {
  const firmView = useView()
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const companyId = useStore((s) => s.companyId)
  const setCommentary = useStore((s) => s.setCommentary)
  // The supplement goes into the deck management builds, so it defaults to shared items only.
  const [includeFirm, setIncludeFirm] = useState(false)
  const sharedView = useMemo(() => scopeFor(db, userId, companyId, { asManagement: true }), [db, userId, companyId])
  const { period, prior, query } = usePeriod()
  if (!firmView || !sharedView) return null
  const view = includeFirm ? firmView : sharedView
  const rows = progressFor(view, period, prior)
  const totals = planTotals(view)
  const pillarRows = rows.filter((r) => r.level === 'pillar')
  const added = pillarRows.reduce((a, r) => a + r.capturedAdded, 0)
  const atEnd = pillarRows.reduce((a, r) => a + r.capturedAtEnd, 0)
  const atStart = pillarRows.reduce((a, r) => a + r.capturedAtStart, 0)
  const bridge = buildBridge(view, 'both', new Map(pillarRows.map((r) => [r.id, r.capturedAtEnd])), new Map(pillarRows.map((r) => [r.id, r.capturedAtStart])))
  const isCurrent = period.end.getTime() > Date.now()
  const asOf = asOfLabel(period)
  const since = sinceLabel(prior)
  const commentary = (id: string) => firmView.commentary.find((c) => c.pillarId === id && c.periodKey === period.key)?.text ?? ''

  return (
    <div className="min-h-full bg-zinc-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[860px] flex-wrap items-center justify-between gap-3 px-4">
        <Link to={`/c/${view.company.id}/progress?${query}`} className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-3" /> Back to Progress
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
            <input type="checkbox" checked={includeFirm} onChange={(e) => setIncludeFirm(e.target.checked)} />
            Include Firm only items (internal copy)
          </label>
          <ExportButton build={() => progressWorkbook(view, bridge, rows, period, prior)} />
          <Button variant="primary" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>
            Print or save as PDF
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-[860px] bg-white px-10 py-9 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-start justify-between border-b border-zinc-200 pb-4">
          <div>
            <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Supplemental VCP pages · {period.label}</div>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{view.company.name}: value creation progress</h1>
            <div className="mt-0.5 text-[12.5px] text-zinc-500">
              Entry EBITDA {fmtEbitda(view.company.entryEbitda)} → plan target {fmtEbitda(bridge.target)} · numbers as of {asOf}, changes since {since}
            </div>
          </div>
          <Logo />
        </header>

        <section className="mt-5 grid grid-cols-4 gap-3">
          {[
            [isCurrent ? 'Realized to date' : 'Realized at period end', fmtEbitda(atEnd), `${fmtPct(atEnd, totals.target)} of plan`],
            ['Plan target', fmtEbitda(totals.target), `${fmtEbitda(Math.max(0, totals.target - atEnd))} to go`],
            [`Added since ${since}`, fmtDelta(added), `${fmtEbitda(atStart)} then, ${fmtEbitda(atEnd)} now`],
            ['Phases completed', String(pillarRows.reduce((a, r) => a + r.phasesCompleted.length, 0)), `since ${since}`],
          ].map(([k, v, s]) => (
            <div key={k} className="rounded-md border border-zinc-200 px-3 py-2">
              <div className="text-[10.5px] font-medium tracking-wide text-zinc-500 uppercase">{k}</div>
              <div className="tabular text-[18px] font-semibold">{v}</div>
              <div className="text-[11px] text-zinc-500">{s}</div>
            </div>
          ))}
        </section>

        <section className="mt-5 break-inside-avoid">
          <h2 className="mb-1 text-[13px] font-semibold">EBITDA bridge: entry to target by pillar</h2>
          <EbitdaBridge bridge={bridge} height={240} compact asOf={asOf} />
          <BridgeLegend bridge={bridge} sinceLabel={since} className="mt-1" />
        </section>

        <section className="mt-5">
          <h2 className="mb-2 text-[13px] font-semibold">Pillar summary</h2>
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-zinc-200 text-[10.5px] tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="py-1.5 font-medium">Pillar</th>
                <th className="py-1.5 font-medium">Status</th>
                <th className="py-1.5 text-right font-medium">Added since {since}</th>
                <th className="py-1.5 text-right font-medium">Realized / target</th>
              </tr>
            </thead>
            <tbody>
              {pillarRows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="py-1.5">
                    {r.num}. {r.name}
                  </td>
                  <td className="py-1.5">
                    <StatusPill status={r.statusAtEnd} />
                  </td>
                  <td className="tabular py-1.5 text-right">{fmtDelta(r.capturedAdded)}</td>
                  <td className="tabular py-1.5 text-right">
                    {fmtEbitda(r.capturedAtEnd)} / {fmtEbitda(r.target)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {pillarRows.map((r) => {
          const subs = rows.filter((x) => x.level === 'sub' && x.num.startsWith(`${r.num}.`))
          const note = commentary(r.id)
          return (
            <section key={r.id} className="mt-6 break-inside-avoid border-t border-zinc-200 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold">
                  {r.num}. {r.name}
                </h2>
                <StatusPill status={r.statusAtEnd} />
              </div>
              <div className="tabular mt-1 text-[12px] text-zinc-600">
                Realized {fmtEbitda(r.capturedAtEnd)} of {fmtEbitda(r.target)} · {fmtDelta(r.capturedAdded)} since {since} · {r.asksClosed} asks closed
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-[12px]">
                <div>
                  <div className="font-medium text-zinc-500">What moved</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-800">
                    {r.statusChanges.map((c, i) => (
                      <li key={i}>
                        Status {c.from} → {c.to} ({fmtDateYear(c.at)})
                      </li>
                    ))}
                    {r.phasesCompleted.map((p) => (
                      <li key={p}>Completed phase: {p}</li>
                    ))}
                    {r.kpis.map((k) => (
                      <li key={k.name}>
                        {k.name}: {fmtKpi(k.from, k.unit)} → {fmtKpi(k.to, k.unit)} (target {fmtKpi(k.target, k.unit)})
                      </li>
                    ))}
                    {subs
                      .filter((s) => s.capturedAdded !== 0)
                      .map((s) => (
                        <li key={s.id}>
                          {s.name}: {fmtDelta(s.capturedAdded)} captured
                        </li>
                      ))}
                    {!r.statusChanges.length && !r.phasesCompleted.length && !r.kpis.length && !subs.some((s) => s.capturedAdded) && <li className="text-zinc-400">No change logged since {since}.</li>}
                  </ul>
                </div>
                <div>
                  <div className="font-medium text-zinc-500">Commentary</div>
                  {/* Typed here, on the page it appears on. Printed as plain text. */}
                  <textarea
                    className="no-print mt-1 min-h-[72px] w-full resize-y rounded-md border border-zinc-200 px-2 py-1.5 text-[12px] leading-snug placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                    placeholder={`Add commentary for ${period.label}: context the numbers do not show.`}
                    value={note}
                    onChange={(e) => setCommentary(view.company.id, r.id, period.key, e.target.value)}
                  />
                  <p className="print-only mt-1 whitespace-pre-wrap text-zinc-800">{note || <span className="text-zinc-400">No commentary added.</span>}</p>
                </div>
              </div>
            </section>
          )
        })}
        <footer className="mt-8 border-t border-zinc-200 pt-3 text-[10.5px] text-zinc-400">
          Compiled by Pillar from logged updates on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Run-rate EBITDA in USD millions.{' '}
          {includeFirm ? 'Internal copy: includes Firm only items. Do not share with management.' : 'Shared items only, suitable for the board deck.'}
        </footer>
      </article>
    </div>
  )
}
