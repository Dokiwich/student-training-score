# Dokiwich Known Bugs and Solutions

This file documents historical bugs encountered and their corresponding solutions in this project. Reference this file when encountering similar symptoms.

### 1. Data Loss on Deletion (Cascade Errors)
- **Symptom**: Admin attempts to delete a parent criteria (e.g. `1`), and the system throws a Foreign Key constraint error, or leaves orphaned child criteria (`1.1`, `1.2`).
- **Solution**: The database schema must define `onDelete: Cascade` in `schema.prisma`. We updated `@relation(fields: [parent_id], references: [id], onDelete: Cascade)`. Also added a trigger-like logic in the controller/service to proactively delete children if manual deletion is required.

### 2. Live Data Corruption (Version Management)
- **Symptom**: Admin edits a criteria's score/name while a semester is active, causing past or current student scores to recalculate incorrectly.
- **Solution**: Implemented a "Double Check" backend block. `scoring.service.ts` now checks `prisma.score_details.count({ where: { criteria_id } })`. If `count > 0`, the deletion or major structural edit is blocked to protect historical data. (Ideally, a Versioned Tables approach is best).

### 3. Infinite Deductions (Negative Category Totals)
- **Symptom**: A student has multiple deductions (e.g. -5, -10, -20) in a category with a max limit of 15. The total category score becomes `-35` instead of floor `0`.
- **Solution**: Both Frontend (`ScoringForm.tsx`) and Backend (`scoring.service.ts`) must enforce `Math.max(0, categorySum)` when aggregating leaf nodes into parent categories.

### 4. Idempotency & F5 Bugs (Duplicate Scores)
- **Symptom**: If a student clicks submit twice quickly, or refreshes the page on submit, their score is submitted twice, or the system throws race condition errors.
- **Solution**: 
  - Scoring: Replaced `create` with `upsert` in Prisma for `score_entries`. Added a unique constraint `@@unique([score_detail_id, scorer_role])` to enforce one role-score per criteria.
  - Submitting Form: Used Optimistic Locking `updateMany({ where: { id: formId, status: 'DRAFT' }, data: { status: 'SUBMITTED' } })`. If `count === 0`, it means it was already submitted.

### 5. Stale Data Caching (Next.js aggressively caching)
- **Symptom**: `GET /api/semester/active` keeps returning the old semester even after Admin changes the active semester in DB.
- **Solution**: Next.js caches API routes by default. Added `export const dynamic = 'force-dynamic'` to the top of `route.ts`.

### 6. "Un-checking" Checkboxes Fails to Save (Clear Input Bug)
- **Symptom**: A user clears an input or unchecks an option. The frontend state (`valStr === ''`) is skipped during saving, causing the backend to retain the old value (database is not updated).
- **Solution**: Created a new `DELETE /:formId/delete-criteria` endpoint. In `ScoringForm.tsx`, when `valStr === ''` is detected for a previously saved item, it explicitly calls the DELETE API to wipe the `score_entries` record.

### 7. Bulk Import Fails for Class Transfers
- **Symptom**: When Admin bulk-imports students to update their classes for a new semester, the system rejects rows with `MSSV đã tồn tại`.
- **Context**: In this university's domain, **MSSV is permanently tied to a class**. If a student transfers to a new class, they are given a completely new MSSV and Email. Thus, rejecting duplicates is actually the CORRECT behavior to prevent data corruption. No "Upsert" fix was required.
