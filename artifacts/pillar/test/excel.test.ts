import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { buildSeed } from '../src/lib/seed'
import { scopeFor } from '../src/lib/permissions'
import { buildBridge } from '../src/lib/bridge'
import { dashboardBridgeWorkbook, kpiWorkbook } from '../src/lib/exports'
import { buildWorkbook } from '../src/lib/excel'

const db = buildSeed()
const view = scopeFor(db, 'u-alex', 'c-fernhill')!

async function parts(buffer: ArrayBuffer) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)
  const out: Record<string, string> = {}
  for (const name of Object.keys(zip.files)) if (!zip.files[name].dir) out[name] = await zip.files[name].async('string')
  return out
}

describe('Excel export', () => {
  it('writes the EBITDA bridge as a live chart linked to the sheet cells', async () => {
    const bridge = buildBridge(view, 'both')
    const buffer = await buildWorkbook(dashboardBridgeWorkbook(view, bridge))
    mkdirSync('/tmp/pillar-xlsx', { recursive: true })
    writeFileSync('/tmp/pillar-xlsx/bridge.xlsx', Buffer.from(buffer))
    const p = await parts(buffer)
    expect(p['xl/charts/chart1.xml']).toContain('<c:barChart>')
    expect(p['xl/charts/chart1.xml']).toContain(`'EBITDA bridge'!$D$5:$D$${4 + bridge.steps.length}`)
    expect(p['xl/charts/chart1.xml']).not.toContain('<c:pictureOptions')
    expect(p['xl/drawings/drawing1.xml']).toContain('<c:chart r:id="rId1"/>')
    expect(p['xl/drawings/_rels/drawing1.xml.rels']).toContain('../charts/chart1.xml')
    expect(p['xl/worksheets/_rels/sheet1.xml.rels']).toContain('../drawings/drawing1.xml')
    expect(p['xl/worksheets/sheet1.xml']).toMatch(/<drawing r:id="rIdChart1"\/>(<legacyDrawing|<tableParts|<extLst|<\/worksheet>)/)
    expect(p['[Content_Types].xml']).toContain('/xl/charts/chart1.xml')
    expect(p['[Content_Types].xml']).toContain('/xl/drawings/drawing1.xml')
    // No stale picture of the chart.
    expect(Object.keys(p).some((k) => k.startsWith('xl/media/'))).toBe(false)
  })

  it('writes a KPI line chart over dates', async () => {
    const kpi = view.kpis.find((k) => k.actuals.length >= 2)!
    const buffer = await buildWorkbook(kpiWorkbook(view, kpi))
    writeFileSync('/tmp/pillar-xlsx/kpi.xlsx', Buffer.from(buffer))
    const p = await parts(buffer)
    expect(p['xl/charts/chart1.xml']).toContain('<c:lineChart>')
    expect(p['xl/charts/chart1.xml']).toContain('<a:prstDash val="dash"/>')
    expect(p['xl/charts/chart1.xml']).toContain('formatCode="mmm d, yyyy"')
    expect(p['xl/worksheets/sheet1.xml']).toContain('<drawing r:id="rIdChart1"/>')
    expect(p['xl/worksheets/sheet2.xml']).not.toContain('<drawing')
  })
})
