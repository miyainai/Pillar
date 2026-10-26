---
name: Demo persona switching
description: Why persona deep links are applied before React mounts, and how View-as and deep links must share one switch path.
---

# Demo persona switching

**Rule:** `?as=` persona deep links are resolved and applied synchronously before the
router mounts (the store hydrates from localStorage synchronously), then the parameter is
stripped with `history.replaceState`. The View-as menu and the deep link go through the
same switch helper so company/page redirect rules stay identical.

**Why:** doing it in a React effect races the company route gate (child effects run first),
which briefly rendered the previous viewer and could sync the wrong company. Pre-mount
application avoids the flash and the ordering problem.

**How to apply:** any new "open as persona" entry point (QR codes, scripted demos, tests)
should call the shared switch helper rather than `setUser` directly. Playwright checks can
assert the viewer via the dev-only `window.__pillar` store handle.
