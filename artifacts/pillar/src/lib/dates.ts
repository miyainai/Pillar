const DAY = 86_400_000

export const nowIso = () => new Date().toISOString()

export function daysAgo(n: number, from: Date = new Date()): string {
  return new Date(from.getTime() - n * DAY).toISOString()
}

export function daysFromNow(n: number, from: Date = new Date()): string {
  return new Date(from.getTime() + n * DAY).toISOString()
}

export function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / DAY)
}

export function daysSince(iso: string): number {
  return Math.max(0, daysBetween(iso, nowIso()))
}

export function monthsSince(iso: string): number {
  const a = new Date(iso)
  const b = new Date()
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) m -= 1
  return Math.max(0, m)
}

export function fmtDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...opts })
}

export function fmtDateYear(iso: string | undefined): string {
  return fmtDate(iso, { year: 'numeric' })
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const future = diff < 0
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60_000)
  let s: string
  if (mins < 1) return 'just now'
  if (mins < 60) s = `${mins}m`
  else if (mins < 60 * 24) s = `${Math.round(mins / 60)}h`
  else if (mins < 60 * 24 * 60) s = `${Math.round(mins / 1440)}d`
  else s = `${Math.round(mins / 43_200)}mo`
  return future ? `in ${s}` : `${s} ago`
}

/** yyyy-mm-dd for <input type="date">. */
export function toInputDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromInputDate(v: string, endOfDay = false): string {
  const [y, m, d] = v.split('-').map(Number)
  const date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 12)
  return date.toISOString()
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

// ---------- Periods for the Progress view ----------

export type PeriodKind = 'week' | 'month' | 'quarter' | 'custom'

export interface Period {
  kind: PeriodKind
  start: Date
  end: Date
  label: string
  key: string
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7 // Monday = 0
  x.setDate(x.getDate() - dow)
  return x
}

export function periodFor(kind: Exclude<PeriodKind, 'custom'>, offset: number, ref = new Date()): Period {
  if (kind === 'week') {
    const start = startOfWeek(ref)
    start.setDate(start.getDate() + offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return {
      kind,
      start,
      end,
      label: `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      key: `W-${toInputDate(start.toISOString())}`,
    }
  }
  if (kind === 'month') {
    const start = new Date(ref.getFullYear(), ref.getMonth() + offset, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    return {
      kind,
      start,
      end,
      label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      key: `M-${start.getFullYear()}-${start.getMonth() + 1}`,
    }
  }
  const q = Math.floor(ref.getMonth() / 3) + offset
  const start = new Date(ref.getFullYear(), q * 3, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 1)
  const qn = Math.floor(start.getMonth() / 3) + 1
  return { kind, start, end, label: `Q${qn} ${start.getFullYear()}`, key: `Q-${start.getFullYear()}-${qn}` }
}

export function customPeriod(startIso: string, endIso: string): Period {
  const start = new Date(startIso)
  const end = new Date(endIso)
  return {
    kind: 'custom',
    start,
    end,
    label: `${fmtDate(startIso, { year: 'numeric' })} – ${fmtDate(endIso, { year: 'numeric' })}`,
    key: `C-${toInputDate(startIso)}-${toInputDate(endIso)}`,
  }
}

/** The equal-length period immediately before this one. */
export function priorPeriod(p: Period): Period {
  if (p.kind !== 'custom') {
    const ref = new Date(p.start.getTime() - 1)
    return periodFor(p.kind, 0, ref)
  }
  const len = p.end.getTime() - p.start.getTime()
  const start = new Date(p.start.getTime() - len)
  return { ...p, start, end: new Date(p.start), label: 'Prior period', key: p.key + '-prior' }
}

export function inPeriod(iso: string | undefined, p: Period): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= p.start.getTime() && t < p.end.getTime()
}

/**
 * The Progress view compares two points in time: numbers are read "as of" the end of the
 * selected period and changes are everything logged "since" the end of the comparison period.
 * Comparing a period with itself gives an empty window, so every change reads as zero.
 */
export interface Window {
  since: Date
  asOf: Date
}

export function windowFor(period: Period, prior: Period): Window {
  const asOf = period.end
  return { since: new Date(Math.min(prior.end.getTime(), asOf.getTime())), asOf }
}

export function inWindow(iso: string | undefined, w: Window): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= w.since.getTime() && t < w.asOf.getTime()
}

/** The last calendar day of a period, for labels. */
function lastDay(p: Period): string {
  return fmtDateYear(new Date(p.end.getTime() - 1).toISOString())
}

/** "today" while the period is still running, otherwise its last day ("end of Q3 2026", "Oct 18, 2026"). */
export function asOfLabel(period: Period, now = Date.now()): string {
  if (period.end.getTime() > now) return 'today'
  return period.kind === 'month' || period.kind === 'quarter' ? `end of ${period.label}` : lastDay(period)
}

/** The comparison point, phrased so it reads after "since": "end of Q3 2026", "Sep 30, 2026". */
export function sinceLabel(prior: Period): string {
  return prior.kind === 'month' || prior.kind === 'quarter' ? `end of ${prior.label}` : lastDay(prior)
}
