# UI Component Policy (shadcn-first)

`components/ui` is reserved for reusable, design-system primitives.

## Allowed in `components/ui`
- shadcn/radix primitives (`Button`, `Input`, `Dialog`, `AlertDialog`, `Tooltip`, `Checkbox`, etc.)
- tiny presentation wrappers that only compose primitives and do not contain product/domain logic

## Not allowed in `components/ui`
- feature/domain components (database trees, result-table logic, editor-specific widgets)
- components that depend on app stores/services/business rules

## Current direction
- Prefer direct primitive composition from `@/components/ui/*`.
- Move domain-heavy components to feature folders (`components/connection`, `components/editor`, `components/shared`, ...).
- Avoid adding compatibility wrappers when a primitive composition is enough.

## Existing migrations done
- `DatabaseTreePicker` moved to `components/connection`.
- `BaseTable` moved to `components/shared`.
- Legacy wrappers removed: `FormField`, `SelectField`, `SwitchField`, `SearchField`, `Divider`.

## Guardrails
- `scripts/check-fe-guardrails.mjs` blocks legacy modal APIs, legacy form wrappers, legacy `Tooltip content=...` usage, and domain component imports from `components/ui`.
