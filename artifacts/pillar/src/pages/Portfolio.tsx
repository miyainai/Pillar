import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { companiesFor, scopeFor } from '../lib/permissions'
import { healthOf, isAskOpen, isOverdue, planTotals, statusCounts } from '../lib/selectors'
import { monthsSince } from '../lib/dates'
import { PLAN_STATUSES } from '../lib/types'
import { PageHeader, ProgressBar, STATUS_COLOR, StatusPill } from '../components/ui'
import { ExportButton } from '../components/ExportButton'
import { portfolioWorkbook } from '../lib/exports'

export default function Portfolio() {
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const me = db.users.find((u) => u.id === userId)!
  const views = companiesFor(db, userId)
    .map((c) => scopeFor(db, userId, c.id)!)
    .filter(Boolean)
  const isFirm = views.some((v) => v.viewer.isFirm)

  return (
    <div>
      <PageHeader title="Portfolio" subtitle={`${me.name} · ${views.length} ${views.length === 1 ? 'company' : 'companies'} assigned`} actions={<ExportButton build={() => portfolioWorkbook(views)} />} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {views.map((v) => {
          const totals = planTotals(v)
          const counts = statusCounts(v)
          const health = healthOf(v)
          const open = v.asks.filter(isAskOpen)
          const overdue = v.asks.filter(isOverdue)
          const draft = v.vcpVersions.at(-1) && !v.vcpVersions.at(-1)!.lockedAt
          return (
            <Link key={v.company.id} to={`/c/${v.company.id}`} className="group rounded-lg border border-zinc-200 bg-white p-4 shadow-xs transition hover:border-zinc-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[15px] font-semibold group-hover:text-accent">{v.company.name}</div>
                  <div className="text-xs text-zinc-500">
                    {v.company.sector} · {monthsSince(v.company.closeDate)} months since close · {v.viewer.role}
                  </div>
                </div>
                {draft ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">Draft plan</span> : <StatusPill status={health.status} />}
              </div>

              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-zinc-500">Captured vs. target run-rate EBITDA</span>
                  <span className="tabular font-medium">
                    ${totals.captured.toFixed(1)}M <span className="text-zinc-400">/ ${totals.target.toFixed(1)}M</span>
                  </span>
                </div>
                <ProgressBar value={totals.captured} max={totals.target} className="mt-1.5" />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 text-xs text-zinc-500">{v.pillars.length} pillars by status</div>
                <div className="flex h-2 overflow-hidden rounded-full bg-zinc-100">
                  {PLAN_STATUSES.map((s) =>
                    counts[s] ? <div key={s} title={`${counts[s]} ${s}`} style={{ flex: counts[s], background: STATUS_COLOR[s] }} /> : null,
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-zinc-500">
                  {PLAN_STATUSES.filter((s) => counts[s]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1">
                      <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                      {counts[s]} {s.toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex gap-4 border-t border-zinc-100 pt-3 text-xs">
                <span>
                  <span className="tabular font-semibold">{open.length}</span> <span className="text-zinc-500">{v.viewer.isMgmt ? 'open requests' : 'open asks'}</span>
                </span>
                <span className={overdue.length ? 'text-red-600' : ''}>
                  <span className="tabular font-semibold">{overdue.length}</span> <span className={overdue.length ? '' : 'text-zinc-500'}>overdue</span>
                </span>
                <span className="ml-auto text-zinc-400">
                  ${v.company.entryEbitda}M → ${v.company.exitEbitda}M
                </span>
              </div>
            </Link>
          )
        })}
        {isFirm && (
          <Link to="/setup" className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800">
            <Plus className="size-5" />
            <span className="font-medium">Set up a new company</span>
            <span className="text-xs text-zinc-400">Upload the IC memo and model; AI drafts the plan</span>
          </Link>
        )}
      </div>
    </div>
  )
}
