---
name: Saved-data upgrades
description: Rule for changing the persisted demo database shape or seed version without losing users' saved work
---
Rule: a seed version bump keeps the saved localStorage database and fills in new
fields; it never replaces saved data wholesale for versions the app understands.

**Why:** A release that reset everyone's browser data to the seed was rejected in
review as a data-loss regression — people build their own companies and plans in
the demo and expect them to persist. "Reset demo" is the explicit way to pick up
new sample content.

**How to apply:** Add new DB fields as optional (or fill them in the upgrade step),
bump the version only when the seed content changes, and verify an upgrade from a
populated previous-version store keeps its companies and files.

Gotcha: the persist `migrate` step (upgradeDb) only runs when the saved version
differs from the current one. A data clean-up that must reach plans saved at the
*current* version (e.g. stale refs left by a bug fixed without a version bump) has
to also run in the persist `merge` step, which runs on every load. Unit tests run
in node with no localStorage, so the store's persist API is absent unless a
storage stand-in is installed before the store module is imported (vi.hoisted).
