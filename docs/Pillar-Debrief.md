# Pillar — Product and Build Debrief

*Prepared October 25, 2026 to brief another AI tool (or a new teammate) on everything built so far. Everything below reflects the app as it runs today.*

---

## 1. What Pillar is, in one paragraph

Pillar is a web app for private-equity firms that turns the investment case (IC memo, model, diligence reports) into a live **value creation plan (VCP)** and then runs all post-close work against that plan. The plan breaks the underwritten EBITDA uplift into **pillars** (e.g. Procurement savings, Pricing and mix, Add-on M&A), each split into **sub-pillars** with owners, dollar targets, phases and KPIs. Operating partners post updates against their pillars, the deal team and management trade **asks** (data requests and questions), and everyone sees a role-appropriate view of what is moving, what is behind, and whose court it is in. Built for a one-day hackathon (team: Miya, Mihir, Aaron, all ex-PE); the audience for the demo is hackathon judges with little PE background.

Product name is **Pillar**; lowercase "pillar" always means a unit of the plan.

---

## 2. The problem

Tracking progress across portfolio companies gets messy fast. Updates live in emails, spreadsheets and slide decks; there is no single source of truth. Three groups need the same information at different levels:

- **Deal team** (MD, Principal, VP, Associate) — wants plan health, who is working on what, and what needs their call, without waiting for a board meeting.
- **Operating partners (OPs)** — own specific pillars, post short updates, need data from the company.
- **Portfolio-company management** (CEO, CFO, functional leads) — answer data requests and see only what the firm has chosen to share.

Generic project-management tools fail here because they don't connect the work to the dollars and they can't enforce the firm/management boundary. Pillar's spine: **every update and every ask links to a pillar**, so the plan, the work and the EBITDA stay connected, and **one permission function** decides what management can see.

---

## 3. Users and roles

| Role | Who | Sees |
|---|---|---|
| MD / Principal | Deal team leads | Everything; handles anything flagged up |
| VP | Runs the deal day to day | Everything; edits the plan, triages asks, changes ask owners |
| Associate | Deal team | Everything; default owner of new asks, cleans data from management |
| OP (operating partner) | Several per firm, each on specific pillars | Everything; posts updates, creates asks |
| Management | CEO, CFO, functional leads | **Shared items only** |

Each company is its own workspace ("deal folder"); a person sees only companies where they hold a membership. The demo replaces login with a **View as** menu (and `?as=<first name>` deep links produced by **Copy demo link**).

**Demo personas (Fernhill Foods):** Alex Chen (MD), Priya Raman (VP), Sam Ortiz (Associate), Jordan Lee / Casey Nguyen / Morgan Blake (OPs), Taylor Brooks (CFO) and Chris Patel (CEO) as management. Other companies: Kestrel Dental Partners, Northgate Industrial Supply.

---

## 4. Core model

Thirteen objects, three plan levels (pillar → sub-pillar → phase):

- **Company** — close date, hold years, entry EBITDA, underwritten exit EBITDA, logo, optional organic growth target/realized.
- **Membership** — user × company × role.
- **Document** — deal materials (IC deck, model, CIM, QoE, diligence) read in the browser.
- **VCP version** — change note, sign-offs, locked-at.
- **Pillar / SubPillar** — objective, rationale with source, target and captured run-rate EBITDA ($M), owners, status (Not started / On track / At risk / Off track / Complete), visibility (Firm only / Shared), start and target dates.
- **Phase** — dated steps under a sub-pillar (or pillar), status Not started / In progress / Complete.
- **KPI** — baseline, target, dated actuals.
- **Update** — text, optional status change, optional captured-$ change, attachments, Internal/Shared.
- **Ask** — one object, two types. *Data request*: New → In progress → Sent to management → Data received → Delivered → Closed, with a separate management-facing version and attachments by stage (raw from management, final from deal team). *Question*: Open → Answered → Closed, stays inside the firm. Shared fields: linked pillar/sub-pillar, created by, **owners (one or more deal-team members)**, urgency (Critical 24h / High 3d / Standard 1w / Low 2w; due date fills from urgency), flagged-to-MD.
- **Comment** — on pillar, sub-pillar, update or ask; Internal/Shared.
- **ActivityLog** — actor, action, object, old/new value; powers feeds, the Progress view and the audit trail.
- **File tags** — folder overrides for the Files tab.

### Visibility rules (the non-negotiables)
- Two levels: **Firm only** and **Shared with management**. New pillars default to Firm only; sharing is a deliberate click.
- Everything under a Firm-only item inherits Firm only (sub-pillars, phases, updates, KPIs, asks, comments).
- **No traces**: management views show no placeholders, counts, numbering gaps or totals that include hidden items. Management never sees exit EBITDA, rationale/sources, deal documents, Progress or Settings, or the OP's original request text — only the management version the associate approves.
- A routed data request stays visible to management even if its pillar is hidden (the link to the pillar is removed).
- One `projectView()` permission function builds a role-filtered **View**; every page renders from the View, never from the raw database. A unit test asserts the CFO's view contains none of a list of leak words (headcount, succession, IC memo, ...).

---

## 5. Screens and features (as they exist today)

### Top bar
Company switcher (stays on the current tab when switching), tabs, View as menu (personas, Copy demo link, Reset demo). The bar is pinned while scrolling. Pillar detail pages light up the **Plan** tab.

### Portfolio (home)
Card per assigned company: captured vs target run-rate EBITDA, health, open asks, overdue count. "Set up a new company" entry.

### Setup wizard
Company basics → people and roles → upload IC memo / model / CIM / QoE / diligence (parsed in the browser with pdf.js and SheetJS) → plan settings (pillar count 3–8, detail level, focus levers) → AI generates a draft plan. Plan stays **Draft** until alignment sign-off locks VCP v1. Without an AI key, a clearly labelled pre-generated plan loads instead.

### Dashboard (role-specific)
- **Firm users:** KPI stats (entry EBITDA, plan target impact, captured to date with "on plan" / "$X behind plan to date", exit EBITDA), company logo, an **EBITDA bridge** (entry → pillar steps → target; the target bar shows total realized "today" in the black portion), **In your court** card (to-dos grouped by urgency, with chips to switch to any teammate's court or Everyone), **Pillar health** grid (captured vs target vs plan to date, stale flags, owners' photos), and for the MD **Who is working on what**.
- **Management:** shared target, pillar health for shared items, "In your court" = data requests waiting on them with an inline Upload button.

### Plan (VCP editor)
Collapsed-by-default pillar cards with Expand all / Consolidate all. Each pillar: objective, rationale and source, target / captured / **plan to date** figures (green when within 5% of plan to date, pink when behind), owners with photos, phase timeline with hover showing % complete, visibility toggle (sub-pillars under a Firm-only pillar read "Firm only because the whole pillar is"), KPIs. Captured $ is edited only through **Update captured EBITDA**, which posts a normal update so the feed, activity and Progress all stay consistent. AI "rewrite with an instruction" per pillar. After lock, structural changes require **Revise plan** (new version, change note, new sign-offs).

**Pillar detail** page: objective, owners, status, sub-pillars with phases, updates feed, KPI chart (Export to Excel), **Asks linked here** (read-only, with "Open in Asks" → filtered board and "New ask" → form with the pillar preselected).

### Asks (management sees "Data requests")
Four-column kanban: **New → With deal team → With management → Delivered**, plus a collapsed **Resolved** section at the bottom. Filters by type, urgency, pillar, person. Each card shows the title, pillar, urgency, status pill, **whose court it is in** (owners' photos and "Next to pick it up / Working on it / Uploading the file / Checking the result"), "Asked by", due date (red when overdue).

Drag-and-drop between columns; every drop opens a small form that ends in a real store transition, so nothing bypasses the lifecycle:
- → With deal team: pick who's on it (drag-and-drop people picker), optional note.
- → With management: recipient, management-facing title and description (with an AI "Draft it for me" that falls back to a template), context files.
- → Delivered: upload the final file (data request) or answer (question).
- → Resolved: reason required.
- **Backward moves** (and reopen): reason required, optional next steps; recorded on the timeline. Straight back to With management is blocked (go via the deal team). Management never drags; non-deal-team users can only resolve or send back their own delivered asks. Questions never go to management.

**Ask detail** page: internal request, management version editor (only what management sees), Files (raw from management / final from deal team — every file is **click-to-download**), comments (Internal/Shared), Actions, Details card with **Court**, Asked by, **Deal team owners** (people picker for VP+, read-only list otherwise), urgency and due date, status timeline. Flag to MD puts it at the top of the MD's court.

**People picker** (owners and management recipient): everyone's headshot + first name on a "bench"; hover shows full name and title; drag into the "On it" box to assign, drag back out or click the × to remove; clicking also works (touch/keyboard). Several owners allowed; never zero; a single-slot mode picks the management recipient.

### Files
Data-room-style index of every file the deal has touched: deal materials, update attachments, data-request files. Folders by workstream; each file shows where it came from and links to the exact update; flagged when filed under a different workstream than where it was posted; files from retired workstreams stay findable. Add files, move to folder, download, export list. Built from the projected View so management never sees deal materials, final files or hidden workstreams.

### Progress (firm only)
Period toggle (Week / Month / Quarter / Custom) with an independently chosen **comparison point**. Stats: realized to date vs plan, added since the comparison, phases completed, asks closed. The **EBITDA bridge** with modes Realized / To go / Both; solid = realized, hatched = added since the comparison point, outlined = yet to realize; an optional **organic growth** step; connectors between steps. Hover = clean tooltip; click = detail panel below ("What moved since …": status changes, phases completed, KPI moves, asks closed, sub-pillar table). Comparing a period with itself shows zero change by design. **Export board supplement**: printable page with the bridge, realized vs target and per-pillar OP commentary (the only place commentary lives), defaulting to shared items only.

### Settings (firm only)
Members and roles, default visibility, urgency time limits, stale threshold, uploaded deal documents.

### Export to Excel (everywhere)
Every chart and table has Export to Excel: clean data sheets **plus a native Excel chart that references the cells**, so changing a number in Excel updates the chart. Bridge exports are stacked columns; KPI exports are line charts.

### AI
One main job: drafting the VCP from deal materials. One assist: drafting the management version of a data request. Both run server-side (Express) against Anthropic; without a key they return `not_configured` and the UI uses labelled templates/pre-built drafts — never presented as AI output.

---

## 6. How it's built

### Stack
- **Monorepo** (pnpm workspaces) on Replit with path-based routing: `artifacts/pillar` (web), `artifacts/api-server` (Express), `lib/api-spec` (OpenAPI contracts), `scripts` (Playwright browser checks).
- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4, React Router 7, **zustand** store persisted to **localStorage**, lucide icons. Charts are hand-drawn SVG (the bridge) plus Recharts for KPI lines.
- **Persistence (demo):** the whole database is a single JSON object in localStorage per browser. `SEED_VERSION` bumps run an in-place upgrade (`migrate.ts`) so saved plans survive; **Reset demo** restores the seed. Uploaded file bytes live in **IndexedDB** keyed by attachment id; seeded attachments have no bytes and download as clearly labelled sample files.
- **Backend:** Express with three AI endpoints (`generate`, `regenerate`, `suggest`) wrapping Anthropic; secrets never reach the browser.
- **Documents:** pdf.js and SheetJS parse uploads in the browser.
- **Excel:** ExcelJS builds the workbook; because ExcelJS cannot write charts, `excel.ts` post-processes the `.xlsx` zip with JSZip and injects hand-written DrawingML (`xl/charts/chart1.xml`, drawing, rels, content types, `<drawing>` in the sheet). Data rows start at row 5; chart ranges depend on it. Stacked-column bridge uses an invisible spacer series whose legend entry is deleted; number/string caches are included so Excel renders without recalculation.
- **Dates:** the seed is built relative to today, so Fernhill is always "month 5 of a 5-year hold" and due dates and stale flags stay live.

### Key modules (`artifacts/pillar/src/lib`)
| File | Role |
|---|---|
| `types.ts` | the thirteen objects and statuses |
| `seed.ts` | fictional data for three companies; `SEED_VERSION` |
| `migrate.ts` | upgrades browser-saved data across seed versions |
| `store.ts` | zustand store; every mutation goes through `mutate()` with a permission check and writes the activity log |
| `permissions.ts` | `projectView()` — the one place visibility is enforced; plan-to-date math |
| `selectors.ts`, `todos.ts` | derived data; "whose court is it in" |
| `askBoard.ts` | kanban columns, who may drag, what each drop means |
| `bridge.ts`, `period.ts` | bridge math (point-in-time via activity log), period/comparison handling |
| `exports.ts`, `excel.ts` | workbook builders and native-chart post-processing |
| `files.ts`, `fileLibrary.ts` | IndexedDB blob store; Files tab index |
| `ai.ts`, `fallbackPlan.ts`, `extract.ts` | AI calls with timeouts and labelled fallbacks; document parsing |

### Design principles that drove decisions
- **Build what the firm wants.** When in doubt, optimise for the deal team.
- **One permission function.** No page-by-page filtering; everything renders from the projected View.
- **Nothing bypasses the lifecycle.** Board drags, dashboard uploads and plan edits all end in the same store transitions, so the feed, activity log, Progress and Files stay consistent.
- **Never fake AI.** Fallbacks are always labelled as such.
- **Plain copy, simple screens, progressive disclosure.** The user repeatedly asked for less "AI-like" UI: collapsed by default, one idea per card, hover for detail, click for depth, no dark-pattern jargon.
- **Point-in-time truth.** Progress compares two snapshots reconstructed from the activity log, so comparing a date with itself is zero.

### Testing
- Vitest unit tests (`artifacts/pillar/test`): permission projection and leak words, plan-to-date and point-in-time progress math, Excel chart XML structure.
- Playwright browser checks (`scripts/src/test-*.mjs`, run against the live dev server with system Chromium): smoke (`test-pillar`), v1 (`test-improvements`), v2 bridge and exports, v3 plan-to-date / captured edits / kanban drag, v4+v5 court chips / backward moves / downloads / people picker / plan→asks links, bridge connector regression, Files tab. They assert on real downloads (PDF header bytes, round-tripped CSV content, chart XML inside the `.xlsx`).
- Production build verified with `PORT` and `BASE_PATH` set.

---

## 7. What we iterated on (feedback rounds and what changed)

The original build followed `SPEC.md` (v1 hackathon spec). Five rounds of written feedback followed, each turned into shipped changes and a browser test.

### v1 — "not intuitive, too overwhelming"
- Plan tab: collapsed by default, Expand all / Consolidate all, aligned columns, calmer card design modelled on a reference value-creation-plan layout (colours, photos, hover for phase completion).
- Asks tab: rebuilt as a one-screen kanban; closed items moved out of the main view; "in progress" split by who holds it (deal team / operating team / company); assignee shows title.
- Company switcher keeps you on the current tab.
- New ask: pillar then an optional sub-pillar select that populates correctly.

### v2 — charts, exports and the Progress tab
- Progress rebuilt as an **EBITDA waterfall/bridge** (entry → pillar steps → target) with Realized / To go / Both; solid realized, outlined to-go.
- Hover = small clean popup; click = detail panel below the chart.
- Comparison period chosen independently of the current period.
- Removed the "by pillar" table and area chart that read as "AI slop"; OP commentary kept only in the board supplement (open question: delete entirely?).
- **Export to Excel** added to every chart and table (data sheets + chart image at the time).
- Profile photos added to every user (AI-generated placeholders).

### v3 — plan to date, captured $, kanban drag
- Frozen top bar.
- Fixed Firm-only inheritance bug (sub-pillars under a Firm-only pillar now grey out as Firm only, not Shared).
- **Plan to date** column: straight-line ramp from start to target date; captured shown green on plan / pink behind; one initiative seeded behind.
- **Update captured EBITDA** modal from the plan, posting a real update.
- "Waiting on you" to-do section with links into the right tab.
- Kanban **drag-and-drop** with purpose-built move forms (who in management, management prompt, files; reason on resolve); resolved bucket collapsed at the bottom.

### v4 — two scenarios, dashboard court, backward moves
- **Fernhill** seeded as on plan, **Northgate** as behind plan (red "behind plan" copy, At risk / Off track pillars, overdue asks) so both looks can be demoed.
- Company logos; bridge target bar shows total realized "today".
- "Changes since your last visit" replaced by **In your court** on the dashboard with chips per person and Everyone; Plan tab lost its duplicate to-do section.
- Progress made **point-in-time**: numbers change with the comparison date; same date vs same date = zero; detail panel compares accurately.
- Asks show **created by and current owner / whose court**.
- **Backward moves** allowed with required reason and next steps (except straight back to management).
- Walked the UI as Associate, MD and OP and simplified copy and layouts.

### v5 — live Excel charts, downloads, asks home, multi-owner drag picker
- Excel exports now contain **native charts linked to the data cells** (the previous PNG was stale once numbers were edited).
- **Associate can download what management uploads** — real bytes round-trip through IndexedDB; seeded files download as labelled samples.
- **Asks are home in the Asks tab**: pillar pages show linked asks read-only and link out (`?pillar=`, `?new=1&pillar=`); no more duplicated, synced ask form on the Plan.
- Ask owners: **multiple people per ask**; dropdown replaced with a **drag-and-drop people picker** (headshots + first names, hover for full name and function, drag in / drag out, click fallback); same picker in single-slot mode for the management recipient.

### Parallel task work merged alongside
Organic EBITDA segment on the bridge; Files tab with workstream trails, folder moves, retired-workstream handling and dead-tag cleanup; bridge connector visibility fix and regression test; demo-readiness polish (`?as=` deep links, Copy demo link, neutral copy when AI isn't configured); dependency vulnerability fixes.

---

## 8. Judgement calls worth knowing

1. **Browser-local data, no server DB or auth.** One laptop, View-as switching; judges get their own fresh copy. Swapping in Postgres is straightforward because the model already matches the spec.
2. **AI never faked.** Timeouts (75 s for plan generation) and a visible "Use the pre-generated plan instead" button; fallbacks are labelled.
3. **After lock,** wording/status/owners/visibility/phases stay editable; structure and dollar targets require Revise plan.
4. **Routed data requests remain visible to management** even under a hidden pillar (the rewrite is the act of sharing).
5. **Board supplement defaults to shared items**; an internal copy is labelled "do not share with management".
6. **Native Excel charts via DrawingML** rather than images — more work, but it answers the "chart is stale" complaint directly.
7. **Click and drag both work** in the people picker (HTML5 drag doesn't work on touch).
8. **An ask always has at least one owner;** VP and above change owners.
9. **Comparing a period with itself shows zero** — Progress is reconstructed from the activity log, not from current totals.
10. **Logos and headshots are generated placeholders;** no real people or companies.
11. **"Enabler" pillars** (no EBITDA target) are footnoted on the bridge rather than drawn.
12. **Portfolio health** = worst pillar status.

### Open questions
- Remove OP commentary from the board supplement entirely, or keep it there only?
- Should the management recipient also use the drag picker (current) or a plain dropdown?
- Should management ever post updates (spec says no for v1)?
- Hosting beyond the demo: shared database, real auth, file storage.

---

## 9. How to run and test

```
# workflows (Replit): "artifacts/pillar: web" and "artifacts/api-server: API Server"
pnpm --filter @workspace/pillar run test            # unit tests
pnpm --filter @workspace/scripts run test:pillar    # browser smoke
pnpm --filter @workspace/scripts run test:improvements          # v1
pnpm --filter @workspace/scripts run test:improvements-v2       # bridge, exports
pnpm --filter @workspace/scripts run test:improvements-v3       # plan to date, kanban
pnpm --filter @workspace/scripts run test:improvements-v4       # v4 + v5
pnpm --filter @workspace/scripts run test:files                 # Files tab
PORT=5173 BASE_PATH=/pillar pnpm --filter @workspace/pillar run build
```

Demo tips: start on the Dashboard as the MD (Alex), switch to the Associate (Sam) and stay there; Fernhill is the healthy company, Northgate the one behind plan; `?as=sam` opens any page as Sam. Reset demo restores everything.
