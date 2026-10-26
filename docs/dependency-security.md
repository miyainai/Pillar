# Dependency security

## Patched dependency floors

The October 2026 dependency remediation uses these safe versions:

| Dependency | Installed version | Reason |
| --- | --- | --- |
| body-parser | 2.4.0 | GHSA-27r3-jxmh-p828 |
| Zod (all copies) | 4.6.7 | GHSA-mrhx-c7xc-m3w5 |
| uuid (ExcelJS) | 11.1.1 | GHSA-w5hq-g745-h8pq; retains CommonJS support |
| undici | 7.30.1 | GHSA-xjj6-f33q-929c, GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472 |
| postcss-selector-parser | 7.1.7 | GHSA-rj75-hqrm-r3gf |
| fast-uri | 3.1.9 | GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp, GHSA-xhq7-xmqj-769h |
| react-router | 7.18.4 | GHSA-337j-9hxr-rhxg, GHSA-wrjc-x8rr-h8h6 |

Express, ExcelJS, and Tailwind Typography still reference affected transitive
dependencies in their latest releases. Narrow workspace overrides supply patched
versions. Zod is overridden globally to avoid leaving a vulnerable v3 peer copy.
The form resolvers and API schema generator are upgraded for Zod 4 compatibility.
The one-day minimum release age and package firewall remain enabled.

The running app already used React Router 7.18.4. The v6 finding came from
`.migration-backup/package-lock.json`; its dependency records are also updated.
The archive is not a workspace and its original source is not tested or supported
as a standalone application. Use `artifacts/pillar` to run the product.

## SheetJS: upstream-fixed releases incorrectly flagged as vulnerable

Both the active app and the archive use the official CDN build of **0.20.3**,
not the obsolete npm registry release of `xlsx` (0.18.5).

Upstream advisories explicitly state:

- [CVE-2023-30533 / GHSA-4r6h-8v6p-xvw6](https://cdn.sheetjs.com/advisories/CVE-2023-30533):
  affected through 0.19.2; fixed in **0.19.3**.
- [CVE-2024-22363 / GHSA-5pgg-2g8v-p4x9](https://cdn.sheetjs.com/advisories/CVE-2024-22363):
  affected through 0.20.1; fixed in **0.20.2**.

The scanner's npm ecosystem records have an open-ended affected range with no
fixed version. They therefore also match the patched CDN release, contrary to
the descriptions in those same advisories. The final scan still reports these
two findings (twice each, for the active app and archive).

We retain the verified patched release, with its lockfile integrity hash, rather
than remove legacy `.xls` support, switch to the vulnerable npm release, rename
the package to hide it, or suppress findings globally. No scanner ignore rule is
added. Reassess this evidence when changing SheetJS or when the advisory data is
corrected. Browser checks exercise real PDF/XLSX import, and unit tests reopen
Excel exports and verify native chart parts.

### Reverification and disposition (2026-10-24)

The upstream advisory pages and the dependency scan were rechecked. The scan
still reports these two advisories for both manifests (four high findings total),
while its own descriptions identify fixes below the installed 0.20.3 version.
These are retained false positives, not a clean scan.

The product owner explicitly chose to keep the patched official release and
legacy `.xls` imports instead of replacing SheetJS and losing that support.
No dependency was renamed, no advisory was suppressed, and no import format was
removed.

The official CDN tarball was downloaded and its SHA-512 verified against the
archive lockfile. The active pnpm lockfile now pins the same integrity:
`sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`.
Regression tests check the official release in both manifests and exercise
multi-sheet `.xlsx`, binary `.xls`, quoted CSV, and unreadable-workbook handling.
