---
name: Dependency advisory interpretation
description: SheetJS CDN versions need upstream advisory checks; archive lockfiles are also scanned.
---

Treat SheetJS npm-ecosystem scanner ranges with care: npm publishing stopped
before the security fixes, but official CDN releases contain the fixes.
Compare the installed CDN version against upstream's advisory text before
replacing the parser or removing legacy XLS support. Never conceal this by
renaming packages or adding broad scanner suppressions.

**Why:** An open-ended npm affected range flags official CDN releases even when
the same advisory description says they are fixed. The repository's migration
archive is also scanned, so a finding need not come from the active workspace.

**How to apply:** Confirm package provenance and lockfile integrity, check both
active and archived manifests, and report residual false positives explicitly.
See `docs/dependency-security.md` for the upstream evidence.

The product owner confirmed on 2026-10-24 that the patched SheetJS release and
legacy `.xls` support should be retained rather than replacing the parser solely
to eliminate these false-positive scanner findings.

**Why:** Removing legacy import support would change product behavior without
fixing an actual exposure to either of these two advisories.

**How to apply:** Preserve `.xls` imports and disclose the residual findings;
reassess if upstream evidence changes or a genuinely affected release is found.
