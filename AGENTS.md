# Agent Workflow

Use this workflow when assigned one or more GitHub issues.

## 1. Intake

- Read assigned issue(s) fully.
- Inspect current branch, git status, and recent commits.
- Confirm issue scope before editing.
- Identify exact files likely to change.
- If issue conflicts with another active workstream, stop and ask.

## 2. Branch + Worktree Discipline

- Work only in assigned worktree/branch.
- Branch name format: `agent/issue-<number>-short-slug` or `agent/issues-<numbers>-short-slug`.
- Do not modify unrelated files.
- Do not revert user or other-agent changes.
- Keep commits scoped to assigned issue(s).

## 3. Implementation

- Make minimal changes that satisfy acceptance criteria.
- Prefer existing patterns.
- Avoid speculative refactors.
- Preserve domain language from `CONTEXT.md`: Booker, Booking, Booking Communication.
- Before changing the core tour booking flow, read `docs/tour-booking-flow.html`. If your code changes Checkout Attempt, Booking, Stripe Checkout, webhook, refund, cancellation, capacity-race, or Booking Communication behavior, update that HTML doc in the same change.
- If new behavior needs cross-workstream dependency, isolate behind a small seam or note the blocker.

## 4. Verification

Use Bun for checks when available:

- `bun run typecheck`
- `bun test` if tests exist or the issue adds tests
- `bun run build` if route, server, config, or deployment behavior changes

If a check cannot run, document the exact reason in the PR.

## 5. Commit

- Inspect `git status` and `git diff`.
- Stage only intended files.
- Commit with a concise message, for example:
  - `Add shared booking validation schema`
  - `Polish booking communication email`
  - `Add Convex booking persistence`
  - `Cover booking validation behavior`

## 6. Pull Request

Create a PR when implementation and verification are complete.

PR title:

- `Issue #<number>: <issue title>`
- For multiple issues: `Issues #<n>, #<n>: <short summary>`

PR body must include:

- Issues closed: `Closes #<number>`
- Summary of changes
- Verification commands and results
- Risks or assumptions
- Follow-ups, if any

PR body must be written as readable GitHub-flavored Markdown, not escaped text. Use real newlines, headings, and bullet lists.

Required structure:

```md
## Summary

- Briefly describe the main changes.
- Keep bullets specific and user-readable.

## Verification

- `bun run typecheck` - pass
- `bun test` - pass

## Risks or Assumptions

- Note any relevant risk, assumption, or `None`.

## Follow-ups

- Note any follow-up work or `None`.

Closes #<number>
```

Rules:

- Do not include literal escaped newline sequences like `\n`.
- Do not pass a single quoted string with embedded `\n` as the PR body.
- Prefer writing the body from a Markdown file or heredoc so GitHub renders headings and lists correctly.
- Include command results, not just command names.

## 7. Final Handoff

After PR publish, report:

- PR URL
- Issues covered
- Verification status
- Any blocked items or follow-up issues needed

## Parallel Workstream Guidance

Assign issue groups with low overlap:

- Email: #4
- Convex foundation: #3, #5
- Convex persistence/read: #6, #7 after #5 or same agent
- Testing: #8, #9 after #3 ideally
