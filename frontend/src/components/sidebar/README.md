# Sidebar Architecture (Registry-Driven)

Sidebar shell is plugin-ready internally: shell components only render panel metadata from registry.

## Core contracts
- `SidebarSide`: `primary | secondary`
- `SidebarPanelDefinition<TState>`:
  - `id`, `side`, `label`, `icon`, `order`
  - `render()`
  - optional `getBadge()`
  - optional `defaultState`
- Registry APIs:
  - `registerSidebarPanel(definition)`
  - `unregisterSidebarPanel(side, panelId)`
  - `getSidebarPanels(side)`
  - `useSidebarPanels(side)`
- Panel-local persistence:
  - `useSidebarPanelState(side, panelId, defaultState)`

## Persistence model
- Store: `sidebarUiStore`
- Context key: `${projectId}::${environmentKey}`
- Persisted:
  - active panel per side
  - width per side
  - panel state per panel id

## Adding a new panel
1. Implement panel component.
2. Add default state in `sidebarPanelStateDefaults.ts`.
3. Register panel in `sidebarPanels.tsx`.
4. Use `useSidebarPanelState` for panel UI state.
5. Run guardrails + tests.
