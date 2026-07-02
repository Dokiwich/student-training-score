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

### 8. Criteria Versions & Template Strategy
- **Rule**: Criteria versions are no longer strictly bound to a single semester. A `criteria_version` can act as a standalone template (where `semester_id` is null). 
- **Implementation**: The schema supports `semester_id String?`. When a new semester needs criteria, it can clone an existing template instead of referencing a shared template directly.

### 9. API Best Practices
- **Rule**: All state-mutating endpoints (e.g., submit, edit, update status) must strictly use the `POST` method (or `PUT`/`PATCH`), not `GET`.
- **Rule**: Standardize `try-catch` blocks globally. Catch errors safely and log them contextually.

### 10. Database Stack
- **Stack**: The project utilizes **PostgreSQL** configured via **Prisma ORM**.

### 11. Known UI Progress Bar Bug (Stepper)
- **Bug**: Previously, if a scoring sheet advanced to the `SCHOOL_REVIEWING` status, the frontend stepper (in `ScoringForm.tsx`) fell back to `-1` and incorrectly highlighted the "DRAFT" step because the `SCHOOL_REVIEWING` status was missing from the stepper mapping logic.
- **Fix**: Always ensure ALL valid backend workflow statuses (e.g. `SCHOOL_REVIEWING`, `SCHOOL_APPROVED`) are mapped to the final `APPROVED` visual step so the UI accurately locks and displays completion.

### 12. Semester ID Formatting
- **Standard**: Instead of using random UUIDs for semesters, use deterministic identifiers to improve debugging, formatted as `sem_HKx_yyyy_yyyy` (e.g. `sem_HK2_2025_2026`).

### 13. Environment Variable Architecture
- **Rule**: Avoid scattered `.env` files across monorepo packages. Use a Single Source of Truth at the root.
- **Implementation**: The root `.env` (`D:\duan\.env`) is injected into child workspaces using `dotenv-cli` via root `package.json` scripts (e.g., `"dev:api": "dotenv -e .env -- npm run start:dev --workspace=@student-score/api"`). This ensures NextJS, NestJS, and Prisma always read the exact same credentials, avoiding tricky 400 Bad Request out-of-sync bugs.

### 14. The Ponytail Rule (Native over Boilerplate)
- **Rule**: Deletion over addition. If the standard library can do it, do not install a new dependency.
- **Implementation**: For example, when sending emails via the Maileroo API, we removed the 15-dependency `maileroo` SDK (which pulled in `axios` and `form-data`) and replaced it with a 15-line native `fetch` + `FormData` implementation in `auth.service.ts`. Always prefer standard Web APIs over heavy wrapper SDKs.

### 15. Accidental Dependency Tampering (node_modules Find-and-Replace)
- **Bug**: Global Find-and-Replace in the IDE can inadvertently alter code inside `node_modules` if the search scope is not correctly restricted. For example, replacing `can` with `npmcan` caused `@nestjs/core/guards/guards-consumer.js` to change `guard.canActivate` to `guard.npmcanActivate`, resulting in an unhandled `TypeError` that threw a generic `500 Internal server error` across all API endpoints guarded by `JwtAuthGuard`.
- **Fix**: Reinstall `node_modules` or correct the specific typo in the dependency file. Always ensure your IDE excludes `node_modules` and `.next` when performing mass replacements.

## How to use this skill
When debugging issues related to data integrity, F5 bugs, scoring totals, or cache issues in the Dokiwich project, consult the `examples/known_bugs.md` file in this directory to see how similar problems were resolved in the past.
