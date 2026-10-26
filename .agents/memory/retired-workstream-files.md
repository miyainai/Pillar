---
name: Files from retired workstreams
description: How the Files tab treats files whose pillar/sub-pillar was retired or deleted; firm-only, no special folder.
---
Decision: a file whose own plan item is gone stays listed with no workstream (only under "All files"), or under the parent pillar when just the sub-pillar was removed. Updates on gone items ride on the View separately from the feed (`retiredUpdates`) so Progress/Dashboard are untouched; management gets none of them. No link to the update is offered because no page can show it.

**Why:** Consistency across documents, update attachments and request files was preferred over a special "Retired workstreams" folder (proposed as a follow-up). Management rules were explicitly to stay unchanged.

**How to apply:** Any new file source should go through the same fallback (resolveWorkstream → null) and never render a retired pillar's name; tests in artifacts/pillar/test/files.test.ts enforce this.
