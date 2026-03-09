---
trigger: always_on
---

# Coding Style Rules

These rules define coding standards for the Zentro project.

The project consists of:

Backend
- Go
- Wails

Frontend
- React
- TypeScript
- Vite

All generated code must follow these standards.

---

# 1. General Principles

All code must prioritize:

- readability
- maintainability
- consistency
- simplicity

Prefer:

- clear naming
- small functions
- explicit logic

Avoid:

- unnecessary abstractions
- deep nesting
- overly clever code

Readable code is more important than short code.

---

# 2. Naming Conventions

Use meaningful names.

GOOD

QueryExecutor
ConnectionManager
HistoryRepository

BAD

Manager
Helper
Util

Variables must describe their purpose.

GOOD

queryResult
connectionPool

BAD

data
temp
x

---

# 3. File Organization

Files should have a clear purpose.

Avoid large files.

Recommended limits:

Function length
< 40 lines

File size
< 400 lines

If a file grows too large, split it into modules.

---

# 4. Go Backend Style

All backend code must follow Go best practices.

---

## Formatting

Use standard Go formatting.

All code must pass:

go fmt
go vet

Imports must be grouped:

1. standard library
2. third-party packages
3. internal packages

Example:

import (
    "context"
    "database/sql"

    "github.com/wailsapp/wails/v2/pkg/runtime"

    "zentro/internal/query"
)

---

## Error Handling

Errors must always be handled explicitly.

GOOD

result, err := repo.Execute(query)
if err != nil {
    return err
}

BAD

result, _ := repo.Execute(query)

Do not ignore errors.

---

## Function Design

Functions must be:

- small
- focused
- single responsibility

GOOD

func ExecuteQuery(query string) error

BAD

func ExecuteQueryAndSaveHistoryAndLog()

---

## Struct Design

Structs should represent clear concepts.

GOOD

QueryService
QueryExecutor
QueryHistoryRepository

Avoid large "god structs".

---

## Interfaces

Use interfaces only when necessary.

GOOD

type QueryRepository interface {
    Execute(query string) error
}

BAD

Interfaces with only one implementation
without future extension.

---

# 5. Wails Integration Rules

Wails acts as the bridge between Go and the frontend.

Rules:

- keep UI logic in frontend
- backend handles business logic
- expose minimal API surface

GOOD

Frontend calls:

QueryService.Execute()

BAD

Frontend directly manages database logic.

---

# 6. React Frontend Style

All frontend code must use TypeScript.

Do not use plain JavaScript.

---

## Component Design

Components must be:

- small
- reusable
- focused

Prefer:

functional components

Example:

function QueryEditor() {
  return <Editor />
}

Avoid:

large monolithic components.

---

## State Management

State must be predictable.

Prefer:

- local state
- context
- lightweight stores

Avoid deeply nested state.

---

## File Naming

Use consistent naming.

Components

QueryEditor.tsx
ResultGrid.tsx

Hooks

useQueryExecution.ts
useConnection.ts

Utilities

formatQuery.ts

---

## Component Structure

Typical component structure:

imports
types
component
helper functions

Example:

import ...

type Props = { ... }

export function QueryEditor(props: Props) {
  ...
}

---

# 7. React Performance

Avoid unnecessary re-renders.

Use:

useMemo
useCallback

Only when necessary.

Do not prematurely optimize.

---

# 8. Styling

Prefer consistent styling approach.

Use:

- CSS modules
- Tailwind
- or centralized styling system

Avoid inline styles unless necessary.

---

# 9. Frontend–Backend Boundary

The frontend must never:

- directly access database logic
- contain business logic

Frontend responsibilities:

UI
state management
user interaction

Backend responsibilities:

query execution
data persistence
application logic

---

# 10. Code Quality Checklist

Before finalizing code:

Check:

- names are clear
- functions are small
- no duplicated logic
- errors are handled
- architecture rules are respected

Code must remain simple and maintainable.