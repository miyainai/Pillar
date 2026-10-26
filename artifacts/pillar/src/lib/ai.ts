// Client side of the AI features. Every call has a demo fallback: if AI is not
// configured, fails, or runs past the time limit, a pre-generated result loads.

import type { GeneratedPlan } from './store'
import type { Ask, Visibility } from './types'
import { FALLBACK_PLAN } from './fallbackPlan'

export const GENERATE_TIMEOUT_MS = 75_000

interface RawPhase {
  name: string
  description?: string
  deliverables?: string[]
  startMonth: number
  endMonth: number
}
interface RawKpi {
  name: string
  unit: string
  baseline: number
  target: number
}
export interface RawSub {
  name: string
  objective?: string
  targetImpact: number
  visibility?: string
  owners?: string[]
  startMonth?: number
  targetMonth?: number
  phases?: RawPhase[]
  kpis?: RawKpi[]
}
export interface RawPillar extends RawSub {
  rationale?: string
  sourceRef?: string
  subPillars?: RawSub[]
}
export interface RawPlan {
  pillars: RawPillar[]
  warnings?: string[]
}

export interface Person {
  id: string
  name: string
  role: string
  title: string
}

export type AiSource = 'ai' | 'fallback'

/**
 * Why a call fell back. `not_configured` is the expected state when no API key is set and is
 * presented neutrally; the others are genuine failures and keep their warnings.
 */
export type AiFailure = 'not_configured' | 'timeout' | 'skipped' | 'error'

export class AiError extends Error {
  constructor(
    readonly code: AiFailure,
    message: string,
  ) {
    super(message)
    this.name = 'AiError'
  }
}

export function failureOf(err: unknown): AiFailure {
  return err instanceof AiError ? err.code : 'error'
}

async function post<T>(path: string, body: unknown, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs)
  signal?.addEventListener('abort', () => ctrl.abort(new Error('skipped')))
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (data.error === 'not_configured') throw new AiError('not_configured', 'AI is not configured (no API key on the server).')
      throw new AiError('error', data.error || `Request failed (${res.status})`)
    }
    return data as T
  } catch (err) {
    if (ctrl.signal.aborted) {
      const reason = ctrl.signal.reason instanceof Error ? ctrl.signal.reason.message : ''
      if (reason === 'skipped') throw new AiError('skipped', 'Skipped by user.')
      throw new AiError('timeout', `AI took longer than ${Math.round(timeoutMs / 1000)} seconds.`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ---------------- VCP generation ----------------

export interface GenerateResult {
  plan: GeneratedPlan
  source: AiSource
  /** Set when `source` is 'fallback'. */
  failure?: AiFailure
  reason?: string
  warnings: string[]
}

export async function generatePlan(
  input: {
    company: { name: string; sector: string; entryEbitda: number; exitEbitda: number; holdYears: number; closeDate: string }
    settings: { pillarCount: number; detail: string; levers: string[] }
    people: Person[]
    documents: { name: string; type: string; text: string }[]
  },
  signal?: AbortSignal,
): Promise<GenerateResult> {
  try {
    const { plan } = await post<{ plan: RawPlan }>(
      '/api/generate',
      { ...input, people: input.people.map(({ name, role, title }) => ({ name, role, title })) },
      GENERATE_TIMEOUT_MS,
      signal,
    )
    if (!plan?.pillars?.length) throw new Error('AI returned an empty plan.')
    return { plan: normalizePlan(plan, input.people, input.company.closeDate), source: 'ai', warnings: plan.warnings ?? [] }
  } catch (err) {
    return {
      plan: normalizePlan(FALLBACK_PLAN, input.people, input.company.closeDate),
      source: 'fallback',
      failure: failureOf(err),
      reason: err instanceof Error ? err.message : String(err),
      warnings: [],
    }
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : Number.isFinite(Number(x)) ? Number(x) : d)

function monthsFrom(closeIso: string, months: number) {
  const d = new Date(closeIso)
  d.setMonth(d.getMonth() + Math.max(0, Math.round(months)))
  return d.toISOString()
}

function ownerIds(names: string[] | undefined, people: Person[]) {
  return (names ?? [])
    .map((n) => people.find((p) => p.name.toLowerCase() === String(n).toLowerCase())?.id)
    .filter((x): x is string => !!x)
}

const vis = (v: unknown): Visibility => (v === 'firm' ? 'firm' : 'shared')

function phasesOf(raw: RawPhase[] | undefined, closeIso: string) {
  return (raw ?? []).map((ph) => {
    const start = num(ph.startMonth)
    const end = Math.max(start + 1, num(ph.endMonth, start + 3))
    return {
      name: String(ph.name ?? 'Phase'),
      description: String(ph.description ?? ''),
      deliverables: (ph.deliverables ?? []).map(String),
      startDate: monthsFrom(closeIso, start),
      endDate: monthsFrom(closeIso, end),
      status: 'Not started' as const,
    }
  })
}

function kpisOf(raw: RawKpi[] | undefined) {
  return (raw ?? []).map((k) => ({ name: String(k.name), unit: String(k.unit ?? ''), baseline: num(k.baseline), target: num(k.target), actuals: [] }))
}

/** Map AI JSON onto the section 3 objects. Sub-pillar targets are made to sum exactly to the pillar. */
export function normalizePlan(raw: RawPlan, people: Person[], closeIso: string): GeneratedPlan {
  return {
    pillars: raw.pillars.slice(0, 8).map((p) => {
      const pillarTarget = round1(Math.max(0, num(p.targetImpact)))
      const subsRaw = p.subPillars ?? []
      let subTargets = subsRaw.map((s) => Math.max(0, num(s.targetImpact)))
      const subSum = subTargets.reduce((a, b) => a + b, 0)
      if (subsRaw.length) {
        subTargets = subSum > 0 ? subTargets.map((t) => round1((t / subSum) * pillarTarget)) : subTargets.map(() => round1(pillarTarget / subsRaw.length))
        // Put any rounding remainder on the largest sub-pillar.
        const diff = round1(pillarTarget - subTargets.reduce((a, b) => a + b, 0))
        if (diff !== 0) {
          const i = subTargets.indexOf(Math.max(...subTargets))
          subTargets[i] = round1(subTargets[i] + diff)
        }
      }
      return {
        name: String(p.name),
        objective: String(p.objective ?? ''),
        rationale: String(p.rationale ?? ''),
        sourceRef: String(p.sourceRef ?? ''),
        targetImpact: pillarTarget,
        ownerIds: ownerIds(p.owners, people),
        status: 'Not started' as const,
        visibility: vis(p.visibility),
        startDate: monthsFrom(closeIso, num(p.startMonth)),
        targetDate: monthsFrom(closeIso, num(p.targetMonth, 24)),
        subPillars: subsRaw.map((s, i) => ({
          name: String(s.name),
          objective: String(s.objective ?? ''),
          targetImpact: subTargets[i],
          ownerIds: ownerIds(s.owners ?? p.owners, people),
          status: 'Not started' as const,
          // A sub-pillar under a Firm only pillar is Firm only too.
          visibility: vis(p.visibility) === 'firm' ? 'firm' : vis(s.visibility),
          startDate: monthsFrom(closeIso, num(s.startMonth, num(p.startMonth))),
          targetDate: monthsFrom(closeIso, num(s.targetMonth, num(p.targetMonth, 24))),
          phases: phasesOf(s.phases, closeIso),
          kpis: kpisOf(s.kpis),
        })),
        phases: subsRaw.length ? [] : phasesOf(p.phases, closeIso),
        kpis: subsRaw.length ? [] : kpisOf(p.kpis),
      }
    }),
  }
}

// ---------------- Regenerate ----------------

export async function regenerate(
  kind: 'pillar' | 'subPillar',
  current: RawPillar | RawSub,
  instruction: string,
  context: { company: string; people: Person[]; parentPillar?: string },
): Promise<RawPillar | RawSub> {
  const { result } = await post<{ result: RawPillar }>(
    '/api/regenerate',
    { kind, current, instruction, context: { ...context, people: context.people.map(({ name, role }) => ({ name, role })) } },
    45_000,
  )
  if (!result?.name) throw new Error('AI returned an empty result.')
  return result
}

// ---------------- Management version assist ----------------

export async function suggestMgmtVersion(ask: Ask): Promise<{ title: string; description: string; source: AiSource; failure?: AiFailure; reason?: string }> {
  try {
    const { result } = await post<{ result: { title: string; description: string } }>(
      '/api/suggest',
      { title: ask.title, description: ask.description ?? '', dueDate: ask.dueDate },
      20_000,
    )
    if (!result?.title) throw new AiError('error', 'AI returned an empty result.')
    return { ...result, source: 'ai' }
  } catch (err) {
    return { ...localSuggestion(ask), source: 'fallback', failure: failureOf(err), reason: err instanceof Error ? err.message : String(err) }
  }
}

/** Note shown under a drafted management version. Without an API key the template is the expected path, so no warning; real failures say why. */
export function suggestionNote(r: { source: AiSource; failure?: AiFailure; reason?: string }): string {
  if (r.source === 'ai') return 'Drafted for you. Check it before sending.'
  if (r.failure === 'not_configured') return 'Drafted from a template. Check it before sending.'
  return `Drafted from a template because AI did not respond (${r.reason}). Check it before sending.`
}

/** Pre-written suggestions for the demo, plus a plain template for anything else. */
function localSuggestion(ask: Ask): { title: string; description: string } {
  const due = new Date(ask.dueDate).toLocaleDateString('en-US', { weekday: 'long' })
  const t = ask.title.toLowerCase()
  if (t.includes('cogs') || (t.includes('sku') && t.includes('supplier')))
    return {
      title: 'Monthly COGS by SKU and supplier, last 24 months',
      description: `Please send monthly cost of goods sold by SKU and supplier for the last 24 months, in Excel, by ${due}.`,
    }
  if (t.includes('oee') || t.includes('downtime'))
    return {
      title: 'Line-level OEE and downtime logs, last 6 months',
      description: `Please send OEE and downtime logs by line and shift for the last 6 months, in Excel, by ${due}.`,
    }
  const clean = ask.title.replace(/^(need|want|get)\s+/i, '')
  return {
    title: clean.charAt(0).toUpperCase() + clean.slice(1),
    description: `Please send ${clean.charAt(0).toLowerCase() + clean.slice(1)}, in Excel, by ${due}.`,
  }
}
