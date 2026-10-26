// Workbook builders: the data behind each view, laid out so a chart can be
// rebuilt in Excel in one step. The on-screen chart is embedded next to it.

import type { View } from './permissions'
import type { Ask, KPI } from './types'
import type { Bridge } from './bridge'
import { asOfLabel, fmtDateYear, sinceLabel, type Period } from './dates'
import { fmtKpi, healthOf, isAskOpen, isOverdue, planTotals, userName, type PillarProgress } from './selectors'
import type { SheetSpec, WorkbookSpec } from './excel'
import { pillarColor, TOTAL_COLOR } from './colors'
import { SOURCE_LABEL, trailText, type LibraryFile } from './fileLibrary'

const M = '0.0'
const PCT = '0%'
const date = (iso?: string | null) => (iso ? new Date(iso) : null)
const people = (v: View, ids: string[]) =>
  ids
    .map((id) => {
      const m = v.members.find((x) => x.user.id === id)
      return m ? `${m.user.name} (${m.user.title || m.role})` : userName(v, id)
    })
    .join(', ')
const stamp = () => new Date().toISOString().slice(0, 10)
const file = (v: View, what: string) => `${v.company.name} - ${what} ${stamp()}.xlsx`

export function bridgeSheet(view: View, bridge: Bridge, asOf: string): SheetSpec {
  // Excel has no waterfall that survives editing, so the bridge is a stacked column: an invisible
  // "starts at" spacer, the realized part in the pillar colour, the rest as an outlined block.
  const colors = bridge.steps.map((s) => s.color.replace('#', ''))
  return {
    name: 'EBITDA bridge',
    title: `${view.company.name}: EBITDA bridge`,
    subtitle: `Entry EBITDA to target by ${bridge.steps.some((s) => s.kind === 'organic') ? 'organic growth and pillar' : 'pillar'}, run-rate $M · as of ${asOf}`,
    columns: [
      { header: 'Step', key: 'name', width: 34 },
      { header: 'Type', key: 'kind', width: 10 },
      { header: 'Starts at ($M)', key: 'base', numFmt: M, width: 14 },
      { header: 'Realized ($M)', key: 'solid', numFmt: M, width: 14 },
      { header: 'Yet to realize ($M)', key: 'outline', numFmt: M, width: 18 },
      { header: 'Ends at ($M)', key: 'total', numFmt: M, width: 13 },
      { header: bridge.steps.some((s) => s.kind === 'organic') ? 'Contribution target ($M)' : 'Pillar target ($M)', key: 'target', numFmt: M, width: 23 },
      { header: '% realized', key: 'pct', numFmt: PCT, width: 11 },
      { header: 'Status', key: 'status', width: 13 },
    ],
    rows: bridge.steps.map((s) => ({
      name: s.kind === 'pillar' ? `${s.num}. ${s.name}` : s.name,
      kind: s.kind === 'pillar' ? 'Pillar' : s.kind === 'organic' ? 'Organic' : 'Total',
      base: s.base,
      solid: s.solid,
      outline: s.outline,
      total: s.total,
      target: s.target ?? null,
      pct: s.kind !== 'total' && s.target ? (s.realized ?? 0) / s.target : null,
      status: s.status ?? '',
    })),
    notes: [
      `Entry ${bridge.entry.toFixed(1)} → current ${bridge.current.toFixed(1)} → target ${bridge.target.toFixed(1)} ($M). Realized ${bridge.realized.toFixed(1)} of ${(bridge.realized + bridge.gap).toFixed(1)} planned.`,
      ...(bridge.icCase !== undefined ? [`Underwritten exit EBITDA (IC case): ${bridge.icCase.toFixed(1)} $M.`] : []),
      ...(bridge.excluded.length ? [`Not charted (no EBITDA target): ${bridge.excluded.join(', ')}.`] : []),
      'Chart view: ' + (bridge.mode === 'both' ? 'realized + yet to realize' : bridge.mode === 'realized' ? 'realized only' : 'yet to realize only') + '.',
    ],
    chart: {
      kind: 'stackedColumn',
      title: 'EBITDA bridge, run-rate $M',
      categories: 'name',
      valueFormat: M,
      series: [
        { key: 'base', fill: 'none', hideLegend: true },
        { key: 'solid', name: 'Realized', fill: TOTAL_COLOR.replace('#', ''), pointFills: colors },
        { key: 'outline', name: 'Yet to realize', fill: 'FAFAFA', pointOutlines: colors },
      ],
      size: { cols: 10, rows: 20 },
    },
  }
}

export function pillarDetailSheet(view: View, rows: PillarProgress[], period: Period, prior: Period): SheetSpec {
  const asOf = asOfLabel(period)
  const since = sinceLabel(prior)
  return {
    name: 'By pillar',
    title: `What moved by pillar · ${period.label}`,
    subtitle: `Numbers as of ${asOf}; changes since ${since}. Built from the updates people posted.`,
    columns: [
      { header: '#', key: 'num', width: 6 },
      { header: 'Pillar / sub-pillar', key: 'name', width: 36 },
      { header: 'Level', key: 'level', width: 10 },
      { header: `Status as of ${asOf}`, key: 'status', width: 18 },
      { header: 'Status changes', key: 'changes', width: 28 },
      { header: 'Phases completed', key: 'phases', width: 30 },
      { header: `Realized at ${since} ($M)`, key: 'atStart', numFmt: M, width: 24 },
      { header: `Added since ${since} ($M)`, key: 'added', numFmt: M, width: 22 },
      { header: `Realized as of ${asOf} ($M)`, key: 'atEnd', numFmt: M, width: 24 },
      { header: 'Target ($M)', key: 'target', numFmt: M, width: 12 },
      { header: '% realized', key: 'pct', numFmt: PCT, width: 11 },
      { header: 'KPI movement', key: 'kpis', width: 44 },
      { header: 'Asks closed', key: 'asks', width: 11 },
      { header: 'Updates posted', key: 'updates', width: 14 },
    ],
    rows: rows.map((r) => ({
      num: r.num,
      name: r.name,
      level: r.level === 'pillar' ? 'Pillar' : 'Sub-pillar',
      status: r.statusAtEnd,
      changes: r.statusChanges.map((c) => `${c.from} → ${c.to}`).join('; '),
      phases: r.phasesCompleted.join('; '),
      atStart: r.capturedAtStart,
      added: r.capturedAdded,
      atEnd: r.capturedAtEnd,
      target: r.target,
      pct: r.target ? r.capturedAtEnd / r.target : null,
      kpis: r.kpis.map((k) => `${k.name}: ${fmtKpi(k.from, k.unit)} → ${fmtKpi(k.to, k.unit)} (target ${fmtKpi(k.target, k.unit)})`).join('; '),
      asks: r.asksClosed,
      updates: r.updates,
    })),
    notes: [`${view.viewer.isFirm ? 'Includes Firm only items.' : 'Shared items only.'}`],
  }
}

export function periodSummarySheet(view: View, rows: PillarProgress[], period: Period, prior: Period): SheetSpec {
  const pillars = rows.filter((r) => r.level === 'pillar')
  const sum = (f: (r: PillarProgress) => number) => pillars.reduce((a, r) => a + f(r), 0)
  const totals = planTotals(view)
  const asOf = asOfLabel(period)
  const since = sinceLabel(prior)
  const metric = (name: string, now: number | string, before: number | string, unit = '') => ({ name, now, before, unit })
  return {
    name: 'Period summary',
    title: `${view.company.name}: progress summary`,
    subtitle: `${period.label} · numbers as of ${asOf}, changes since ${since}`,
    columns: [
      { header: 'Metric', key: 'name', width: 34 },
      { header: `As of ${asOf}`, key: 'now', width: 22 },
      { header: `At ${since}`, key: 'before', width: 22 },
      { header: 'Unit', key: 'unit', width: 8 },
    ],
    rows: [
      metric('Realized EBITDA', sum((r) => r.capturedAtEnd), sum((r) => r.capturedAtStart), '$M'),
      metric(`Added since ${since}`, sum((r) => r.capturedAdded), '', '$M'),
      metric('Plan target', totals.target, '', '$M'),
      metric('Phases completed since', sum((r) => r.phasesCompleted.length), ''),
      metric('Status changes since', rows.reduce((a, r) => a + r.statusChanges.length, 0), ''),
      metric('Asks closed since', sum((r) => r.asksClosed), ''),
      metric('Updates posted since', sum((r) => r.updates), ''),
    ],
    notes: ['Changes count everything logged after the comparison point, up to the end of the period.'],
  }
}

export function progressWorkbook(view: View, bridge: Bridge, rows: PillarProgress[], period: Period, prior: Period): WorkbookSpec {
  return {
    filename: file(view, `Progress ${period.label}`),
    sheets: [bridgeSheet(view, bridge, asOfLabel(period)), periodSummarySheet(view, rows, period, prior), pillarDetailSheet(view, rows, period, prior)],
  }
}

export function dashboardBridgeWorkbook(view: View, bridge: Bridge): WorkbookSpec {
  return { filename: file(view, 'EBITDA bridge'), sheets: [bridgeSheet(view, bridge, 'today'), planSheet(view)] }
}

export function planSheet(view: View): SheetSpec {
  const rows: Record<string, unknown>[] = []
  for (const p of view.pillars) {
    rows.push({
      num: String(p.num),
      name: p.name,
      level: 'Pillar',
      objective: p.objective,
      target: p.target,
      captured: p.captured,
      pct: p.target ? p.captured / p.target : null,
      owners: people(view, p.ownerIds),
      status: p.status,
      visibility: p.visibility === 'shared' ? 'Shared' : 'Firm only',
      start: date(p.startDate),
      end: date(p.targetDate),
      updated: date(p.lastUpdated),
    })
    for (const s of view.subPillars.filter((x) => x.pillarId === p.id))
      rows.push({
        num: s.num,
        name: s.name,
        level: 'Sub-pillar',
        objective: s.objective,
        target: s.targetImpact,
        captured: s.capturedImpact,
        pct: s.targetImpact ? s.capturedImpact / s.targetImpact : null,
        owners: people(view, s.ownerIds),
        status: s.status,
        visibility: s.visibility === 'shared' ? 'Shared' : 'Firm only',
        start: date(s.startDate),
        end: date(s.targetDate),
        updated: date(s.lastUpdated),
      })
  }
  const totals = planTotals(view)
  return {
    name: 'Plan',
    title: `${view.company.name}: value creation plan`,
    subtitle: `${view.pillars.length} pillars · ${view.subPillars.length} sub-pillars · $${totals.target.toFixed(1)}M target · $${totals.captured.toFixed(1)}M captured (run-rate)`,
    columns: [
      { header: '#', key: 'num', width: 6 },
      { header: 'Name', key: 'name', width: 36 },
      { header: 'Level', key: 'level', width: 11 },
      { header: 'Objective', key: 'objective', width: 50 },
      { header: 'Target ($M)', key: 'target', numFmt: M, width: 12 },
      { header: 'Captured ($M)', key: 'captured', numFmt: M, width: 14 },
      { header: '% captured', key: 'pct', numFmt: PCT, width: 11 },
      { header: 'Owners', key: 'owners', width: 40 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Visibility', key: 'visibility', width: 11 },
      { header: 'Start', key: 'start', width: 13 },
      { header: 'Target date', key: 'end', width: 13 },
      { header: 'Last updated', key: 'updated', width: 13 },
    ],
    rows,
  }
}

export function phasesSheet(view: View): SheetSpec {
  const subName = (id: string | null) => view.subPillars.find((s) => s.id === id)
  const pillarName = (id: string) => view.pillars.find((p) => p.id === id)
  return {
    name: 'Phases',
    title: 'Phases',
    columns: [
      { header: 'Pillar', key: 'pillar', width: 32 },
      { header: 'Sub-pillar', key: 'sub', width: 32 },
      { header: 'Phase', key: 'name', width: 30 },
      { header: 'Status', key: 'status', width: 13 },
      { header: 'Start', key: 'start', width: 13 },
      { header: 'End', key: 'end', width: 13 },
      { header: 'Completed', key: 'completed', width: 13 },
      { header: 'Deliverables', key: 'deliverables', width: 50 },
    ],
    rows: [...view.phases]
      .sort((a, b) => (pillarName(a.pillarId)?.num ?? 0) - (pillarName(b.pillarId)?.num ?? 0) || (subName(a.subPillarId)?.num ?? '').localeCompare(subName(b.subPillarId)?.num ?? '') || a.order - b.order)
      .map((ph) => {
        const p = pillarName(ph.pillarId)
        const s = subName(ph.subPillarId)
        return {
          pillar: p ? `${p.num}. ${p.name}` : '',
          sub: s ? `${s.num} ${s.name}` : '',
          name: ph.name,
          status: ph.status,
          start: date(ph.startDate),
          end: date(ph.endDate),
          completed: date(ph.completedAt),
          deliverables: ph.deliverables.join('; '),
        }
      }),
  }
}

export function kpiSheet(view: View, kpis: KPI[], name = 'KPIs'): SheetSpec {
  const label = (k: KPI) => {
    const p = view.pillars.find((x) => x.id === k.pillarId)
    const s = view.subPillars.find((x) => x.id === k.subPillarId)
    return { pillar: p ? `${p.num}. ${p.name}` : '', sub: s ? `${s.num} ${s.name}` : '' }
  }
  return {
    name,
    title: 'KPIs',
    subtitle: 'Baseline, target and every logged actual',
    columns: [
      { header: 'Pillar', key: 'pillar', width: 32 },
      { header: 'Sub-pillar', key: 'sub', width: 32 },
      { header: 'KPI', key: 'kpi', width: 36 },
      { header: 'Unit', key: 'unit', width: 8 },
      { header: 'Baseline', key: 'baseline', numFmt: '0.00', width: 10 },
      { header: 'Target', key: 'target', numFmt: '0.00', width: 10 },
      { header: 'Date', key: 'date', width: 13 },
      { header: 'Actual', key: 'value', numFmt: '0.00', width: 10 },
    ],
    rows: kpis.flatMap((k): Record<string, unknown>[] => {
      const l = label(k)
      const base = { ...l, kpi: k.name, unit: k.unit, baseline: k.baseline, target: k.target }
      return k.actuals.length ? k.actuals.map((a) => ({ ...base, date: date(a.date), value: a.value })) : [{ ...base, date: null, value: null }]
    }),
  }
}

export function planWorkbook(view: View): WorkbookSpec {
  return { filename: file(view, 'Value creation plan'), sheets: [planSheet(view), phasesSheet(view), kpiSheet(view, view.kpis)] }
}

export function kpiWorkbook(view: View, kpi: KPI): WorkbookSpec {
  const sheet = kpiSheet(view, [kpi], 'KPI')
  sheet.title = kpi.name
  if (kpi.actuals.length)
    sheet.chart = {
      kind: 'line',
      title: `${kpi.name} (${kpi.unit})`,
      categories: 'date',
      categoryDates: true,
      valueFormat: '0.00',
      series: [
        { key: 'value', name: 'Actual', fill: '27272A', markers: true },
        { key: 'target', name: 'Target', fill: 'A1A1AA', dashed: true },
      ],
      size: { cols: 8, rows: 16 },
    }
  return { filename: file(view, `KPI ${kpi.name}`), sheets: [sheet, kpiSheet(view, view.kpis, 'All KPIs')] }
}

export function asksWorkbook(view: View, asks: Ask[], scope: string): WorkbookSpec {
  const pillar = (id: string | null) => view.pillars.find((p) => p.id === id)
  const sub = (id: string | null) => view.subPillars.find((s) => s.id === id)
  return {
    filename: file(view, 'Asks'),
    sheets: [
      {
        name: 'Asks',
        title: `${view.company.name}: asks`,
        subtitle: scope,
        columns: [
          { header: 'Title', key: 'title', width: 48 },
          { header: 'Type', key: 'type', width: 13 },
          { header: 'Status', key: 'status', width: 20 },
          { header: 'Open?', key: 'open', width: 8 },
          { header: 'Overdue?', key: 'overdue', width: 9 },
          { header: 'Urgency', key: 'urgency', width: 10 },
          { header: 'Pillar', key: 'pillar', width: 32 },
          { header: 'Sub-pillar', key: 'sub', width: 32 },
          { header: 'Deal team owner', key: 'assignee', width: 30 },
          { header: 'Management owner', key: 'mgmt', width: 30 },
          { header: 'Raised by', key: 'by', width: 30 },
          { header: 'Created', key: 'created', width: 13 },
          { header: 'Due', key: 'due', width: 13 },
          { header: 'Closed', key: 'closed', width: 13 },
          { header: 'Flagged to MD', key: 'flag', width: 13 },
        ],
        rows: asks.map((a) => {
          const p = pillar(a.pillarId)
          const s = sub(a.subPillarId)
          return {
            title: a.title,
            type: a.type === 'data_request' ? 'Data request' : 'Question',
            status: a.status,
            open: isAskOpen(a) ? 'Yes' : 'No',
            overdue: isOverdue(a) ? 'Yes' : 'No',
            urgency: a.urgency,
            pillar: p ? `${p.num}. ${p.name}` : '',
            sub: s ? `${s.num} ${s.name}` : '',
            assignee: people(view, a.assigneeIds),
            mgmt: a.mgmtAssigneeId ? people(view, [a.mgmtAssigneeId]) : '',
            by: people(view, [a.createdBy]),
            created: date(a.createdAt),
            due: date(a.dueDate),
            closed: date(a.closedAt),
            flag: a.flaggedToMd && !a.flagResolvedAt ? 'Yes' : 'No',
          }
        }),
      },
    ],
  }
}

export function portfolioWorkbook(views: View[]): WorkbookSpec {
  return {
    filename: `Portfolio ${stamp()}.xlsx`,
    sheets: [
      {
        name: 'Portfolio',
        title: 'Portfolio',
        subtitle: 'One row per company, run-rate $M',
        columns: [
          { header: 'Company', key: 'name', width: 30 },
          { header: 'Sector', key: 'sector', width: 20 },
          { header: 'Close date', key: 'close', width: 13 },
          { header: 'Entry EBITDA ($M)', key: 'entry', numFmt: M, width: 16 },
          { header: 'Underwritten exit ($M)', key: 'exit', numFmt: M, width: 20 },
          { header: 'Plan target ($M)', key: 'target', numFmt: M, width: 15 },
          { header: 'Captured ($M)', key: 'captured', numFmt: M, width: 14 },
          { header: '% captured', key: 'pct', numFmt: PCT, width: 11 },
          { header: 'Health', key: 'health', width: 11 },
          { header: 'Pillars', key: 'pillars', width: 8 },
          { header: 'Open asks', key: 'open', width: 10 },
          { header: 'Overdue asks', key: 'overdue', width: 12 },
        ],
        rows: views.map((v) => {
          const t = planTotals(v)
          return {
            name: v.company.name,
            sector: v.company.sector,
            close: date(v.company.closeDate),
            entry: v.company.entryEbitda,
            exit: v.viewer.isFirm ? v.company.exitEbitda : null,
            target: t.target,
            captured: t.captured,
            pct: t.pct,
            health: healthOf(v).label,
            pillars: v.pillars.length,
            open: v.asks.filter(isAskOpen).length,
            overdue: v.asks.filter(isOverdue).length,
          }
        }),
      },
    ],
  }
}

/** The Files tab: one row per file with its trail broken into columns. */
export function filesWorkbook(view: View, files: LibraryFile[], folder: string): WorkbookSpec {
  const originOf = (f: LibraryFile) => {
    if (f.origin.kind === 'update') return `Update by ${userName(view, f.origin.update.authorId)} on ${fmtDateYear(f.origin.update.createdAt)}`
    if (f.origin.kind === 'ask') return `Data request: ${f.origin.ask.title}`
    return 'Deal materials'
  }
  const sheet: SheetSpec = {
    name: 'Files',
    title: `${view.company.name}: file index`,
    subtitle: `${folder} · ${files.length} file${files.length === 1 ? '' : 's'} · exported ${stamp()}`,
    columns: [
      { header: 'File', key: 'name', width: 40 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Source', key: 'source', width: 13 },
      { header: 'Pillar', key: 'pillar', width: 30 },
      { header: 'Sub-pillar', key: 'sub', width: 30 },
      { header: 'Phase', key: 'phase', width: 24 },
      { header: 'Origin', key: 'origin', width: 40 },
      { header: 'Uploaded by', key: 'by', width: 20 },
      { header: 'Date', key: 'date', width: 13 },
      { header: 'Size (KB)', key: 'kb', numFmt: '#,##0', width: 10 },
      { header: 'Trail', key: 'trail', width: 70 },
    ],
    rows: files.map((f) => ({
      name: f.name,
      category: f.category,
      source: SOURCE_LABEL[f.source],
      pillar: f.workstream ? `${f.workstream.pillar.num}. ${f.workstream.pillar.name}` : '',
      sub: f.workstream?.sub ? `${f.workstream.sub.num} ${f.workstream.sub.name}` : '',
      phase: f.workstream?.phase?.name ?? '',
      origin: originOf(f),
      by: userName(view, f.uploadedBy),
      date: date(f.date),
      kb: Math.round(f.size / 1000),
      trail: trailText(f),
    })),
    notes: ['Files are recorded by name, size, uploader and date; the demo does not store file contents.'],
  }
  return { filename: file(view, 'files'), sheets: [sheet] }
}
