# Zentro Beta 2 Release Notes (v0.2.0-beta)

## Highlights
- Password storage is now hardened with AES-GCM encrypted config + OS keyring secrets.
- Backend event emission was refactored to dependency injection for better unit testability.
- Frontend now has centralized state/error logging middleware and a global React error boundary.
- Unit-test foundation was added for backend (`executor`, `query_service`, driver contracts) and frontend (stores + error boundary).
- Query execution hot paths were optimized (reduced allocations during row scanning and pagination string generation).
- `connectionStore` no longer depends on generated Wails model types.

## Security Improvements
- Removed insecure password persistence path (base64-only storage is now migration-only).
- Legacy plaintext/base64 config data is auto-migrated when loaded.
- New connection option: `Encrypt password` (enabled by default when `Save password` is on).

## Performance
- Reduced per-row allocations in query scanning with reusable buffers.
- Replaced hot `fmt.Sprintf` path in pagination fallback with builder-based construction.
- Added benchmark coverage for query scanning and SQL statement splitting paths.

## Packaging and Build
- Version metadata updated to `v0.2.0-beta`.
- Added release matrix script for `windows/amd64`, `darwin/universal`, and `linux/amd64`.
- Added build-time Wails model existence check for frontend builds.

## Known Limitations
- Frontend and backend coverage targets are currently soft-gated (reported, not enforced as hard CI blocker).
- Multi-platform installer verification is limited by available local runner environments.

## Migration from Beta 1
- Existing saved profiles are auto-migrated on first load.
- If a password was stored using legacy base64 format, it is moved to OS keyring on save/migration.
- Build/test scripts were expanded:
  - `npm run smoke` (root)
  - `npm run test` (frontend via Vitest)
  - `go test ./...` (backend)
