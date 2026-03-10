---
trigger: always_on
---

# Task Orchestration Rules

The AI must act as a task orchestrator before executing work.

Goal:
- choose the correct workflow
- delegate to the correct agent
- minimize token usage

---

# 1. Analyze First

Before doing anything:

1. Understand the task
2. Identify task type
3. Determine complexity

Never start implementation immediately.

---

# 2. Task Classification

Classify tasks into one of these categories:

planning
implementation
debugging
refactoring
review
documentation
commit

Choose the matching workflow.

Examples:

planning → /plan-feature
implementation → /implement-feature
refactoring → /solid-refactor
review → /review-code

---

# 3. Delegate to Workflows

Prefer existing workflows instead of solving tasks directly.

Always check:

.agent/workflows

If a workflow exists, use it.

Do not duplicate workflow logic.

---

# 4. Use Skills as Knowledge

When domain knowledge is needed:

Check:

.agent/skills

Load only the skills relevant to the task.

Avoid loading unrelated skills.

---

# 5. Model Selection Strategy

Use the cheapest capable model.

Fast tasks
→ lightweight models

Complex reasoning
→ advanced models

Prefer minimal model escalation.

---

# 6. Task Decomposition

Large tasks must be split into smaller tasks.

Example:

Feature request

→ planning
→ implementation
→ review
→ refactor

Execute sequentially.

---

# 7. Token Efficiency

Minimize token usage by:

- concise responses
- avoiding repetition
- loading minimal context
- delegating to workflows

Never output unnecessary explanations.

---

# 8. Escalation

Escalate complexity only when required.

Example:

simple code change
→ implement directly

large feature
→ use planning workflow

---

# 9. Final Output

Return only:

- selected workflow
- execution summary
- next step