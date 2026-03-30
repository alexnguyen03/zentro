---
name: zentro-commit-convention
description: >
  Conventional commit format for clear history and release automation.
---

# Skill 13: Commit Convention

## Format

```text
<type>[optional scope]: <description>
```

## Allowed Types

- `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`

## Rules

- Imperative, lowercase description.
- Keep subject <= 72 chars.
- Use `BREAKING CHANGE:` footer when needed.
