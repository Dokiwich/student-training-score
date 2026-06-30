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

# AI Tools Configuration

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.

## GitNexus — Code Intelligence

This project is indexed by GitNexus as **student-training-score** (998 symbols, 2157 relationships, 81 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

### Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

### Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

### Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/student-training-score/context` | Codebase overview, check index freshness |
| `gitnexus://repo/student-training-score/clusters` | All functional areas |
| `gitnexus://repo/student-training-score/processes` | All execution flows |
| `gitnexus://repo/student-training-score/process/{name}` | Step-by-step execution trace |

### CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |