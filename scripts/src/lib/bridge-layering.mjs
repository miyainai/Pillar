// Shared assertions that the EBITDA bridge keeps its dashed connectors visible over the
// selected/hovered column highlight. Used by test-pillar.mjs (regular run) and the
// standalone test-bridge-connector.mjs.
import assert from 'node:assert/strict'

// Prefix match: the label ends in "by pillar" or "by organic growth and pillar" depending on the bridge.
const SVG = 'svg[aria-label^="EBITDA bridge from entry to target"]'
const GROUPS = `${SVG} > g[tabindex]`

// For every step group in the bridge, the SVG must paint the highlight before the group that
// owns the connector into it, i.e. the highlight rect is not a later sibling that can cover it.
const layering = (page) =>
  page.evaluate((SVG) => {
    const svg = document.querySelector(SVG)
    const children = Array.from(svg.children)
    const highlights = children.filter((c) => c.tagName === 'rect' && c.getAttribute('rx') === '6')
    const groups = children.filter((c) => c.tagName === 'g' && c.hasAttribute('tabindex'))
    const firstGroup = children.indexOf(groups[0])
    return {
      highlights: highlights.length,
      highlightsBeforeGroups: highlights.every((h) => children.indexOf(h) < firstGroup),
      highlightInsideGroup: groups.some((g) => g.querySelector(':scope > rect[rx="6"]')),
    }
  }, SVG)

// Hit-test along the right 60% of the dashed connector leaving step `i` (the part inside the next
// column). Returns a tag per sample point: 'line.dash' for the connector, '*.hl' for a highlight rect.
const connectorHits = (page, i) =>
  page.evaluate(({ SVG, i }) => {
    const svg = document.querySelector(SVG)
    const groups = Array.from(svg.children).filter((c) => c.tagName === 'g' && c.hasAttribute('tabindex'))
    const line = groups[i]?.querySelector(':scope > line[stroke-dasharray]')
    if (!line) return null
    const x1 = +line.getAttribute('x1'), x2 = +line.getAttribute('x2'), y = +line.getAttribute('y1')
    const r = svg.getBoundingClientRect()
    const hits = []
    for (let t = 0.45; t <= 0.98; t += 0.02) {
      const el = document.elementFromPoint(r.left + x1 + (x2 - x1) * t, r.top + y)
      hits.push(el ? el.tagName + (el.getAttribute('stroke-dasharray') ? '.dash' : el.getAttribute('rx') === '6' ? '.hl' : '') : 'none')
    }
    return hits
  }, { SVG, i })

const assertHighlightLayering = async (page, label) => {
  const l = await layering(page)
  assert.equal(l.highlightInsideGroup, false, `${label}: highlight must not live inside a step group`)
  assert.ok(l.highlights >= 1 && l.highlightsBeforeGroups, `${label}: highlight paints before step groups`)
}

const assertConnectorsClear = async (page, i, label) => {
  const incoming = await connectorHits(page, i - 1)
  assert.ok(incoming && !incoming.some((t) => t.endsWith('.hl')), `${label}: incoming connector not covered by highlight (${incoming})`)
  assert.ok(incoming.some((t) => t === 'line.dash'), `${label}: incoming connector hit-testable (${incoming})`)
  const outgoing = await connectorHits(page, i)
  assert.ok(outgoing && !outgoing.some((t) => t.endsWith('.hl')), `${label}: outgoing connector not covered by highlight (${outgoing})`)
}

export const waitForBridge = async (page) => {
  await page.locator(SVG).waitFor()
  await page.waitForFunction((GROUPS) => document.querySelectorAll(GROUPS).length >= 3, GROUPS)
  return page.locator(GROUPS).count()
}

/**
 * Click every selectable pillar step and assert the connectors into and out of it stay on top
 * of the highlight. Only for bridges whose onSelect keeps the page in place (Progress).
 * Returns the number of steps checked.
 */
export const checkSelectedBridgeConnectors = async (page, { screenshot } = {}) => {
  const groupCount = await waitForBridge(page)
  let checked = 0
  let last = -1
  for (let i = 1; i < groupCount - 1; i++) {
    const g = page.locator(GROUPS).nth(i)
    if ((await g.getAttribute('role')) !== 'button') continue
    await g.click()
    await page.waitForFunction(({ GROUPS, i }) => document.querySelectorAll(GROUPS)[i].getAttribute('aria-pressed') === 'true', { GROUPS, i })
    await assertHighlightLayering(page, `selected step ${i}`)
    await assertConnectorsClear(page, i, `selected step ${i}`)
    if (screenshot) await screenshot(`selected-${i}`)
    checked++
    last = i
  }
  assert.ok(checked >= 1, 'at least one selectable pillar step in the bridge')
  // Clicking the selected step again toggles the selection off, leaving the chart clean for later checks.
  await page.locator(GROUPS).nth(last).click()
  await page.waitForFunction(({ GROUPS, i }) => document.querySelectorAll(GROUPS)[i].getAttribute('aria-pressed') === 'false', { GROUPS, i: last })
  return checked
}

/**
 * Hover every interior step (no click, so safe on the Dashboard where selecting navigates away)
 * and assert the hover highlight never covers the connectors. Returns the number of steps checked.
 */
export const checkHoveredBridgeConnectors = async (page, { screenshot } = {}) => {
  const groupCount = await waitForBridge(page)
  // Park the mouse off the chart so no stale hover highlight is left from an earlier step.
  await page.mouse.move(0, 0)
  await page.waitForFunction((SVG) => document.querySelectorAll(`${SVG} > rect[rx="6"]`).length === 0, SVG)
  let checked = 0
  for (let i = 1; i < groupCount - 1; i++) {
    await page.locator(GROUPS).nth(i).hover()
    await page.waitForFunction((SVG) => document.querySelectorAll(`${SVG} > rect[rx="6"]`).length >= 1, SVG)
    await assertHighlightLayering(page, `hovered step ${i}`)
    await assertConnectorsClear(page, i, `hovered step ${i}`)
    if (screenshot) await screenshot(`hover-${i}`)
    checked++
  }
  await page.mouse.move(0, 0)
  return checked
}
