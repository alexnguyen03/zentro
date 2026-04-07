# Zentro Project Instructions

Welcome to Zentro! Follow these guidelines strictly to minimize token usage and maximize feature effectiveness.

## Core Directives
- **Global Rules:** @.claude/rules.md
- **Architecture Overview:** @.claude/architecture.md
- **Code Style Preferences:** @.claude/code-style.md
- **Development Workflow:** @.claude/workflow.md
- **Debugging Strategy:** @.claude/debug.md

## Context Compaction
When context auto-compaction occurs, ALWAYS PRESERVE:
- The full list of modified files in the current task.
- The root cause of the current bug being fixed.
- The exact commands needed to run tests for the current feature.

## Available Skills (Slash Commands)
Check `@.claude/skills` for natively integrated commands. 
- `/fix-bug <description/code>`: Minimal diff-only bug fixes.
- `/refactor <description/code>`: Isolated refactoring without changing APIs.
- `/review <file/code>`: Bullet points review for bad practices.
- `/test <file/code>`: Generate edge-case testing.

## Available Subagents
Check `@.claude/agents` for specialized parallel sub-sessions.
- `security-reviewer`: Analyzes code for deep vulnerabilities (SQLi, XSS).
- `architecture-reviewer`: Audits layer boundaries and SOLID principles. 
*(Usage: "Ask the architecture-reviewer subagent to check my latest changes")*
