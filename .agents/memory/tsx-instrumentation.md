---
name: TSX instrumentation compatibility
description: An optional Replit editor plugin can corrupt generic JSX during Vite transformation.
---

When enabling optional visual-editor instrumentation on this imported app,
verify generic JSX components still compile.

**Why:** Cartographer inserted metadata attributes before TypeScript generic
arguments, turning valid generic JSX into invalid syntax and preventing the app
from rendering. Disabling that optional plugin preserved the original components.

**How to apply:** If a later toolchain upgrade reintroduces instrumentation,
check a page containing generic Select components before retaining the change.
Prefer removing optional instrumentation to rewriting working imported UI.
