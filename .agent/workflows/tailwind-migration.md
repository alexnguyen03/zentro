---
description: Migrate a single Zentro frontend component from manual CSS / inline styles to Tailwind v4 utility classes, following the project's design-system rules.
---

// turbo-all

## Context

Tailwind v4 is already wired in `frontend/src/index.css` (via `@import "tailwindcss"` and an `@theme {}` block).
Design tokens live in `frontend/src/styles/base.css` and are exposed to Tailwind as:
- `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-tertiary`
- `text-text-primary`, `text-text-secondary`
- `border-border`
- `text-error`, `text-success`, `text-accent`
- `font-sans`, `font-mono`
- `rounded-sm` (3px), `rounded-md` (4px), `rounded-md` (6px), `rounded-xl` (8px)

The `cn()` helper lives at `frontend/src/lib/cn.ts`.

---

## Pre-flight (run once, not per-component)

1. Confirm `clsx` and `tailwind-merge` are installed:
```bash
cd frontend && npm list clsx tailwind-merge
```
If missing:
```bash
cd frontend && npm install clsx tailwind-merge
```

2. Confirm `src/lib/cn.ts` exists. If not, create it:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

3. Confirm `src/styles/components.css` exists. If not, create it with the global escape-hatch classes (resizer, virtual-scroll, cell-input, shimmer).

---

## Per-component migration steps

**Inputs required:**
- `COMPONENT_TSX` — absolute path to the `.tsx` file
- `COMPONENT_CSS` — absolute path to the matching `.css` file (may not exist)

### Step 1 — Read and understand current state

Read `COMPONENT_TSX` and `COMPONENT_CSS` in full. Build a mental map of:
- Which CSS class names are used in JSX (`className=`)
- Which inline `style={{ }}` props exist
- Which CSS class definitions belong to this component exclusively vs shared

### Step 2 — Identify what can be removed vs kept

Classify each class/style into one of three buckets:

| Bucket | Action |
|---|---|
| **A — Pure layout/color/spacing** | Replace with Tailwind utilities |
| **B — Complex CSS** (keyframes, ::webkit-*, virtual scroll) | Move to `src/styles/components.css` |
| **C — Shared base classes** (`.sidebar`, `.resizer`, `.sidebar-tab-btn`) | Keep in `Sidebar.css` / global until the whole layer is migrated |

### Step 3 — Apply migration to TSX

Rules:
- Replace every `style={{ display: 'flex', ... }}` with Tailwind classes.
- Replace every `style={{ color: 'var(--text-secondary)' }}` with `text-text-secondary`.
- Replace template-literal `className` with `cn()`.
- Never write a raw hex or rgb value — always use a Tailwind token.
- Keep prop-based dynamic classes inside `cn()` as conditional entries.

Example conversion:
```tsx
// BEFORE
<div style={{ display: 'flex', gap: 8, padding: '4px 12px', background: 'var(--bg-secondary)' }}>

// AFTER
<div className="flex gap-2 px-3 py-1 bg-bg-secondary">
```

Spacing scale reference (Tailwind default × 4px):
- `gap-1` = 4px, `gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px
- `p-1` = 4px, `p-2` = 8px, `p-3` = 12px
- `px-2` = horizontal 8px, `py-1` = vertical 4px

### Step 4 — Move surviving CSS to components.css

If any Bucket B classes remain, append them to `src/styles/components.css` with a comment header:
```css
/* ── <ComponentName> ─────────── */
```

### Step 5 — Delete the component CSS file

If the component's CSS file is now empty or has been fully migrated, delete it and remove its `@import` from `index.css`.

### Step 6 — Type-check and verify

```bash
cd frontend && npx tsc --noEmit
```

Fix any TypeScript errors introduced. Do not proceed until exit code is 0.

### Step 7 — Commit

Follow the project's Conventional Commits format:
```
style(<scope>): migrate <ComponentName> to Tailwind

- Removed <N> inline style props
- Replaced <M> CSS class definitions with utilities
- Deleted <ComponentName>.css
```

---

## CSS Design Rules (must be enforced globally)

1. **Zero `style={{ }}` for visual properties** — only use `style` for truly dynamic computed values (e.g., `style={{ width: resizeWidth }}`).
2. **`cn()` always** for conditional className.
3. **No hardcoded colours** — use theme tokens only.
4. **No per-component `.css` files** after migration — all exception CSS goes to `components.css`.
5. **Group utilities** in this order within a single className: layout → spacing → colour → typography → border → interaction → animation.

---

## Migration order (batches per layer)

Process in this order so the app stays functional between commits:

| Batch | Files |
|---|---|
| P0 | Tooling: `cn.ts`, `components.css`, `index.css` `@theme` expansion |
| P1 | Layout: `App.tsx`, `Toolbar.tsx`, `Sidebar.tsx`, `StatusBar.tsx` |
| P2 | Editor: `QueryTabs.tsx`, `TabBar.tsx`, `QueryGroup.tsx`, `ResultPanel.tsx`, `ResultTable.tsx`, `TableInfo.tsx` |
| P3 | Panels: `ContextMenu.tsx`, `ConnectionPicker.tsx`, `ConnectionTree.tsx` / `SchemaTree.tsx`, `ConnectionDialog.tsx`, `HistoryPanel.tsx`, `SavedScriptsPanel.tsx`, `RowDetailSidebar.tsx` |
| P4 | Overlays: `Modal.tsx`, `ShortcutHelp.tsx`, `WorkspaceModal.tsx`, `Toast.tsx`, `SettingsDialog.tsx` |
