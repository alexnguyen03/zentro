---
trigger: always_on
---

# Commit Convention Rules

All commits generated for this repository MUST follow the Conventional Commits specification.

Reference format:

<type>(optional-scope): <short description>

Example:

feat(query): add query history support
fix(connection): handle reconnect logic
refactor(history): separate storage from service
docs(readme): update installation guide

---

# 1. Commit Message Structure

Each commit must follow this structure:

type(scope): short summary

optional body

optional footer

Example:

feat(history): add query history persistence

Adds SQLite-backed query history storage.
History entries are now stored and can be retrieved by the CLI.

---

# 2. Commit Types

Allowed commit types:

feat
A new feature.

fix
A bug fix.

refactor
Code change that neither fixes a bug nor adds a feature.

perf
Performance improvement.

docs
Documentation changes.

style
Code style changes (formatting, whitespace).

test
Adding or updating tests.

build
Build system or dependency changes.

ci
CI/CD related changes.

chore
Maintenance work.

---

# 3. Scope Rules

Scope describes the module affected.

Examples for this project:

connection
query
history
editor
ui
settings
logging
build
core

Example:

feat(connection): add connection pool support
fix(editor): resolve tab focus issue

Scope should be short and meaningful.

---

# 4. Commit Summary Rules

The summary must:

- be concise
- use imperative mood
- start with lowercase
- not exceed 72 characters

GOOD

feat(history): add query history persistence

BAD

Added history persistence
Fixing bug in history logic

---

# 5. Commit Body (Optional)

The body explains WHY the change was made.

Use when:

- logic is complex
- architecture changes
- breaking changes

Example:

refactor(query): split executor and validator

The previous implementation mixed validation and execution
logic in the same component. This refactor separates concerns
to improve maintainability.

---

# 6. Breaking Changes

Breaking changes must include:

BREAKING CHANGE:

Example:

feat(api): redesign query response format

BREAKING CHANGE:
Query result format has changed.
Clients must update parsing logic.

---

# 7. Commit Granularity

Each commit should represent **one logical change**.

Avoid:

- mixing refactor + feature
- large unrelated commits

GOOD

feat(history): add history repository
feat(history): add CLI history command

BAD

feat: history feature + UI changes + refactor

---

# 8. Automatic Commit Generation

When AI generates commits, it must:

1. detect the primary change type
2. assign an appropriate scope
3. generate a concise summary
4. include body when needed

Example AI commit:

feat(query): add async query execution

Implements non-blocking query execution
to prevent UI freezing when running long queries.

---

# 9. Commit Quality Checklist

Before committing, verify:

- commit type is correct
- scope is accurate
- summary is concise
- commit contains only related changes

High quality commits improve maintainability
and project history readability.