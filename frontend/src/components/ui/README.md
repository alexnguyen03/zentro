# UI Component Policy (shadcn-first)

`components/ui` is reserved for reusable design-system primitives (shadcn + Radix composition).

Reference: `docs/ui-system-pattern-v1.md` for strict spacing/typography/layout/UX rules and PR checklist.
Release workflow: `docs/design-system-changelog.md` + `docs/design-system-release-template.md`.
Pattern catalog: `docs/ui-pattern-catalog-v1.md`.

## Rules
- Feature components must consume UI from `@/components/ui`.
- Do not import `@radix-ui/*` directly outside `components/ui`.
- Do not use legacy layout wrappers from `components/layout/Modal` or `components/layout/OverlayDialog`.
- Prefer `Button`, `Input`, `Select`, `Checkbox`, `Switch`, `Slider`, `Dialog/Modal`, `Tooltip`, `DropdownMenu`, `Command`, `Tabs`, `ScrollArea`, `Sheet`, `Textarea`, `RadioGroup`.
- Shared primitive API uses `tone`, `state`, `density="compact"` contract.
- Composite API for app shell and settings includes `AppShell`, `Panel`, `FormSection`, `ActionBar`, and `DataEmpty/DataLoading/DataError`.

## Not Allowed In `components/ui`
- Domain components (connection tree, result tables, editor business widgets).
- Components tied to app stores/services/business logic.

## Native Controls Policy
Native `<button>`, `<input>`, `<textarea>` are blocked by policy for feature UI unless explicitly allowlisted.

Current allowlist:
- `components/layout/OverlayDialog.test.tsx`
- `components/ui/Input.tsx`
- `components/ui/textarea.tsx`

## Guardrails
Run:
- `npm run check:guardrails`

Guardrails enforce:
- No legacy modal APIs
- No legacy form wrappers
- No direct Radix imports outside `components/ui`
- No legacy layout dialog wrappers
- Native-control violations for non-allowlisted files

## Sidebar Architecture Policy
- Primary/secondary sidebar shells must render panels from internal `SidebarPanelRegistry`.
- Do not hardcode tab arrays or `SidebarTab` local enum state inside shell components.
- Register built-in panels in one place (`components/sidebar/sidebarPanels.tsx`) and keep shell generic.
- Persist sidebar UI state through `sidebarUiStore` with context key `project + environment`.

Sidebar onboarding checklist:
1. Create panel component under `components/sidebar` (or `components/sidebar/panels`).
2. Add panel default UI state in `sidebarPanelStateDefaults.ts`.
3. Register panel metadata in `sidebarPanels.tsx` (`id`, `side`, `order`, `icon`, `render`, optional `getBadge`).
4. Store panel-local UI state via `useSidebarPanelState`.
