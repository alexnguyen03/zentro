# Zentro Framework Builder

**Description (Mô tả)**: This skill transforms Zentro into a modular, extensible framework inspired by Eclipse's plugin architecture, emphasizing reusability for future development. It adheres to a "Zen" design philosophy: focused (core functionality first), concise (minimal code and features), and uncluttered (no unnecessary flair in UI or logic). The agent generates code for pluggable modules (e.g., database drivers, UI extensions), using Go interfaces for extensibility, while ensuring simplicity and maintainability.

**SKILL.md Key Instructions (Hướng dẫn chính trong file SKILL.md)**:
- **Trigger phrases**: "build zentro as framework", "make zentro extensible like eclipse", "apply zen design to zentro framework", "generate modular code for zentro with zen philosophy", "create plugin system for zentro sql client".
- **Core Principles to Enforce (Zen Philosophy)**:
  - Simplicity over complexity: Generate minimal code; avoid unnecessary abstractions or features (e.g., no advanced UI animations unless explicitly requested).
  - Focus on essentials: Prioritize core modules (connection, query execution, result grid) as pluggable; defer non-essential features.
  - Clarity and balance: Use clear interfaces for extensions; ensure code is readable and balanced between design (theory) and implementation (practice).
  - Minimalism: Limit dependencies; aim for low overhead (e.g., native Fyne widgets without bloat); UI should be clean, uncluttered, and intuitive.
- **Steps to Generate Framework Structure**:
  - **Project Architecture**: Create a modular monolith structure inspired by Eclipse's OSGi bundles:
    - Core package: internal/core/ – Handles framework bootstrapping (e.g., app init, plugin registry).
    - Plugin interfaces: Define extensible points using Go interfaces (e.g., DatabaseDriver interface for PostgreSQL/MSSQL plugins).
    - Modules: Separate into pluggable packages (e.g., plugins/db/postgres, plugins/ui/query-editor) that implement core interfaces.
    - Use dependency injection (e.g., via Uber's Dig or manual) for loading plugins dynamically.
    - Example folder structure:
      ```
      zentro-framework/
      ├── cmd/
      │   └── zentro/
      │       └── main.go  // Bootstrap: Load core, register plugins, start Fyne app
      ├── internal/
      │   ├── core/        // Framework kernel: Plugin registry, DI container
      │   ├── plugins/     // Extensible modules
      │   │   ├── db/      // Database plugins (implements Driver interface)
      │   │   │   ├── postgres/
      │   │   │   └── mssql/
      │   │   ├── ui/      // UI extensions (implements WidgetProvider interface)
      │   │   │   ├── query-tab/
      │   │   │   └── result-grid/
      │   └── models/      // Shared structs (e.g., ConnectionProfile)
      ├── go.mod
      └── go.sum
      ```
  - **Extensibility Mechanism (Eclipse-like)**:
    - Use Go interfaces for plugin points: e.g., type Plugin interface { Init() error; Name() string; }.
    - Registry: func RegisterPlugin(p Plugin) in core; load via reflection or explicit registration in main.go.
    - For dynamic loading (if needed): Suggest go-plugin package (github.com/hashicorp/go-plugin) for true pluggable .so files, but warn about platform limitations; fallback to static linking for MVP.
  - **Zen UI Design**:
    - Generate Fyne UI with minimal widgets: e.g., clean tabs without shadows/animations; focus on functionality (query run, result edit) over aesthetics.
    - Enforce uncluttered layout: Use container.NewBorder for simple structure; avoid complex themes.
  - **Code Generation Examples**:
    - For a new plugin: "Add db plugin for mysql" → Generate package with interface implementation, register in core.
    - Apply Zen: If code exceeds 100 lines per func, suggest refactor for conciseness.
  - **Negative Instructions (What to Avoid)**:
    - Do not add bloat: No automatic inclusion of unused libraries (e.g., no chroma for highlighting unless requested).
    - Avoid over-engineering: No full OSGi emulation; stick to Go idioms (interfaces + modules).
    - No colorful UI: Stick to Fyne defaults; no custom colors/themes unless specified.
- **Output Format**: Always generate code snippets with explanations; suggest tests for each module; output in Go format with proper indentation.
