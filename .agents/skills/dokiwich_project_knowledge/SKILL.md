---
name: dokiwich-project-knowledge
description: Core architectural rules, constraints, and past bugs for the Dokiwich Student Scoring project.
---

# Dokiwich Student Scoring System Knowledge Base

## Core Architecture and Rules

### 1. Version Management (Drafts vs Published)
- **Rule**: Avoid changing criteria structures (adding/deleting criteria) while a semester is active and scores are being recorded.
- **Implementation**: The system favors a "Two-Table" or "Locking" approach. Either criteria are cloned per semester, or they are locked from deletion if they have active `score_details` references.
- **Reference**: To delete a criteria/category, the backend must verify `score_details` count. If >0, deletion is blocked (preventing orphaned score entries).

### 2. Idempotency and Concurrency (The F5 Problem)
- **Rule**: All scoring submission APIs must be strictly idempotent. Hitting F5 or clicking submit multiple times must not inflate scores or duplicate records.
- **Implementation**: Use Prisma's `upsert` with compound unique keys (e.g., `@@unique([score_detail_id, scorer_role])` in `score_entries`).
- **Implementation**: Use "Optimistic Locking" when submitting forms (e.g., check `status === 'DRAFT'` before transitioning to `SUBMITTED`) using Prisma's `updateMany` where `status = 'DRAFT'`.

### 3. Data Integrity & Constraints
- **Rule**: Category score totals must never drop below 0.
- **Implementation**: Apply `Math.max(0, sum)` bounds at BOTH the frontend calculation level and the backend persistence level.
- **Rule**: Deleting a parent item (category) should conceptually remove its children. Prisma relations should handle this via `onDelete: Cascade`.

### 4. Next.js Caching
- **Rule**: Dynamic API endpoints (like `GET /api/semester/active`) must explicitly opt-out of Next.js aggressive static caching.
- **Implementation**: Add `export const dynamic = 'force-dynamic'` at the top of the route file.

### 5. Transaction Atomicity
- **Rule**: Any operation that modifies multiple tables (e.g. `score_details`, `score_entries`, `audit_logs`) MUST be wrapped in a database transaction to prevent torn state on failure.
- **Implementation**: Use `await prisma.$transaction(async (tx) => { ... })`. Ensure helper functions like `logAudit` accept `tx` and execute within the transaction context.

### 6. Security (IDOR & Auditing)
- **Rule**: Never trust client-provided IDs. Always verify that the session user has ownership of the requested `formId`.
- **Implementation**: Use `verifyActorRole` and check `scoring_sheets.user_id === session.userId`.
- **Rule**: All sensitive administrative actions and scoring adjustments must be logged.
- **Implementation**: Use `lib/audit.ts` functions (`logAudit`, `logAdminAction`) to persist changes to `audit_logs` and `review_actions` tables. Mask sensitive data like passwords (`***`) in the logs.

### 7. Administrative Overrides (Demotion Lock)
- **Rule**: If an admin manually alters a student's classification (e.g. due to disciplinary action), the system must not auto-revert it when scores change.
- **Implementation**: Override the `classification` property AND force the sheet status to `FINALIZED`. Since `FINALIZED` sheets cannot be edited, the demotion remains locked.

## How to use this skill
When debugging issues related to data integrity, F5 bugs, scoring totals, or cache issues in the Dokiwich project, consult the `examples/known_bugs.md` file in this directory to see how similar problems were resolved in the past.
