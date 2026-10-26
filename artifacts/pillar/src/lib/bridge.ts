// The EBITDA bridge: entry EBITDA → one step per pillar → target EBITDA.
// Pure data, shared by the chart, the Excel export and the board supplement.

import type { View } from './permissions'
import { pillarColor, TOTAL_COLOR } from './colors'

export type BridgeMode = 'both' | 'realized' | 'gap'

export const BRIDGE_MODES: { value: BridgeMode; label: string }[] = [
  { value: 'realized', label: 'Realized' },
  { value: 'gap', label: 'To go' },
  { value: 'both', label: 'Both' },
]

export interface BridgeStep {
  key: string
   kind: 'total' | 'pillar' | 'organic'
  /** Label under the bar (wrapped by the chart). */
  label: string
  /** Full name for tooltips and exports. */
  name: string
  color: string
  /** Where the bar starts, in $M. Totals start at 0. */
  base: number
  /** Realized (solid) height, in $M. */
  solid: number
  /** Yet-to-realize (outlined) height, in $M. */
  outline: number
  /** Running EBITDA after this step, in $M. */
  total: number
  // Pillar steps only
  num?: number
  target?: number
  realized?: number
  gap?: number
  status?: string
  /** Part of the realized height added since the comparison point (Progress view only). */
  gained?: number
}

export interface Bridge {
  mode: BridgeMode
  steps: BridgeStep[]
  entry: number
  current: number
  target: number
  realized: number
  gap: number
  /** Realized EBITDA added since the comparison point, when the bridge has one. */
  gained?: number
  /** Underwritten exit EBITDA when it differs from the plan target (firm view only). */
  icCase?: number
  /** Enabler pillars without an EBITDA target; they do not get a bar. */
  excluded: string[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * @param realizedById captured EBITDA per pillar id, when the chart should show a point in
 * time other than now (the Progress view passes captured-at-period-end).
 * @param sinceById captured EBITDA per pillar id at the comparison point; the difference is
 * drawn as the "added since" part of each bar.
 */
export function buildBridge(view: View, mode: BridgeMode = 'both', realizedById?: Map<string, number>, sinceById?: Map<string, number>, organic?: { target: number; realized: number }): Bridge {
  const entry = view.company.entryEbitda
  const pillars = view.pillars.map((p) => {
    const realized = Math.max(0, realizedById?.get(p.id) ?? p.captured)
    const target = Math.max(0, p.target)
    const gained = sinceById ? Math.max(0, Math.min(realized, realized - (sinceById.get(p.id) ?? realized))) : undefined
    return { p, realized, target, gap: Math.max(0, target - realized), span: Math.max(target, realized), gained }
  })
  const shown = pillars.filter((x) => x.span > 0)
  const organicRealized = organic?.realized ?? 0
  const organicGap = Math.max(0, (organic?.target ?? 0) - organicRealized)
  const realized = r2(shown.reduce((a, x) => a + x.realized, organicRealized))
  const gap = r2(shown.reduce((a, x) => a + x.gap, organicGap))
  const current = r2(entry + realized)
  const target = r2(entry + realized + gap)

  const steps: BridgeStep[] = []
  const total = (key: string, name: string, label: string, solid: number, outline: number): BridgeStep => ({
    key,
    kind: 'total',
    label,
    name,
    color: TOTAL_COLOR,
    base: 0,
    solid: r2(solid),
    outline: r2(outline),
    total: r2(solid + outline),
  })

  let running = mode === 'gap' ? current : entry
  steps.push(mode === 'gap' ? total('current', 'Current EBITDA', 'Current', current, 0) : total('entry', 'Entry EBITDA', 'Entry', entry, 0))
  if (organic) {
    const solid = mode === 'gap' ? 0 : organicRealized
    const outline = mode === 'realized' ? 0 : organicGap
    steps.push({
      key: 'organic', kind: 'organic', label: 'Organic / steady-state', name: 'Organic / steady-state',
      color: '#64748b', base: r2(running), solid: r2(solid), outline: r2(outline),
      total: r2(running + solid + outline), target: organic.target, realized: organicRealized, gap: organicGap,
    })
    running += solid + outline
  }
  for (const { p, realized: pr, target: pt, gap: pg, span, gained } of shown) {
    const solid = mode === 'gap' ? 0 : pr
    const outline = mode === 'realized' ? 0 : pg
    const height = mode === 'both' ? span : solid + outline
    steps.push({
      key: p.id,
      kind: 'pillar',
      label: p.name,
      name: p.name,
      num: p.num,
      color: pillarColor(p.num),
      base: r2(running),
      solid: r2(solid),
      outline: r2(outline),
      total: r2(running + height),
      target: pt,
      realized: pr,
      gap: pg,
      status: p.status,
      gained: mode === 'gap' ? undefined : gained,
    })
    running += height
  }
  steps.push(mode === 'realized' ? total('current', 'Current EBITDA', 'Current', current, 0) : total('target', 'Target EBITDA', 'Target', current, gap))

  const icCase = view.viewer.isFirm && Math.abs(view.company.exitEbitda - target) > 0.05 ? view.company.exitEbitda : undefined
  const gained = sinceById ? r2(shown.reduce((a, x) => a + (x.gained ?? 0), 0)) : undefined
  return { mode, steps, entry, current, target, realized, gap, gained, icCase, excluded: pillars.filter((x) => x.span <= 0).map((x) => x.p.name) }
}

export const fmtEbitda = (n: number) => `$${n.toFixed(1)}M`
/** Dashboard alone opts in; historical Progress and board consumers stay pillar-only. */
export const buildDashboardBridge = (view: View) => buildBridge(view, 'both', undefined, undefined, {
  target: view.company.organicTargetEbitda ?? 0,
  realized: view.company.organicRealizedEbitda ?? 0,
})
export const fmtPct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—')
