# Pillar

A private-equity value creation planning demo for deal teams, operating partners,
and portfolio-company management. All sample data is fictional.

## Run & Operate

- Frontend workflow: `artifacts/pillar: web`
- Backend workflow: `artifacts/api-server: API Server`
- Open the root preview `/`. The shared proxy routes `/api` to Express.
- Unit tests: `pnpm --filter @workspace/pillar run test`
- Browser checks: `pnpm --filter @workspace/scripts run test:pillar`
- Improvements checks: `pnpm --filter @workspace/scripts run test:improvements`,
  `test:improvements-v2` (bridge, exports) and `test:improvements-v3` (plan to
  date, captured edits, kanban drag-and-drop, waiting-on-you), `test:files`
  (Files tab: folders, trails, add/move, export, management boundary)
- Backend typecheck: `pnpm --filter @workspace/api-server run typecheck`
- Regenerate API contracts: `pnpm --filter @workspace/api-spec run codegen`

Do not start dev servers at the workspace root. Managed workflows provide
`PORT` and `BASE_PATH` automatically.

## Product and persistence

The original portfolio, dashboard, plan editor, pillar detail, asks, progress,
board supplement, settings, and company setup routes are preserved.

This is the imported demo, not an authenticated multi-user production system.
The **View as** menu changes demo personas; role visibility and mutation checks
are client-side. A `?as=<user id or first name>` query parameter opens any page as
that persona (same redirect rules as the menu) and is then removed from the URL;
**Copy demo link** in the View-as menu produces one. Without `ANTHROPIC_API_KEY`
the AI endpoints answer `not_configured`, which the UI treats as the expected
template/pre-built-draft path (neutral copy), unlike real errors or timeouts
(amber warning). Changes persist in the browser's localStorage, not a server
database, and **Reset demo** restores sample data. Uploaded files keep their
bytes in the browser's IndexedDB (`src/lib/files.ts`, keyed by attachment id) so
anyone who can see the ask or update can download them; seeded attachments have
no bytes and download as clearly labelled sample files (a toast says so).
Bumping `SEED_VERSION` must not wipe saved data: `src/lib/migrate.ts` upgrades a
saved database in place (new fields are optional and filled in); only add a
non-optional field with a matching upgrade step.
Uploaded deal documents are read in the browser.
Do not add a database, authentication, or new storage as part of migration work.

## Progress tab and exports

The Progress tab is an EBITDA bridge (`src/lib/bridge.ts` for the math,
`src/components/EbitdaBridge.tsx` for the hand-drawn SVG): entry EBITDA, one
floating step per pillar (solid = realized, outlined = yet to realize), target
EBITDA = entry + pillar targets. Hover shows a summary; clicking a pillar fills
the detail panel below. The comparison period is chosen independently of the
period (URL params `c`, `cfrom`, `cto`). Operating-partner commentary is written
in the board supplement, the only place it appears.

Every chart and table has "Export to Excel" (`src/lib/excel.ts`, builders in
`src/lib/exports.ts`): clean data sheets plus a **native Excel chart** that
references the cells, so editing a number in Excel updates the chart. ExcelJS
cannot write charts, so `excel.ts` builds the workbook with ExcelJS and then
post-processes the zip with JSZip, adding hand-written DrawingML parts
(`xl/charts`, `xl/drawings`, rels, content types). Two chart kinds exist:
stacked column (the bridge, with an invisible spacer series) and line (KPIs).
Data rows start at row 5 (`HEADER_ROW = 4`); keep that if you change sheet
layout, the chart ranges depend on it. Both libraries load on demand.

## Plan to date, captured $ and the asks board

"Plan to date" (`planToDate`/`onPlan` in `src/lib/permissions.ts`) is a
straight-line ramp of a sub-pillar's target from its `startDate` to its
`targetDate`; a pillar with sub-pillars sums them. Captured renders green when
it is within 5% of plan to date and pink when behind. Every figure that shows
captured next to target shows plan to date too. Captured EBITDA is only edited
through the "Update captured EBITDA" modal (`src/components/UpdateCaptured.tsx`),
which posts a normal update so the feed, activity and Progress stay in sync;
pillars with sub-pillars are not directly editable.

The Asks tab is a four-column kanban (`src/lib/askBoard.ts` holds the column
mapping, who may drag, and what each drop means). Drops open a small form
(`src/components/AskMoves.tsx`) that ends in an existing store transition, so
nothing on the board bypasses the ask lifecycle. Rules: backward moves (and
reopening) require a reason and record it on the timeline; nothing goes straight
back to With management (pull it to the deal team, then send again); questions
never go to management; asks with management come back on upload, not by
dragging; resolving needs a reason; non-deal-team users may only resolve or send
back their own delivered asks; management never drags. Resolved asks live in a
collapsed section at the bottom.

Asks are **home in the Asks tab**. Pillar pages show their linked asks read-only
and link out with `/asks?pillar=<id>` (filtered board) and `/asks?new=1&pillar=<id>`
(new-ask form with the pillar preselected); there is no ask form on the plan.
Pillar pages count as the Plan tab in the top bar.

An ask has one or more deal-team owners (`assigneeIds`; new asks go to the
associate). VP and above change owners with `PeoplePicker`
(`src/components/PeoplePicker.tsx`): drag a person's chip into the "On it" box
or click them; drag back out or click the x to remove; hover shows full name and
title. The same picker with `max={1}` picks the management recipient. An ask can
never have zero owners. Wrap pickers in `<Field group>` (a `div`), never a
plain `<Field>`, because a `<label>` forwards clicks to its first button.

"In your court" (`src/components/Court.tsx`, items from `src/lib/todos.ts`) sits
on the dashboard: chips per person switch whose list is shown, plus Everyone.

The Files tab (`src/pages/Files.tsx`, selector in `src/lib/fileLibrary.ts`) is a
data-room-style index of every file the deal has touched: deal materials
(`documents`), update attachments and data-request files. It is built only from
the projected View, so management never sees deal materials, final files or
hidden workstreams. Every upload path in the app lands there automatically.
"Add files" creates `documents` with an optional workstream tag; "Move to folder"
changes a document's type/workstream or stores an override for an attachment in
`db.fileTags` (keyed by attachment id, filtered to visible plan items in
`scopeFor`). Files stay metadata-only.

Profile photos are AI-generated placeholders in `public/avatars/` (no real
people); `Avatar` falls back to initials when a user has no photo.

## AI

The three original AI endpoints (`generate`, `regenerate`, and `suggest`) run
server-side in Express. Without `ANTHROPIC_API_KEY`, they return
`503 {"error":"not_configured"}` and the UI uses its existing, clearly labeled
pre-generated demo fallback. Live AI was not configured or verified during the
port. Never put server credentials into browser code.

## Repo map

- `artifacts/pillar/`: original React/Vite frontend, demo documents, unit tests.
- `artifacts/api-server/src/lib/pillar/`: preserved server-side AI handlers.
- `artifacts/api-server/src/routes/pillar.ts`: Express adapter.
- `lib/api-spec/openapi.yaml`: endpoint contracts.
- `scripts/src/test-pillar.mjs`: repeatable Playwright browser smoke test.
- `.migration-backup/`: imported source and original product docs. Dependency
  records receive security fixes, but the archived source is not a runnable workspace.
- `generated-artifacts/pillar/`, `generated-artifacts/improvements*/`: ignored browser-test screenshots and downloads.

## Testing notes

The browser check uses system Chromium on Replit, or
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when provided. Both app workflows must run
before the check. It uses a fresh browser context and resets its own demo state.
Unit tests have a separate Vitest config so they don't need service port variables.

Strict frontend typechecking reports inherited imported-code and unused scaffold
component errors; zero strict errors was outside the migration scope.
