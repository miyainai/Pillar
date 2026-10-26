---
name: Task validation runs on a merge with main
description: Completion validation/code review runs against your branch merged with the latest main, not your fork as-is.
---
Rule: before marking a task complete, fetch and merge main locally (`git fetch main-repl && git merge main-repl/main`) and re-run the unit tests, because validation runs on that merged state.

**Why:** A sibling task merged mid-session (Files tab deep links to updates) changed a helper's behavior; my fork's tests passed, but validation failed and review rejected on the merged code.

**How to apply:** Any task touching shared libs in artifacts/pillar/src/lib (permissions, fileLibrary, store) is at risk when other Files/Progress tasks are in flight.
