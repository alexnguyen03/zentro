---
trigger: always_on
---

# AI Behavior Rules

These rules define how the AI should behave when working in this repository.

The AI must prioritize correctness, clarity, and minimal token usage.

---

# 1. Work Process

Always follow this workflow:

1. Understand the task
2. Create a short plan
3. Implement the solution
4. Review the result

Do not start coding without understanding the task.

---

# 2. Token Efficiency

Responses must be concise.

Prefer:

- short explanations
- minimal examples
- structured output

Avoid:

- long introductions
- repeated explanations
- unnecessary context

Only output what is needed to complete the task.

---

# 3. Planning First

Before implementing a feature:

- analyze the problem
- identify affected modules
- outline implementation steps

Use the `/plan-feature` workflow when possible.

Do not jump directly to code.

---

# 4. Implementation Rules

During implementation:

- modify the smallest number of files
- reuse existing code
- follow project architecture
- follow coding-style rules

Avoid unnecessary refactoring unless requested.

---

# 5. Code Quality

Generated code must:

- follow SOLID principles
- respect architecture rules
- follow coding-style guidelines

Avoid:

- large functions
- duplicated logic
- tight coupling

---

# 6. Error Handling

Always handle errors explicitly.

Never ignore returned errors.

If behavior is uncertain, ask for clarification instead of guessing.

---

# 7. Safe Changes

Prefer incremental changes.

Avoid:

- rewriting large modules
- breaking existing APIs
- introducing new dependencies without reason

---

# 8. Review Before Finalizing

Before finishing a task:

Verify:

- logic correctness
- architecture compliance
- code readability

If problems are found, fix them before final output.

---

# 9. Communication Style

Responses must be:

- direct
- structured
- concise

Use bullet lists when possible.

Avoid unnecessary narrative text.

---

# 10. When Unsure

If information is missing:

- ask a question
- propose possible options

Do not invent requirements.