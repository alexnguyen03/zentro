# Phase 3 Resilience Checklist

## Startup Recovery
- Validate persisted local state keys before bootstrapping project/session stores.
- Auto-clean unreadable or corrupted JSON payloads.
- Emit warning logs and status message when recovery is applied.

## Migration Safety
- Keep telemetry consent backward-compatible (`v1` to `v2` migration path).
- Normalize settings bounds on load/save (timeouts, limits, toast placement).
- Keep feature gate behavior deterministic via entitlement matrix defaults.

## Policy Hardening
- Resolve execution policy by environment profile assignment.
- Support strict destructive policy (`prompt` or `block`) at runtime.
- Keep defaults safe for staging/production environments.

## Extensibility
- Provide query/result contribution contracts for future plugin augmentations.
- Keep contribution registry APIs stable (`register`, `list`, `unregister`).
- Ensure no hard dependency between contributions and core query runtime.

