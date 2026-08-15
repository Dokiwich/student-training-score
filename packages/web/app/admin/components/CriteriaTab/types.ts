// Shared types for CriteriaTab components.
// These mirror the Prisma schema and API response shapes.
// Do NOT add fields that don't exist in the database.

// --- Selection ---

export type CriteriaItemType = 'category' | 'criterion';

export interface CriteriaSelection {
  type: CriteriaItemType;
  id: string | number;
}

// --- Database models ---

export type CriteriaScoreType = 'RANGE' | 'OPTIONS' | 'BOOLEAN' | 'DEDUCTION' | 'FIXED';

export interface Criterion {
  id: number;
  code: string;
  content: string;
  point: number;
  score: number;               // min_score in DB
  score_type: CriteriaScoreType;
  score_options: number[] | null;
  require_evidence: number;    // 0 | 1
  evidence_guide: string | null;
  parent_id: number | null;
  category_id: string;
  sort_order: number;
  is_active: number;           // 0 | 1
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  criteria_version_id: string;
  code: string;
  name: string;
  description: string | null;
  max_score: number;
  sort_order: number;
  created_at: string;
}

export interface CriteriaVersion {
  id: string;
  semester_id: string | null;
  name: string | null;
  description: string | null;
  version: number;
  is_active: number;           // 0 | 1
  applied_at: string | null;
  created_at: string;
  semesters?: {
    name: string;
    code: string;
    status?: string;
  } | null;
  totalCategories?: number;
  isLocked?: boolean;
  lockedReason?: string | null;
}

// --- API Payloads (only fields the API actually handles) ---

export interface CreateCategoryPayload {
  _type: 'category';
  code: string;
  name: string;
  max_score: string;
  criteria_version_id: string;
}

export interface UpdateCategoryPayload {
  _type: 'category';
  id: string;
  code: string;
  name: string;
  max_score: string;
}

export interface CreateCriterionPayload {
  code: string;
  content: string;
  point: string;
  parent_id: number | null;
  category_id: string;
  evidence_guide?: string | null;
}

export interface UpdateCriterionPayload {
  id: number;
  code: string;
  content: string;
  point: string;
  category_id: string;
  parent_id: number | null;
  evidence_guide?: string | null;
}

export interface DeleteCategoryPayload {
  _type: 'category';
  id: string;
}

export interface DeleteCriterionPayload {
  id: number;
}

export interface ToggleVersionPayload {
  _type: 'version';
  id: string;
  is_active: number;
}

// --- Helpers ---

/** Build a set of all criteria IDs for orphan detection */
export function buildCriteriaIdSet(criteria: Criterion[]): Set<number> {
  return new Set(criteria.map(c => c.id));
}

/** A criterion is a root item if it has no parent_id or its parent doesn't exist */
export function isRootCriterion(c: Criterion, criteriaIds: Set<number>): boolean {
  return !c.parent_id || !criteriaIds.has(c.parent_id);
}

/** A criterion is an orphan if it has a parent_id but that parent doesn't exist */
export function isOrphanCriterion(c: Criterion, criteriaIds: Set<number>): boolean {
  return !!c.parent_id && !criteriaIds.has(c.parent_id);
}
