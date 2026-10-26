# Validation and technical notes

Checked October 25, 2026 on macOS Apple Silicon with Node.js 24.13.1 and pnpm 11.25.0, using the exported project and its dependency lockfile.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed after restoring platform-specific native dependencies and approving esbuild in workspace configuration |
| `pnpm test` | Passed: 65 tests across 9 test files |
| `pnpm typecheck` | Passed: library projects, frontend, API, mockup sandbox, and scripts |
| `pnpm build` | Passed: frontend and Express API bundles |
| `pnpm dev` | Frontend served on port 5173; API served on port 8080 |
| Browser smoke (`PILLAR_TEST_URL=http://localhost:5173 pnpm test:browser`) | Passed; no browser runtime errors |

The browser smoke exercised dashboard rendering, role-filtered views, posted and persisted updates, routes, bridge connector layering, PDF/XLSX extraction, pre-generated demo plans, and persona deep links. These tests validate demo behavior, not production access controls.

## Portability changes

- Added a root development launcher that starts both services and reads optional local `.env` settings.
- Added default frontend port/base path and an `/api` proxy for local use.
- Restored native build dependency variants excluded by the Linux-only Replit export.
- Pinned the package manager and documented Node.js 24.
- Removed shell-specific environment assignment from the API development command.
- Updated the SheetJS dependency test to check the shipped application rather than an excluded local migration archive.
- Preserved the original debrief unchanged as historical context.

## Known limits

- Windows and Linux were not exercised in this cleanup. Platform packages are no longer explicitly excluded, but cross-platform behavior still needs verification.
- The production build reports large JavaScript chunks, including document/Excel tooling. Bundle optimization remains future work; warnings have not been suppressed.
- Live Anthropic calls were not tested. The provider model and beta API options are account-dependent and may need updates.
- The original dependency-security document is historical. No new vulnerability audit was performed, and no clean-security-scan claim is made.
- The full collection of historical browser scenarios was not rerun; the smoke suite and all unit tests were run.
- Build success does not provide a hosted demo. A deployment must serve the SPA and route `/api` to the backend.

For product behavior, read [the debrief](Pillar-Debrief.md). For setup and prototype boundaries, read [the README](../README.md).

The supplied Replit demo URL responds with a Replit protection redirect to automated HTTP checks. The deployed UI was not independently verified in this cleanup; the local browser smoke results above are verified.
