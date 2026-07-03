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

### 8. Transaction Atomicity (Data Torn/Partial Writes)
- **Symptom**: If the server crashes, power is lost, or a network error occurs halfway through saving a student's score, the `score_entries` might be written but `audit_logs` is not, causing a torn state.
- **Solution**: Wrap all state-changing API operations (Save Score, Delete Score, Submit Form, Reject Form) in `prisma.$transaction`. Ensure helper functions (like `logAudit`) accept a `tx` parameter so they run inside the same transaction block.

### 9. IDOR (Insecure Direct Object Reference) Prevention
- **Symptom**: A student tries to modify another student's score by intercepting the network request and changing `formId` or `detailId`.
- **Solution**: Strictly enforce ownership in backend APIs. Use `verifyActorRole` to ensure that if the role is `STUDENT`, the `scoring_sheets.user_id` matches the session's User ID.

### 10. Disciplinary Demotion Lock (Hạ Bậc Kỷ Luật)
- **Symptom**: An Admin demotes a student (e.g., from EXCELLENT to AVERAGE due to discipline). Later, an advisor adjusts a score and the system recalculates the totals, reverting the student back to EXCELLENT.
- **Solution**: When Admin demotes a student, the system overrides `classification` AND forces the `status` to `FINALIZED`. Because `FINALIZED` forms cannot be edited by students or advisors, the demotion is locked in place permanently.

### 11. IDE Syntax Parsing Error (Optional Catch Binding)
- **Symptom**: VS Code's Problems panel throws cascading errors like `'try' expected` and `'catch' or 'finally' expected` inside valid `try-catch` blocks, even though `npm run build` succeeds perfectly.
- **Context**: The code used ES2019's Optional Catch Binding (`catch { ... }` without an error variable). Older IDE Language Server configurations might fail to parse this, treating the `{` as an error variable and breaking the entire file's AST.
- **Solution**: Explicitly define the error variable as `catch (e) { ... }` across all API routes (`apply-criteria`, `active`, `users`, `classes`, etc.) to guarantee IDE compatibility and suppress false-positive errors.

### 12. HTTP Semantics Mismatch (Logout All)
- **Symptom**: The "Logout All Devices" feature failed to work because the API route was defined as `GET` while the frontend was correctly dispatching a `POST` request (since it mutates database state).
- **Solution**: Always ensure state-modifying API endpoints (`app/api/auth/logout-all/route.ts`) are explicitly defined as `POST` to adhere strictly to HTTP conventions and sync with frontend implementations.

### 13. Database N+1 Queries (Latency / Cold Start)
- **Symptom**: Fetching data sequentially using multiple `await prisma...` caused significant delays (up to several seconds) due to multiplied network round-trips and Neon DB cold starts.
- **Solution**: Apply the "Ponytail Performance" rule: Always combine sequential queries into a single `Promise.all` or use Prisma `include` to fetch relations (like users, enrollments, classes, departments) concurrently in a single query.

### 14. Dynamic Frontend Rendering / Parent missing sub-criteria
- **Symptom**: The frontend failed to render sub-criteria for a parent (e.g. `1.1.2 Kết quả học tập`) and instead showed a single input field. This occurred because the database lacked the child criteria records and instead had a single row with `score_options = [0,1,2,3,4,5]`.
- **Solution**: The frontend is strictly data-driven based on `parentIds`. To fix UI rendering, do NOT hardcode the frontend. Instead, insert child criteria in the DB (e.g. 1.1.2.a, 1.1.2.b) and set the parent's `score_type` to `OPTIONS` or `RADIO`. The frontend will dynamically adapt, and the backend's `enforceMutualExclusivity` will automatically prevent users from selecting multiple siblings.
