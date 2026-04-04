# UI Component Policy (shadcn-first)

`components/ui` is reserved for reusable design-system primitives (shadcn + Radix composition).

## Rules
- Feature components must consume UI from `@/components/ui`.
- Do not import `@radix-ui/*` directly outside `components/ui`.
- Do not use legacy layout wrappers from `components/layout/Modal` or `components/layout/OverlayDialog`.
- Prefer `Button`, `Input`, `Select`, `Checkbox`, `Switch`, `Dialog/Modal`, `Tooltip`, `DropdownMenu`, `Command`, `Tabs`, `ScrollArea`, `Sheet`, `Textarea`, `RadioGroup`.

## Not Allowed In `components/ui`
- Domain components (connection tree, result tables, editor business widgets).
- Components tied to app stores/services/business logic.

## Native Controls Policy
Native `<button>`, `<input>`, `<textarea>` are blocked by policy for feature UI unless explicitly allowlisted.

Current allowlist (performance/third-party/specialized editors):
- `components/sidebar/RowDetailTab.tsx`
- `components/editor/resultTable/ResultTableGrid.tsx`
- `components/editor/resultTable/useResultTableColumns.tsx`
- `components/editor/TableInfo/ColumnRow.tsx`
- `components/editor/TableInfo/DataTypeCell.tsx`
- `components/layout/settings/SettingsData.tsx` (range slider)
- `components/layout/settings/SettingsProfiles.tsx` (hidden file input)
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
- Native-control warnings for non-allowlisted files
