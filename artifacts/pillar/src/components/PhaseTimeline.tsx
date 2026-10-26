import { useState } from 'react'
import clsx from 'clsx'
import type { Phase } from '../lib/types'
import { fmtDate, fmtDateYear } from '../lib/dates'

const FILL: Record<string, string> = {
  Complete: 'bg-emerald-600 text-white',
  'In progress': 'bg-accent text-white',
  'Not started': 'bg-zinc-200 text-zinc-600',
}

function completion(p: Phase) {
  if (p.status === 'Complete') return 100
  if (p.status === 'Not started') return 0
  // Dates describe the schedule, not how much work has actually been completed.
  return null
}

export interface TimeRange {
  start: number
  end: number
}

/** The span covered by a set of phases, so several timelines can share one axis. */
export function timelineRange(phases: Phase[]): TimeRange | null {
  if (!phases.length) return null
  return {
    start: Math.min(...phases.map((p) => new Date(p.startDate).getTime())),
    end: Math.max(...phases.map((p) => new Date(p.endDate).getTime())),
  }
}

const QUARTER = 1000 * 60 * 60 * 24 * 91.3

/** Quarter ticks and a Today marker for a shared axis; sits above a column of PhaseTimelines. */
export function TimelineAxis({ range, className }: { range: TimeRange; className?: string }) {
  const span = Math.max(1, range.end - range.start)
  const ticks: { left: number; label: string }[] = []
  const first = new Date(range.start)
  const q = new Date(first.getFullYear(), Math.floor(first.getMonth() / 3) * 3, 1)
  for (let t = q; t.getTime() < range.end; t = new Date(t.getFullYear(), t.getMonth() + 3, 1)) {
    const left = ((t.getTime() - range.start) / span) * 100
    if (left < -2) continue
    ticks.push({ left: Math.max(0, left), label: `Q${Math.floor(t.getMonth() / 3) + 1} '${String(t.getFullYear()).slice(2)}` })
  }
  // Label every other quarter once the axis gets busy; the tick marks stay.
  const step = ticks.length > 4 ? 2 : 1
  const today = ((Date.now() - range.start) / span) * 100
  return (
    <div className={clsx('relative h-8 text-[10px] text-zinc-400', className)} aria-hidden>
      {today >= 0 && today <= 100 && (
        <span className="absolute top-0 -translate-x-1/2 rounded-sm bg-red-500 px-1 text-[9px] leading-[14px] font-medium text-white" style={{ left: `${today}%` }}>
          Today
        </span>
      )}
      {ticks.map((t, i) => (
        <span key={t.label} className="absolute bottom-0 h-4 border-l border-zinc-200 pl-1 leading-4 whitespace-nowrap" style={{ left: `${t.left}%` }}>
          {i % step === 0 && t.left < 94 ? t.label : ''}
        </span>
      ))}
    </div>
  )
}

/**
 * One bar per phase on a shared time axis, with a today marker.
 * Each bar is focusable and shows name, dates, status and completion on hover or focus.
 * Pass `range` to line several timelines up on the same axis.
 */
export function PhaseTimeline({ phases, className, labels = true, range }: { phases: Phase[]; className?: string; labels?: boolean; range?: TimeRange | null }) {
  const [pinned, setPinned] = useState<string | null>(null)
  if (!phases.length) return <div className="text-xs text-zinc-400">No phases yet</div>
  const sorted = [...phases].sort((a, b) => a.order - b.order)
  const own = timelineRange(sorted)!
  const start = range?.start ?? own.start
  const end = range?.end ?? own.end
  const span = Math.max(1, end - start)
  const pos = (iso: string) => ((new Date(iso).getTime() - start) / span) * 100
  const today = ((Date.now() - start) / span) * 100

  return (
    <div className={clsx('w-full', className)}>
      <div className="relative h-7">
        {sorted.map((p, i) => {
          const left = Math.max(0, pos(p.startDate))
          const width = Math.min(100 - left, Math.max(2, pos(p.endDate) - left))
          const pct = completion(p)
          const edge = left > 55
          return (
            <div key={p.id} className="group absolute top-1 h-5" style={{ left: `${left}%`, width: `${width}%` }}>
              <button
                type="button"
                onClick={() => setPinned((c) => (c === p.id ? null : p.id))}
                onBlur={() => setPinned(null)}
                aria-expanded={pinned === p.id}
                aria-label={`${p.name}, ${p.status}${pct === null ? '' : `, ${pct}% complete`}`}
                aria-describedby={`phase-tooltip-${p.id}`}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setPinned(null)
                }}
                className={clsx('relative flex h-5 w-full items-center overflow-hidden rounded-[3px] border border-white px-1 text-left text-[10px] leading-none font-medium focus:ring-2 focus:ring-accent/40 focus:outline-none', FILL[p.status])}
              >
                <span className="relative truncate">P{i + 1}</span>
              </button>
              <div
                role="tooltip"
                id={`phase-tooltip-${p.id}`}
                className={clsx(
                  'pointer-events-none absolute bottom-full z-30 mb-1 w-52 rounded-md bg-zinc-900 px-2.5 py-2 text-[11.5px] leading-snug text-white shadow-lg group-focus-within:block group-hover:block',
                  pinned === p.id ? 'block' : 'hidden',
                  edge ? 'right-0' : 'left-0',
                )}
              >
                <div className="font-semibold">{p.name}</div>
                <div className="text-zinc-300">
                  {fmtDate(p.startDate)} – {fmtDateYear(p.endDate)}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span>{p.status}</span>
                  {pct !== null && <span className="tabular">{pct}% complete</span>}
                </div>
                {pct !== null && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                </div>
                )}
                {p.completedAt && <div className="mt-1 text-zinc-300">Completed {fmtDateYear(p.completedAt)}</div>}
              </div>
            </div>
          )
        })}
        {today >= 0 && today <= 100 && (
          <div className="pointer-events-none absolute top-0 h-7 w-px bg-red-500/80" style={{ left: `${today}%` }} title="Today">
            <div className="absolute -top-0.5 -left-[3px] size-[7px] rounded-full bg-red-500" />
          </div>
        )}
      </div>
      {labels && (
        <div className="mt-0.5 flex justify-between text-[10.5px] text-zinc-400">
          <span>{fmtDate(new Date(start).toISOString(), { year: '2-digit' })}</span>
          <span>{fmtDate(new Date(end).toISOString(), { year: '2-digit' })}</span>
        </div>
      )}
    </div>
  )
}
