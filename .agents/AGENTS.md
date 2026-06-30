# Project Domain Rules (Scoring Security & Architecture)

## Double-Check Security Principle
- **NEVER trust the Frontend exclusively.** Any business rule, validation, or point limits enforced on the frontend MUST have an exact equivalent validation on the Backend.
- **NEVER bypass Backend Validations** for speed. 

## Scoring & Criteria Validation Rules
1. **Cross-Semester Injection Prevention:** Always verify that the submitted `criteriaId` belongs to the currently active `criteria_version_id` associated with the `semester_id` of the scoring sheet.
2. **Leaf-Node Only Scoring:** Do NOT allow scoring directly on parent/group criteria. Validate that the targeted criteria has NO children before accepting points.
3. **Evidence Enforcement:** If a criterion has `require_evidence === 1`, the backend MUST throw a `BadRequestException` if `proofUrl` is empty or missing. The frontend MUST display a mandatory warning (e.g., `*` and text) to the user.
4. **Mutual Exclusivity (Radio/Options):** For criteria belonging to a `RADIO` or `OPTIONS` parent, the backend MUST perform a sweep to delete any existing sibling scores in the same group when a new score is submitted (Check `enforceMutualExclusivity` in `scoring.service.ts`).

## Access Control & IDOR Prevention
- Always use `studentId` as the primary verification token.
- `verifyActorRole(actorId, studentId, role, semesterId)` MUST be called at the very beginning of any scoring-related API endpoint to ensure the `actorId` (from JWT) actually has the legitimate right to act as the specified `role` for that `studentId`.
- **Role Limits:** Only `STUDENT`, `CLASS_COMMITTEE`, and `ADVISOR` are allowed. Check `SCORING_PERMISSIONS` and `STATE_TRANSITIONS` for allowed states.

## Database & Prisma
- Always use `prisma.$transaction` when performing multiple read-writes for scoring (e.g., upserting `score_details` and `score_entries`, clearing sibling scores, calculating totals).

# Project Code Rules (Frontend, Backend, Database - Ponytail Philosophy)

For all code written in this project (Frontend components, Backend APIs, Database schemas/queries, etc.), strictly follow the **Ponytail (lazy senior dev) mode**:
1. **YAGNI:** Do not build it if it's not needed.
2. **Reuse:** If a query or helper already exists, reuse it. Don't rewrite it.
3. **Simplicity:** Can it be done in one line? Make it one line. The best code is the code never written.
4. **Deletion over addition:** Boring over clever. Fewest files possible.
5. **No unnecessary abstractions:** Do not create abstractions unless explicitly requested.
7. **Performance Optimization (Database queries):** Always combine sequential queries into a single `Promise.all` or use Prisma `include` to fetch relations concurrently. Avoid `await query1; await query2;` as it multiplies round-trip latency, particularly on serverless databases like Neon.

# Dynamic UI & Database Integrity

## Dynamic Frontend Rendering
- The frontend `ScoringForm.tsx` is completely data-driven. It renders a criterion as a parent (collapsible with sub-criteria) *if and only if* it detects child nodes in the database.
- Do not hardcode specific criteria IDs (like `1.1.2`) in the frontend logic. Always manage UI behavior by modifying the Database structure (e.g., adding sub-criteria and setting `score_type` to `OPTIONS` or `RADIO` for parents).

## Mutual Exclusivity at Database Level
- The `enforceMutualExclusivity` check in `scoring.service.ts` works in tandem with the dynamic frontend. If a parent node is marked as `OPTIONS`, the backend will forcefully clear any existing score on sibling nodes when a new score is saved.
- This creates an un-bypassable double-check mechanism where the database serves as the ultimate source of truth, immune to frontend manipulation.