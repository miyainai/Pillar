---
name: Charts and Excel exports
description: Conventions for charts (hand-drawn SVG bridge, hover/click behavior) and the "Export to Excel" feature; what the user asked for and the judgement calls made.
---

# Charts and Excel exports

**Rule:** every chart or table gets an "Export to Excel" button that downloads the
backing data as clean sheets *and* a native Excel chart linked to those cells. No
static PNG snapshots.

**Why:** the first version embedded a PNG of the on-screen chart; the user said "the
chart is stale" when people edit numbers in Excel and asked for a chart linked to the
data. ExcelJS cannot write charts, so the workbook is post-processed with JSZip and
hand-written DrawingML (stacked column for the bridge with an invisible spacer series,
line for KPIs). This proved stable: openpyxl and Excel both open it.

**How to apply:** build a `WorkbookSpec` with a `chart` of kind stackedColumn/line in
`src/lib/exports.ts` and drop in `ExportButton`. Chart ranges assume data starts at
row 5; include numCache/strCache or Excel shows an empty chart until recalculation.
Gotcha: the dash style element is `<a:prstDash>` (DrawingML namespace), not `c:`.

**Chart interaction rule:** hover = small clean tooltip; click = selection that fills a
detail panel *below* the chart (not a modal). Tooltips render through a portal to
`document.body` because cards use `overflow-x-auto` for mobile, which clips absolutely
positioned children vertically.

**Bridge decisions (user's sketch):** Entry → floating pillar steps → Target, with
modes Realized / To go / Both (default Both). Solid = realized, outlined = yet to
realize. Target EBITDA = entry + Σ pillar targets (not the IC exit figure); when they
differ and the viewer is firm-side, the IC case shows as a dashed line. Enabler pillars
with no EBITDA target are footnoted rather than drawn. The y-axis is truncated so pillar
steps fill the height. Management views never see exit EBITDA.

**Progress tab scope:** the user called the old table/area chart "AI-slop like" and asked
to remove the per-pillar bottom section and OP commentary. Commentary now lives only in
the board supplement (editable there). If the user later wants commentary gone entirely,
remove the textarea from BoardSupplement and the `commentary` store slice.

**Organic contribution scope:** Dashboard organic / steady-state means incremental
growth beyond entry EBITDA, excluding all pillar initiatives. Never infer it as
the residual to the IC case or hidden pillars; unconfigured companies mean zero.
Do not add it to historical Progress or board supplements without a separate request.

**Why:** The user explicitly confirmed organic growth is a separately specified
business contribution, not a relabeling of entry earnings or a reconciliation plug.
The user later requested illustrative nonzero organic performance for the demo
businesses. Use those demo assumptions only for untouched demo records; retain
explicit saved inputs (including zero), and leave custom companies at zero.

**How to apply:** Keep organic and pillar inputs independent. Apply the same
overachievement convention to both (realized can exceed target, remaining floors
at zero); protect organic targets on locked plans while permitting realized updates.
