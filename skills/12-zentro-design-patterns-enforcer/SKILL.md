# Zentro Design Patterns Enforcer

**Description**: This skill enforces strict adherence to a predefined set of design patterns and architectural principles when generating or modifying code for the Zentro project. It acts as a non-negotiable guideline: the agent must always select and apply appropriate patterns from the approved list, explain choices briefly in comments, and avoid violating the Zen philosophy (simplicity, focus, minimalism). The agent implicitly prioritizes these patterns in every relevant response unless explicitly instructed otherwise.

**SKILL.md Key Instructions**:

- **Trigger phrases**: "enforce design patterns", "apply zentro patterns", "use approved patterns in code", "follow zentro design guidelines", "architect zentro code with patterns", hoặc bất kỳ prompt nào liên quan đến việc viết code kiến trúc cho Zentro (tự động trigger khi thấy từ khóa như "architecture", "refactor", "modular", "plugin", "extend").

- **Mandatory Rules (Always Apply – No Exceptions)**:
  - Before writing any structural or behavioral code, review the following approved design patterns and select the most suitable one(s):
    - Singleton: For single-instance components (e.g., current connection manager, app state).
    - Factory Method / Abstract Factory: For creating database drivers or pluggable components based on configuration.
    - Facade: To simplify complex subsystems (e.g., database interaction facade).
    - Observer: For UI updates on state changes (connection status, query results).
    - Strategy: For interchangeable behaviors (e.g., query execution modes).
    - Dependency Injection: For loose coupling and testability (inject drivers, loggers, themes).
    - Plugin / Module Architecture: For extensibility (core + pluggable modules via interfaces).
    - Hexagonal / Ports & Adapters: To separate domain logic from frameworks (Fyne UI, DB drivers).
  - Always prefer the simplest pattern that solves the problem (Zen principle: avoid over-engineering).
  - If multiple patterns apply, choose the one with least code complexity and best readability.
  - In generated code:
    - Add inline comments explaining which pattern is used and why (e.g., "// Using Facade pattern to hide db/sql details").
    - Structure packages to support modularity (internal/core, internal/plugins, etc.).
    - Use Go interfaces for extension points.
  - Negative instructions (strictly avoid):
    - Do NOT introduce patterns not listed above unless the user explicitly requests it.
    - Do NOT hard-code dependencies; always prefer DI.
    - Do NOT create monolithic classes or god objects.
    - Do NOT add unnecessary layers or abstractions.

- **Decision Flow**:
  1. Analyze the task (e.g., "implement connection manager" → likely Singleton + Factory).
  2. Select 1–2 patterns from the list.
  3. Generate code that follows the pattern exactly.
  4. If uncertain, ask the user for clarification on pattern preference before proceeding.

- **Output Style**:
  - Always include a short "Pattern Usage" section at the top of code blocks.
  - Example:
    ```
    // Pattern Usage:
    // - Singleton: For global connection state
    // - Factory: To create driver-specific connections
    ```
