import { useSearchParams } from 'react-router-dom'
import { customPeriod, fmtDateYear, fromInputDate, periodFor, toInputDate, type Period, type PeriodKind } from './dates'

/**
 * Period selection lives in the URL so the export page uses the same one.
 *
 *   p    week | month | quarter | custom
 *   o    offset of the period from today (0 = current, -1 = last …)
 *   c    offset of the comparison period; defaults to the one just before, never after the period
 *   to   custom: the "as of" date (yyyy-mm-dd)
 *   cto  custom: the "compared with" date; defaults to the start of the current quarter
 *
 * Numbers are read as of the end of the period; changes are everything since the end of the
 * comparison period (see windowFor in dates.ts).
 */
export function usePeriod() {
  const [params, setParams] = useSearchParams()
  const kind = (params.get('p') as PeriodKind) || 'quarter'
  const offset = Math.min(0, Number(params.get('o') ?? 0) || 0)
  const to = params.get('to')
  const cParam = params.get('c')
  const cto = params.get('cto')

  let period: Period
  let prior: Period
  let compareOffset = offset - 1
  let defaultCompare: boolean
  if (kind === 'custom') {
    const asOf = fromInputDate(to || toInputDate(new Date().toISOString()), true)
    const since = cto ? fromInputDate(cto, true) : new Date(periodFor('quarter', 0).start.getTime() - 1).toISOString()
    period = customPeriod(since, asOf)
    // Only the end of the comparison period matters; label it by that day.
    prior = { ...customPeriod(since, since), label: fmtDateYear(since) }
    defaultCompare = !cto
  } else {
    period = periodFor(kind, offset)
    if (cParam !== null && cParam !== '') compareOffset = Math.min(offset, Number(cParam) || 0)
    prior = periodFor(kind, compareOffset)
    defaultCompare = compareOffset === offset - 1
  }

  const set = (next: Record<string, string | number | undefined>) => {
    const merged: Record<string, string> = {}
    const current = { p: kind, o: offset, to: to ?? undefined, c: cParam ?? undefined, cto: cto ?? undefined }
    for (const [k, v] of Object.entries({ ...current, ...next })) if (v !== undefined && v !== '') merged[k] = String(v)
    setParams(merged, { replace: true })
  }

  return { kind, offset, period, prior, compareOffset, defaultCompare, set, query: params.toString() }
}
