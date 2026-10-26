# Pillar on Replit

The imported app now runs in the pnpm workspace, preserving its original UI,
routes, local demo state, sample documents, and role views.

Start the **Pillar** and **API Server** managed workflows and open the root preview.

## Checks

```sh
pnpm --filter @workspace/pillar run test
pnpm --filter @workspace/scripts run test:pillar
```

The browser test checks role visibility, updates and reload persistence, primary
routes, PDF/Excel extraction, and labeled fallback plan generation.

Live AI requires a server-side Anthropic configuration. Without it, the original
demo fallback remains available. No credentials are included in the frontend.

The original specification and demo script are preserved in `.migration-backup/`.
