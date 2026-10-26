---
name: Browser test harness
description: How UI changes in Pillar are verified (direct Playwright scripts), and the locator/timing gotchas that cost retries.
---

# Browser test harness

**Rule:** verify UI work with the Playwright scripts under `scripts/src`
(`test:pillar`, `test:improvements*`, `test:bridge-connector`), run while the
`artifacts/pillar: web` workflow is up. Do not try the testing subagent here.

**Why:** the testing-agent callback failed with `Unknown config kind: testing` in
this workspace; direct scripts were reliable and double as regression checks.

**How to apply / gotchas:**
- Scripts must live inside `scripts/` so `playwright` and `exceljs` resolve (not /tmp).
- The web workflow can be down in a fresh task environment (502 on localhost:80); restart it before running scripts.
- After a click that re-renders, use `locator.waitFor()` rather than `isVisible()`;
  `isVisible()` does not wait and produced a false failure.
- Short labels like "Target" appear both in SVG text and in panels; scope to the chart
  via `getByRole('img', { name: /EBITDA bridge/ })` or use strict-safe locators.
- SVG layering checks: `document.elementFromPoint` along a stroked line is a cheap way to
  prove nothing paints over it (a covering rect shows up as the top-most element). Shared
  bridge checks live in `scripts/src/lib/` and run inside `test:pillar`; reuse them rather
  than adding another standalone script.
- Bridge selection on Progress is toggled by re-clicking the step; Escape does not clear it.
  Dashboard bridge selection navigates away, so only hover can be checked there.
- Management users hitting firm-only routes get an in-place "no access" view, not a
  redirect; assert on content, not URL.
- Downloads: use a context with `acceptDownloads: true`, then re-open the .xlsx with
  ExcelJS to assert sheets/images instead of trusting the file size alone.
- HTML5 drag-and-drop works with `locator.dragTo(target)` in this Chromium; the drop
  handler must also fall back to React state because `dataTransfer.getData` can be
  empty on synthetic drags.
- Buttons placed inside a `<label>` (the `Field` component) inherit the label text
  as their accessible name and break `getByRole('button', { name })`; use a div with
  its own caption for button groups and file pickers.
- When writing TSX through the CodeExecution sandbox, template literals swallow the
  `$` before `${}`; grep written files for missing dollar signs in money strings.
- `selectOption({ label })` needs a string, not a regex; select by option value
  instead when labels carry indentation or numbering.
- A hover popover rendered inside a `max-w-0` table cell shrinks to the cell's
  width; give it `w-max` plus a `max-w` so it sizes to its content.
