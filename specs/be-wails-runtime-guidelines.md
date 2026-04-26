# BE Wails Runtime Guidelines

## Context ownership
- Runtime-facing services must use app-managed context set during `Startup`.
- Do not create ad-hoc runtime contexts for event emission.
- Service contexts can use timeout/cancel for DB operations, but UI/runtime emits must use the managed app context.

## Event naming
- Event names must be declared in `internal/constant/events.go`.
- Hardcoded event literals are not allowed outside that file.
- During migration windows, emit both `v1` and `v2` names via `EmitVersionedEvent`.

## Payload contracts
- Backend core services must emit typed payload structs.
- Legacy `v1` map payloads are produced only by the bridge helper in `event_emitter.go`.
- New FE integrations should consume `*.v2` typed event contracts.

## Guardrails
- Run `node scripts/check-be-guardrails.mjs` before merge.
- Run `node scripts/be-debt-dashboard.mjs` to track closure metrics.
