# Changelog

All notable changes to Zentro will be documented in this file. Zentro follows a modular development path focusing on local-first database management.

---

## v0.2.0-beta (2026-03-21)

### Security & Privacy
* Migrated connection persistence to AES-GCM encrypted config + OS keyring-backed password storage.
* Added backward-compatible migration path for legacy plaintext/base64 password data.
* Added `encrypt_password` profile flag and surfaced it in the connection form.

### Observability & Reliability
* Added frontend Zustand logging middleware for store transitions and error traces.
* Added global React `ErrorBoundary` to capture runtime render failures consistently.
* Replaced backend global `emitEvent` function with dependency-injected `EventEmitter` for improved testability.

### Testing
* Added backend unit tests and benchmarks for query execution helpers and driver contracts.
* Set up frontend Vitest + React Testing Library test framework.
* Added test coverage reporting scripts (soft gate policy).

### Performance
* Optimized SQL pagination fallback string generation using builder-based construction.
* Reduced query row-scan allocations with pooled scan buffers and faster value conversion paths.

### Build & Release
* Updated product version metadata to `v0.2.0-beta`.
* Added release matrix script for Windows/macOS/Linux (`scripts/release-matrix.ps1`).
* Added frontend build-time Wails model check.

---

## v0.0.1 (2026-03-15)

### 🔌 Connection & Workspace Management
*   **Breadcrumb Navigation**: Implemented 2-level breadcrumb dropdown for quick connection and database switching ([d3a9b4a](https://github.com/alexnguyen03/zentro/commit/d3a9b4af8dcdf3679975025ae16d5d90ba40e95f))
*   **Session Restoration**: Enhanced session restoration to persist connection context and sync on app reload ([4d05893](https://github.com/alexnguyen03/zentro/commit/4d05893203cee246999f2bd1c8d7b8aeeb16bdc8), [f59bd6a](https://github.com/alexnguyen03/zentro/commit/f59bd6ad4acdeb80a48da49ac015fadd8c19c24c))
*   **Database Persistence**: Automatically persist the last selected database across application restarts ([c2df9df](https://github.com/alexnguyen03/zentro/commit/c2df9df8ffe66f31f3e8c45d1a908361c6cdfce9))
*   **Workspace Switcher**: Added a global workspace switcher and focused sidebar for multiple connection profiles ([5708687](https://github.com/alexnguyen03/zentro/commit/570868778918c199d8d3429f419cdb5e9d9aa082))
*   **Connection Options**: Added `show_all_schemas` and `trust_server_cert` configuration options ([e5a6df8](https://github.com/alexnguyen03/zentro/commit/e5a6df8be68b8d4a0ff2b85779f4b1e6ce2c27e3))
*   **Auto-Connect**: Intelligent auto-connection when selecting workspace items or opening saved scripts ([32fabc4](https://github.com/alexnguyen03/zentro/commit/32fabc49b41d5a3c3446f1e408621fa425087798))
*   **Bug Fix**: Resolved connection timeout issues and improved visual feedback during reconnection ([0cc2344](https://github.com/alexnguyen03/zentro/commit/0cc2344bd87b119a02382814acf83c2451740580), [6411c57](https://github.com/alexnguyen03/zentro/commit/6411c57ec29ed1d58e558b6cee3025f30e7854f3))

### 📝 SQL Editor & Query Engine
*   **Async Engine**: Completed the high-performance Async Query Engine supporting concurrent execution ([78e85bd](https://github.com/alexnguyen03/zentro/commit/78e85bdcfe5610a7c9f4ab90ee2974f49cea6ae7))
*   **IntelliSense**: Integrated context-aware SQL code completion and intelligent query block extraction ([2924685](https://github.com/alexnguyen03/zentro/commit/29246854a60ce172f4f93358bcbfad50f897b0d6), [9afdf01](https://github.com/alexnguyen03/zentro/commit/9afdf01fe3806742cad30404fd11c8c614f5f74f))
*   **Editor UX**: Implemented Monaco editor with VS Code-style tabs, including drag-and-drop and split-view support ([fb9b888](https://github.com/alexnguyen03/zentro/commit/fb9b888f600a6db876146a56a7fcd95fc05ce9e2), [35155db](https://github.com/alexnguyen03/zentro/commit/35155db497369341e0e144c8fb6561a0d098fac3))
*   **Template Management**: Premium template popover with inline editing and batch delete for common SQL patterns ([f754525](https://github.com/alexnguyen03/zentro/commit/f754525e57f39727cf87dd17878e6d60dd568af9))
*   **Auto-Save**: Implemented auto-saving of query tabs on close to prevent data loss ([be3285d](https://github.com/alexnguyen03/zentro/commit/be3285d26cdd0bdc75109a409b3ca9ec9559e29c))
*   **Fluid Zoom**: Supported Ctrl+Scroll wheel zooming for dynamic font size adjustments ([929ddf5](https://github.com/alexnguyen03/zentro/commit/929ddf56a037351da85650244dfd68ef11e9be21))

### 📊 Data Grid & Result Management
*   **Inline Editing**: High-performance inline editing with automatic SQL generation for updates ([b626eb0](https://github.com/alexnguyen03/zentro/commit/b626eb0547d66005055124edf48271b2affefe2f))
*   **Virtual Grid**: Implemented virtualized result grid for handling massive datasets with sorting and pagination ([e945f75](https://github.com/alexnguyen03/zentro/commit/e945f75f3abdd438d93a8f698af2d99bbf6f4650))
*   **Infinite Scroll**: Integrated true infinite scroll with backend offset pagination and loading states ([aed8eb8](https://github.com/alexnguyen03/zentro/commit/aed8eb87e53b42e3d3c15ed620814d0b30c1460a))
*   **Row Detail Sidebar**: Enhanced row detail view with JSON viewer and flexible field selection ([e93e80b](https://github.com/alexnguyen03/zentro/commit/e93e80bb384fc449ffdafc8cb00d028a984ba003), [11529da](https://github.com/alexnguyen03/zentro/commit/11529dad5de44a86bafd100a7c5eca8b7d285d61))
*   **Export**: Added CSV export with UTF-8 BOM support for Excel compatibility ([191905c](https://github.com/alexnguyen03/zentro/commit/191905cf4f468bf2258fe4c48fc99b488bf5ee4d))
*   **Optimistic UI**: Inline edits are applied optimistically to the UI for instant feedback ([efbebb4](https://github.com/alexnguyen03/zentro/commit/efbebb4454c3ae349d15b524c97c182349ab4c5e))

### 🛠️ Table Management & Schema Browser
*   **Table Designer**: Redesigned TableInfo with inline column editing, type autocomplete, and modified indicators ([938afb2](https://github.com/alexnguyen03/zentro/commit/938afb28d08fff4cf2c0575a46a99ac8a0a3feaf), [905d419](https://github.com/alexnguyen03/zentro/commit/905d419bba7a5d79c8d6394854cd6c60642c6730))
*   **Column Management**: Support for adding, deleting (with drag-selection), and reordering columns ([f297c44](https://github.com/alexnguyen03/zentro/commit/f297c4404fcfb819d9501d23605631a88937fac7), [aaab7a0](https://github.com/alexnguyen03/zentro/commit/aaab7a04841d87109c723fa376ad8f15c691769a))
*   **Rich Schema Tree**: Lazy-loading schema tree with support for Tables, Views, and cross-database browsing ([8e58eff](https://github.com/alexnguyen03/zentro/commit/8e58eff8386fff7c97961c386ca46aaab6541b80), [5dcd627](https://github.com/alexnguyen03/zentro/commit/5dcd627b208944881f09432dc35217827b0bf8de))
*   **Visual Polish**: Overhauled Table Designer style with a compact header and integrated toolbar ([1abcbc0](https://github.com/alexnguyen03/zentro/commit/1abcbc07a76bec84870b9625937143c144f60db7), [2946ced](https://github.com/alexnguyen03/zentro/commit/2946ced241f6f0874bedb947865436342a2fd508))

### 🗺️ ERD Visualization
*   **Interactive Diagrams**: Implemented ERD visualization using React Flow with automatic relationship detection ([33634be](https://github.com/alexnguyen03/zentro/commit/33634be479fcc4690c1f62ed87f5cc757c6d27b0))
*   **Crow's Foot Notation**: Redesigned ERD with Crow's Foot notation, relationship icons, and PK/FK badges ([5876c7f](https://github.com/alexnguyen03/zentro/commit/5876c7fdaee44dfc9150cfde2ab2d3abfbbf22d3), [f177765](https://github.com/alexnguyen03/zentro/commit/f17776505c10f1cc9544f9bfe31a7b8d3f2c9e7b))

### ⚙️ Settings & Platform UI
*   **Command Palette**: Added VS Code-style Command Palette for quick access to actions and navigation ([699d88f](https://github.com/alexnguyen03/zentro/commit/699d88f5edf661d58a21f13c8dd9110127eb44b3))
*   **Redesigned Settings**: Overhauled settings view into an editor tab with a vertical sidebar and Title-case aesthetic ([e3fb57b](https://github.com/alexnguyen03/zentro/commit/e3fb57b7dee4471023b73ffeccb8b602906caef4), [edb45d5](https://github.com/alexnguyen03/zentro/commit/edb45d59347526206ee9c17ab9863a07636a342e))
*   **Shortcuts Management**: Dedicated keyboard shortcuts tab with custom keybinding support ([e542480](https://github.com/alexnguyen03/zentro/commit/e542480327eabb0948cea8bea0027083a1f2d18a))
*   **Frameless Window**: Native-feel frameless window with custom toolbar and traffic light controls ([699914d](https://github.com/alexnguyen03/zentro/commit/699914df991aa4bbfb0ac7f4672513c96e88a7d4))
*   **Status Bar Redesign**: Floating provider logos and double-click functionality for rapid reconnection ([64edbb6](https://github.com/alexnguyen03/zentro/commit/64edbb6ff55d97c1ae6e4f7b0fa15715beb5ffef))

### 🚀 Core & Infrastructure
*   **Tech Stack Migration**: Successfully migrated from Fyne (Go UI) to Wails v2 + React + TypeScript stack ([c13e5f6](https://github.com/alexnguyen03/zentro/commit/c13e5f666ce12fc56d54f3893acdedf39d8510c6))
*   **Design System**: Integrated Tailwind v4 with a unified Super-Flat design system and Title-case rules ([2fd4b5d](https://github.com/alexnguyen03/zentro/commit/2fd4b5d082ec0574ea12a4c21a365d23c7154cdb))
*   **Driver Support**: Enhanced MSSQL support with TLS 1.0 compatibility and Postgres database discovery improvements ([7e1e89f](https://github.com/alexnguyen03/zentro/commit/7e1e89f583aca20515942a8f1ccdd77216077f96), [00b0fc4](https://github.com/alexnguyen03/zentro/commit/00b0fc4e6abaadfb1518cff4ce12a32bce222600))

