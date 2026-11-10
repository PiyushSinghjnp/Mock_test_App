# Project Instructions

## 1. ECC Skills

For every task, identify relevant ECC skills by inspecting their names and descriptions first.

- Select the most relevant skill or smallest combination of skills.
- Read the complete `SKILL.md` only for selected skills.
- Follow the selected skill workflows while preserving existing project conventions.
- Do not load unrelated skills or invoke unnecessary agents.
- Prefer direct implementation for straightforward tasks.
- Use specialized agents only when task complexity justifies their additional overhead.

Prefer relevant ECC skills for:
- Architecture and code design
- Framework conventions
- Testing and verification
- Security reviews
- Database changes and migrations
- Frontend accessibility and performance
- Deployment and operational changes

## 2. Working Process

Before making changes:

1. Read relevant project instructions.
2. Inspect the existing project structure and locate relevant files.
3. Identify and select the necessary ECC skills.
4. Read the selected skills' `SKILL.md` instructions completely.
5. Understand the existing implementation and dependencies.
6. Make the smallest safe change needed.
7. Run appropriate tests, checks, and verification commands.
8. Report what changed and any verification that could not be completed.

When multiple skills apply, use the smallest set that fully covers the task and follow them in a sensible order.

Do not modify unrelated files or discard existing user changes.

## 3. Token-Efficient File Exploration

- Search for relevant files before reading their contents.
- Inspect only files necessary for the requested task.
- Do not scan the entire repository unless genuinely required.
- Avoid repeatedly reading unchanged files.
- Reuse previously established findings and project context.
- Prefer targeted searches and concise tool outputs.
- Avoid large file dumps unless the complete content is necessary.
- Reuse existing architecture, components, utilities, and patterns.

## 4. Efficient Implementation

- Make minimal, focused, and maintainable changes.
- Avoid unnecessary refactoring, abstractions, and dependencies.
- Do not rewrite working modules without a clear reason.
- Avoid duplicate implementations or conflicting state.
- Preserve existing functionality and backward compatibility where required.
- For complex tasks, create a concise implementation plan.
- For simple tasks, proceed directly without excessive planning.
- Do not sacrifice code quality to reduce token usage.

## 5. Mock-Test Application Safety

When modifying the mock-test application:

- Preserve existing question rendering and option selection behavior.
- Protect answer submission, scoring, explanations, and result calculations.
- Maintain existing timer, navigation, and progress tracking functionality where implemented.
- Avoid introducing duplicate state or conflicting business logic.
- Verify related functionality after changes.
- Do not modify unrelated mock-test features.

## 6. Testing and Verification

- Run targeted tests for modified functionality first.
- Run broader tests when changes affect shared modules or integrations.
- Include relevant security, regression, and correctness checks.
- Never skip essential verification merely to save tokens.
- Do not claim tests passed unless they actually ran.
- Clearly report failed tests and verification limitations.

## 7. Context and Token Management

- Minimize redundant reasoning, repeated explanations, and unnecessary tool calls.
- Do not repeatedly explore code or architecture already understood.
- Use ECC `strategic-compact` guidance when relevant and available.
- Recommend context compaction at natural task boundaries when useful.
- Never compact in the middle of an active dependent implementation or debugging step.
- Before compaction, preserve:
  - Important architectural decisions
  - Files changed
  - Implementation progress
  - Tests executed and results
  - Remaining tasks and unresolved issues
- Do not create unnecessary summaries after every small action.

## 8. Communication and Reporting

- Keep responses concise, clear, and technically accurate.
- Avoid lengthy progress explanations and repeated information.
- Explain important technical decisions and failures.
- Do not repeat large source files unnecessarily.
- At task completion, briefly report:
  - What changed
  - Files modified
  - Tests and verification results
  - Remaining issues, if any

## 9. Core Principles

- Optimize unnecessary work, not essential work.
- Correctness, security, and maintainability take priority over token savings.
- Use ECC selectively and efficiently.
- Preserve existing project behavior.
- Avoid unnecessary tool calls, excessive agents, and redundant file inspection.
- Complete the requested task with the least unnecessary overhead while maintaining production-quality results.