// Excel export: every chart or table can be downloaded with the data behind it.
// Charts are written as real Excel charts that point at the cells next to them, so editing a
// number in the sheet updates the chart. ExcelJS cannot write charts, so after it builds the
// workbook the chart parts are added to the .xlsx package by hand (see addNativeCharts).
// ExcelJS and JSZip are loaded on demand so the app bundle stays small.

export interface SheetColumn {
  header: string
  key: string
  width?: number
  /** Excel number format, e.g. '0.0' or '0%'. */
  numFmt?: string
}

export interface ChartSeries {
  /** Column key holding the values. */
  key: string
  /** Legend name; defaults to the column header. */
  name?: string
  /** Fill colour (hex, no #) or 'none' for an invisible spacer series. */
  fill?: string | 'none'
  /** Outline colour (hex, no #). */
  outline?: string
  /** Per-point fills, for bars that each have their own colour. */
  pointFills?: (string | undefined)[]
  /** Per-point outlines. */
  pointOutlines?: (string | undefined)[]
  /** Hide from the legend (spacer series). */
  hideLegend?: boolean
  /** Line charts: dashed line, e.g. for a target. */
  dashed?: boolean
  /** Line charts: show markers. */
  markers?: boolean
}

export interface NativeChart {
  kind: 'stackedColumn' | 'line'
  title: string
  /** Column key for the category axis. */
  categories: string
  /** Category cells are dates; show them as such. */
  categoryDates?: boolean
  series: ChartSeries[]
  valueFormat?: string
  valueTitle?: string
  /** Size in cells (columns × rows). */
  size?: { cols: number; rows: number }
}

export interface SheetSpec {
  name: string
  title: string
  subtitle?: string
  columns: SheetColumn[]
  rows: Record<string, unknown>[]
  /** Lines printed under the table. */
  notes?: string[]
  /** A live Excel chart, placed to the right of the data that backs it. */
  chart?: NativeChart
}

export interface WorkbookSpec {
  filename: string
  sheets: SheetSpec[]
}

const HEADER_ROW = 4

export async function downloadWorkbook(spec: WorkbookSpec) {
  const buffer = await buildWorkbook(spec)
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = spec.filename.replace(/[\\/:*?"<>|]+/g, '-')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Builds the .xlsx bytes: ExcelJS for cells and styling, then the chart parts are added. */
export async function buildWorkbook(spec: WorkbookSpec): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Pillar'
  wb.created = new Date()

  const charts: PlacedChart[] = []
  spec.sheets.forEach((sheet, sheetIndex) => {
    const ws = wb.addWorksheet(sheetName(sheet.name), { views: [{ state: 'frozen', ySplit: HEADER_ROW }] })
    ws.getCell(1, 1).value = sheet.title
    ws.getCell(1, 1).font = { bold: true, size: 13 }
    if (sheet.subtitle) {
      ws.getCell(2, 1).value = sheet.subtitle
      ws.getCell(2, 1).font = { color: { argb: 'FF71717A' }, size: 10 }
    }

    sheet.columns.forEach((c, i) => {
      const cell = ws.getCell(HEADER_ROW, i + 1)
      cell.value = c.header
      cell.font = { bold: true, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD4D4D8' } } }
      cell.alignment = { vertical: 'middle', wrapText: true }
      const longest = Math.max(c.header.length, ...sheet.rows.map((r) => String(r[c.key] ?? '').length))
      ws.getColumn(i + 1).width = c.width ?? Math.min(60, Math.max(10, longest + 2))
    })

    sheet.rows.forEach((row, ri) => {
      sheet.columns.forEach((c, ci) => {
        const cell = ws.getCell(HEADER_ROW + 1 + ri, ci + 1)
        const v = row[c.key]
        cell.value = v === undefined || v === null || v === '' ? null : (v as string | number | Date)
        if (c.numFmt && typeof v === 'number') cell.numFmt = c.numFmt
        if (v instanceof Date) cell.numFmt = 'mmm d, yyyy'
        cell.font = { size: 10 }
      })
    })

    let next = HEADER_ROW + sheet.rows.length + 2
    for (const note of sheet.notes ?? []) {
      ws.getCell(next, 1).value = note
      ws.getCell(next, 1).font = { italic: true, size: 9, color: { argb: 'FF71717A' } }
      next += 1
    }

    if (sheet.chart && sheet.rows.length) {
      const col = sheet.columns.length + 1
      ws.getCell(HEADER_ROW - 1, col + 1).value = `${sheet.chart.title} · linked to the table, edit a number and it updates`
      ws.getCell(HEADER_ROW - 1, col + 1).font = { italic: true, size: 9, color: { argb: 'FF71717A' } }
      charts.push({ sheetIndex, sheetName: sheetName(sheet.name), spec: sheet, anchorCol: col, anchorRow: HEADER_ROW - 1 })
    }
  })

  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  return charts.length ? addNativeCharts(buffer, charts) : buffer
}

/** Excel sheet names: max 31 chars, no []:*?/\ */
function sheetName(name: string) {
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
}

// ---------------------------------------------------------------- Native charts

interface PlacedChart {
  sheetIndex: number
  sheetName: string
  spec: SheetSpec
  anchorCol: number
  anchorRow: number
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const colLetter = (n: number) => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const excelDate = (d: Date) => (d.getTime() - d.getTimezoneOffset() * 60_000 - EXCEL_EPOCH) / 86_400_000

/**
 * Adds one chart per PlacedChart to a finished .xlsx: chart XML, a drawing that anchors it,
 * the relationships that join them, and the content types that declare them.
 */
export async function addNativeCharts(xlsx: ArrayBuffer, charts: PlacedChart[]): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(xlsx)
  let contentTypes = (await zip.file('[Content_Types].xml')!.async('string')) as string
  const typeOverrides: string[] = []

  for (let i = 0; i < charts.length; i++) {
    const c = charts[i]
    const n = i + 1
    const sheetPath = `xl/worksheets/sheet${c.sheetIndex + 1}.xml`
    const sheetXml = await zip.file(sheetPath)?.async('string')
    if (!sheetXml) continue

    zip.file(`xl/charts/chart${n}.xml`, chartXml(c))
    zip.file(`xl/drawings/drawing${n}.xml`, drawingXml(c, n))
    zip.file(
      `xl/drawings/_rels/drawing${n}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/></Relationships>`,
    )
    typeOverrides.push(
      `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
      `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    )

    // Sheet relationships: add (or create) the link to the drawing.
    const relsPath = `xl/worksheets/_rels/sheet${c.sheetIndex + 1}.xml.rels`
    const existing = await zip.file(relsPath)?.async('string')
    const relId = `rIdChart${n}`
    const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/>`
    zip.file(
      relsPath,
      existing
        ? existing.replace('</Relationships>', `${rel}</Relationships>`)
        : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`,
    )

    // The <drawing> element has a fixed place in the sheet: after page setup, before legacy drawings and tables.
    const drawingEl = `<drawing r:id="${relId}"/>`
    let out = sheetXml
    if (!out.includes('xmlns:r=')) out = out.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ')
    const after = ['<legacyDrawing', '<legacyDrawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst', '</worksheet>']
    const at = Math.min(...after.map((t) => out.indexOf(t)).filter((x) => x >= 0))
    out = out.slice(0, at) + drawingEl + out.slice(at)
    zip.file(sheetPath, out)
  }

  contentTypes = contentTypes.replace('</Types>', `${typeOverrides.join('')}</Types>`)
  zip.file('[Content_Types].xml', contentTypes)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}

function drawingXml(c: PlacedChart, n: number) {
  const size = c.spec.chart?.size ?? { cols: 9, rows: 18 }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>${c.anchorCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.anchorRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${c.anchorCol + size.cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.anchorRow + size.rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr><xdr:cNvPr id="${1000 + n}" name="Chart ${n}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId1"/></a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>
</xdr:wsDr>`
}

function chartXml(c: PlacedChart) {
  const chart = c.spec.chart!
  const cols = c.spec.columns
  const rows = c.spec.rows
  const first = HEADER_ROW + 1
  const last = HEADER_ROW + rows.length
  const colOf = (key: string) => colLetter(cols.findIndex((x) => x.key === key) + 1)
  const ref = (key: string) => `'${c.sheetName.replace(/'/g, "''")}'!$${colOf(key)}$${first}:$${colOf(key)}$${last}`
  const headerRef = (key: string) => `'${c.sheetName.replace(/'/g, "''")}'!$${colOf(key)}$${HEADER_ROW}`
  const valueFormat = chart.valueFormat ?? cols.find((x) => x.key === chart.series[0]?.key)?.numFmt ?? 'General'

  // Caches let viewers that do not recalculate (previews, phones) still draw the chart.
  const numCache = (key: string, fmt: string) =>
    `<c:numCache><c:formatCode>${esc(fmt)}</c:formatCode><c:ptCount val="${rows.length}"/>${rows
      .map((r, i) => {
        const v = r[key]
        const num = v instanceof Date ? excelDate(v) : typeof v === 'number' ? v : null
        return num === null ? '' : `<c:pt idx="${i}"><c:v>${num}</c:v></c:pt>`
      })
      .join('')}</c:numCache>`
  const strCache = (key: string) =>
    `<c:strCache><c:ptCount val="${rows.length}"/>${rows.map((r, i) => `<c:pt idx="${i}"><c:v>${esc(String(r[key] ?? ''))}</c:v></c:pt>`).join('')}</c:strCache>`

  const cat = chart.categoryDates
    ? `<c:cat><c:numRef><c:f>${esc(ref(chart.categories))}</c:f>${numCache(chart.categories, 'mmm d, yyyy')}</c:numRef></c:cat>`
    : `<c:cat><c:strRef><c:f>${esc(ref(chart.categories))}</c:f>${strCache(chart.categories)}</c:strRef></c:cat>`

  const fill = (color?: string | 'none') => (color === 'none' ? '<a:noFill/>' : color ? `<a:solidFill><a:srgbClr val="${color.replace('#', '')}"/></a:solidFill>` : '')
  const line = (color?: string, dashed?: boolean, w = 19050) =>
    color ? `<a:ln w="${w}">${fill(color)}${dashed ? '<a:prstDash val="dash"/>' : ''}</a:ln>` : color === undefined ? '' : '<a:ln><a:noFill/></a:ln>'

  const series = chart.series
    .map((s, i) => {
      const name = s.name ? `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>` : `<c:tx><c:strRef><c:f>${esc(headerRef(s.key))}</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(cols.find((x) => x.key === s.key)?.header ?? s.key)}</c:v></c:pt></c:strCache></c:strRef></c:tx>`
      const val = `<c:val><c:numRef><c:f>${esc(ref(s.key))}</c:f>${numCache(s.key, valueFormat)}</c:numRef></c:val>`
      if (chart.kind === 'line') {
        const color = s.fill && s.fill !== 'none' ? s.fill : '27272A'
        const spPr = `<c:spPr>${line(color, s.dashed, 22225)}</c:spPr>`
        const marker = s.markers ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill(color)}${line(color)}</c:spPr></c:marker>` : '<c:marker><c:symbol val="none"/></c:marker>'
        return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${name}${spPr}${marker}${cat}${val}<c:smooth val="0"/></c:ser>`
      }
      const spPr = `<c:spPr>${fill(s.fill)}${s.fill === 'none' ? '<a:ln><a:noFill/></a:ln>' : line(s.outline, false, 12700)}</c:spPr>`
      const points = rows
        .map((_, pi) => {
          const pf = s.pointFills?.[pi]
          const po = s.pointOutlines?.[pi]
          if (!pf && !po) return ''
          return `<c:dPt><c:idx val="${pi}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(pf ?? s.fill)}${line(po ?? s.outline, false, 12700)}</c:spPr></c:dPt>`
        })
        .join('')
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${name}${spPr}<c:invertIfNegative val="0"/>${points}${cat}${val}</c:ser>`
    })
    .join('')

  const hidden = chart.series
    .map((s, i) => (s.hideLegend ? `<c:legendEntry><c:idx val="${i}"/><c:delete val="1"/></c:legendEntry>` : ''))
    .join('')

  const plot =
    chart.kind === 'line'
      ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="10"/><c:axId val="20"/></c:lineChart>`
      : `<c:barChart><c:barDir val="col"/><c:grouping val="stacked"/><c:varyColors val="0"/>${series}<c:gapWidth val="40"/><c:overlap val="100"/><c:axId val="10"/><c:axId val="20"/></c:barChart>`

  const catAxFmt = chart.categoryDates ? '<c:numFmt formatCode="mmm d, yyyy" sourceLinked="0"/>' : '<c:numFmt formatCode="General" sourceLinked="1"/>'
  const valTitle = chart.valueTitle
    ? `<c:title><c:tx><c:rich><a:bodyPr rot="-5400000" vert="horz"/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="0"/></a:pPr><a:r><a:rPr lang="en-US" sz="900" b="0"/><a:t>${esc(chart.valueTitle)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    : ''
  const txPr = (sz: number) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}"><a:solidFill><a:srgbClr val="52525B"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:roundedCorners val="0"/>
<c:chart>
<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"><a:solidFill><a:srgbClr val="18181B"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1"/><a:t>${esc(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
<c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/>${plot}
<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${catAxFmt}<c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D4D4D8"/></a:solidFill></a:ln></c:spPr>${txPr(900)}<c:crossAx val="20"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="F4F4F5"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>${valTitle}<c:numFmt formatCode="${esc(valueFormat)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr(900)}<c:crossAx val="10"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>
</c:plotArea>
<c:legend><c:legendPos val="b"/>${hidden}<c:overlay val="0"/>${txPr(900)}</c:legend>
<c:plotVisOnly val="1"/>
<c:dispBlanksAs val="gap"/>
</c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
</c:chartSpace>`
}
