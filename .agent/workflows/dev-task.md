---
description: Optimized multi-model development workflow
---

@model gemini-3-flash

STEP 1 — TASK NORMALIZATION

Read the user request.

Summarize the request in <= 120 tokens.

Extract:

goal

constraints

affected modules

Output a concise problem statement.

@model claude-sonnet-4.6

STEP 2 — IMPLEMENTATION PLANNING

Analyze the summarized task.

Identify:

architecture impact

modules involved

dependencies

Produce a structured plan:

Plan format:

Overview

Technical approach

Task breakdown

Files to modify

Edge cases

Limit response to <= 400 tokens.

@model gemini-3.1-pro-low

STEP 3 — IMPLEMENTATION

Execute the plan step-by-step.

Modify only necessary files.

Avoid unnecessary explanations.

Keep output concise.

Implementation rules:

prefer minimal diff

follow existing code style

avoid introducing new dependencies

maintain backward compatibility

@model gemini-3.1-pro-high

STEP 4 — COMPLEX LOGIC HANDLING

Only run this step if:

algorithmic complexity exists

large refactor is required

performance optimization is needed

Tasks:

Refactor logic

Improve structure

Ensure performance

@model gpt-oss-120b

STEP 5 — CODE REVIEW

Perform a strict review:

Check for:

bugs

race conditions

edge cases

security issues

performance regressions

Output format:

Issues found

Suggested fixes

Risk level

Keep response <= 250 tokens.

@model gemini-3-flash

STEP 6 — FINAL SUMMARY

Summarize the changes.

Produce:

modified files

key changes

next steps

Limit to <= 100 tokens.