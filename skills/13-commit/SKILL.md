---
name: Standardize Git Commit Messages
description: Applies Conventional Commits structure to all project commits on Windows environments.
---

# Skill: Standardize Git Commit Messages using Conventional Commits (Windows)

## Objective
Ensure all commit messages adhere to the **Conventional Commits v1.0.0** specification in order to:
- Enable automated changelog generation
- Support semantic versioning (SemVer)
- Improve readability and searchability of commit history

Official source: https://www.conventionalcommits.org/en/v1.0.0/

## Commit Message Structure

```
<type>[optional scope]: <short description>

[optional body – detailed explanation if required]

[optional footer(s)]
```

### Allowed Types (must be lowercase)
- `feat`       : introduces a new feature
- `fix`        : resolves a bug
- `docs`       : documentation-only changes (README, comments, API docs)
- `style`      : code formatting changes (no logic impact)
- `refactor`   : code restructuring without fixing bugs or adding features
- `perf`       : performance improvements
- `test`       : adding or correcting tests
- `build`      : changes affecting build system or external dependencies
- `ci`         : changes to CI/CD configuration or scripts
- `chore`      : miscellaneous tasks (file renaming, formatting, removing dead code)
- `revert`     : reverts a previous commit

### Scope (optional)
Enclosed in parentheses, lowercase, meaningful context:
- `(auth)`, `(api)`, `(ui)`, `(core)`, `(config)`, `(deps)`, etc.

### Description Rules
- Use imperative mood: add, fix, update, remove, refactor…
- Do not capitalize the first letter
- Do not end with a period
- Keep subject line ≤ 72 characters (ideal: 50–60 characters)

### Breaking Changes
Indicate major API/contract breaks in the footer:
```
BREAKING CHANGE: <description of the breaking change>
```

## Valid Commit Message Examples

```text
feat(auth): add Google OAuth2 login flow

fix(api): prevent 500 error when query parameter is missing
Closes #JIRA-123

docs(readme): update installation instructions for Windows

refactor: extract payment validation logic to dedicated service

chore(deps): upgrade typescript from 4.9 to 5.2

feat!: remove legacy basic authentication endpoint
BREAKING CHANGE: basic auth support has been completely removed
```

## Recommended Implementation on Windows

### Windows-Specific Notes
- Prefer **PowerShell** or **Git Bash** over Command Prompt to avoid encoding issues
- Ensure configuration files (commitlint.config.js, .cz.toml, etc.) use **UTF-8** encoding
- In VS Code, set the integrated terminal to PowerShell or Git Bash by default

## Guidelines for Agent When Proposing or Correcting Commits
1. Always select a type from the approved list above
2. Begin description with an imperative verb (add, fix, update…)
3. Never capitalize the first letter of the description
4. Keep the subject line ≤ 72 characters
5. Include BREAKING CHANGE footer when appropriate
6. Prefer including a scope when the change is limited to a specific module
7. Default to `chore` or request clarification from the user if the commit type is unclear

Adhering to these conventions results in a clean, professional, and automation-friendly commit history.