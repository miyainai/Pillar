import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { onPlan, type View } from '../lib/permissions'
import { isStale, userName } from '../lib/selectors'
import { daysSince } from '../lib/dates'
import { AvatarStack, ProgressBar, STATUS_COLOR, StatusPill } from './ui'

/** Pillar health grid: one tile per pillar the viewer can see. */
export function PillarGrid({ view }: { view: View }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {view.pillars.map((p) => {
        const stale = view.viewer.isFirm && isStale(view, p)
        const behind = p.target > 0 && !onPlan(p.captured, p.planToDate)
        return (
          <Link
            key={p.id}
            to={`/c/${view.company.id}/pillars/${p.id}`}
            className="rounded-md border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 hover:shadow-xs"
            style={{ borderLeft: `3px solid ${STATUS_COLOR[p.status]}` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-[13px] leading-snug font-medium">
                <span className="text-zinc-400">{p.num}.</span> {p.name}
              </div>
              <StatusPill status={p.status} />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between text-xs">
              <span className="tabular font-medium">
                <span className={behind ? 'rounded bg-rose-50 px-1 text-rose-700' : p.target > 0 ? 'text-green-700' : ''}>${p.captured.toFixed(1)}M</span>{' '}
                <span className="font-normal text-zinc-400">of ${p.target.toFixed(1)}M</span>
              </span>
              {p.target === 0 ? (
                <span className="text-[11px] text-zinc-400">Enabler</span>
              ) : (
                <span className={behind ? 'text-[11px] font-medium text-rose-600' : 'text-[11px] text-zinc-400'} title="What the plan says should be captured by today">
                  {behind ? `$${(p.planToDate - p.captured).toFixed(1)}M behind plan` : `plan to date $${p.planToDate.toFixed(1)}M`}
                </span>
              )}
            </div>
            <ProgressBar value={p.captured} max={p.target} className="mt-1" color={behind ? '#e11d48' : undefined} />
            <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-zinc-500">
              <AvatarStack names={p.ownerIds.map((id) => userName(view, id))} size={18} />
              <span className={stale ? 'inline-flex items-center gap-1 font-medium text-amber-700' : 'inline-flex items-center gap-1'}>
                <Clock className="size-3" />
                {stale ? `Stale · ${daysSince(p.lastUpdated)}d` : `${daysSince(p.lastUpdated)}d ago`}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
