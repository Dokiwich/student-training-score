# 🔍 BÁO CÁO KIỂM TRA TƯƠNG THÍCH: Backend ↔ Frontend ↔ Database

> **Ngày kiểm tra:** 2026-05-03  
> **Phạm vi:** Toàn bộ hệ thống chấm điểm rèn luyện sinh viên  
> **Kết quả tổng quan:** ⚠️ **Phát hiện 12 vấn đề lệch pha**

---

## 📊 TÓM TẮT NHANH

| Loại vấn đề | Nghiêm trọng | Trung bình | Nhẹ |
|---|:---:|:---:|:---:|
| Enum/Role lệch pha | 2 | 1 | - |
| Status mapping sai | 1 | 2 | - |
| Field name không khớp | - | 1 | 1 |
| Logic workflow mâu thuẫn | 2 | - | - |
| Dữ liệu thiếu/thừa | - | 1 | 1 |
| **Tổng** | **5** | **5** | **2** |

---

## 🔴 VẤN ĐỀ NGHIÊM TRỌNG (Cần sửa ngay)

---

### 1. ❌ Role `SUPER_ADMIN` tồn tại trong DB nhưng không dùng

| Layer | Giá trị |
|---|---|
| **Database** (`schema.prisma` L408-414) | `STUDENT`, `CLASS_COMMITTEE`, `ADVISOR`, `SCHOOL_ADMIN`, **`SUPER_ADMIN`** |
| **Backend** (`scoring.service.ts`) | `STUDENT`, `CLASS_COMMITTEE`, `ADVISOR` |
| **Frontend** (`UsersTab.tsx` L8) | `STUDENT`, `CLASS_COMMITTEE`, `ADVISOR`, `SCHOOL_ADMIN` |
| **Frontend** (`DashboardLayout.tsx` L9-15) | `STUDENT`, `CLASS_PRESIDENT`, `CLASS_COMMITTEE`, `ADVISOR`, `SCHOOL_ADMIN` |

**Vấn đề:**
- DB enum `users_role` vẫn chứa `SUPER_ADMIN` nhưng toàn bộ frontend và backend đã bỏ qua nó
- Nếu có user nào trong DB mang role `SUPER_ADMIN` sẽ không hiển thị đúng trong UI

**Khuyến nghị:** Xóa `SUPER_ADMIN` khỏi enum trong DB hoặc thêm migration để chuyển đổi.

---

### 2. ❌ Role `CLASS_PRESIDENT` vs `CLASS_COMMITTEE` — Hệ thống hai tên

| Layer | Giá trị sử dụng | Vị trí |
|---|---|---|
| **Database** | `CLASS_COMMITTEE` | `users_role` enum |
| **Backend Controller** | Nhận `CLASS_PRESIDENT` → chuyển sang `CLASS_COMMITTEE` | `scoring.controller.ts` L36-38, L49-51, L62-64 |
| **Backend Service** | Chỉ biết `CLASS_COMMITTEE` | `scoring.service.ts` L33, L51, L53 |
| **Frontend ScoringDashboard** | Gửi role `CLASS_PRESIDENT` | `ScoringDashboard.tsx` L38 |
| **Frontend ScoringForm** | Gửi role `CLASS_PRESIDENT` | `ScoringForm.tsx` L37-41 |
| **Frontend DashboardLayout** | Cả `CLASS_PRESIDENT` và `CLASS_COMMITTEE` | `DashboardLayout.tsx` L46, L194 |
| **Frontend UsersTab** | Hiển thị `CLASS_COMMITTEE` | `UsersTab.tsx` L8 |

**Vấn đề:**
- Frontend gửi `CLASS_PRESIDENT` → Backend Controller phải mapping lại → Service chỉ biết `CLASS_COMMITTEE`
- Nhưng `ScoringForm.tsx` L478 gửi `role: currentRole` (= `CLASS_PRESIDENT`) trong `body` của API call
- Backend Controller lấy role từ `req.user.role` (JWT), KHÔNG phải từ body → **role trong body bị bỏ qua**
- Nếu sau này ai đó dùng `role` từ body thay vì JWT, sẽ gặp lỗi logic

**Khuyến nghị:** Thống nhất sử dụng một tên duy nhất. Tốt nhất là `CLASS_COMMITTEE` theo DB, và mapping ở frontend trước khi gửi.

---

### 3. ❌ `formStatus` từ API vs Frontend sử dụng — LỆCH PHA NGHIÊM TRỌNG

**Backend** (`scoring.service.ts` L252-264) trả về `formStatus` đã được mapping đơn giản:
```
DRAFT         → 'DRAFT'
STUDENT_SUBMITTED → 'SUBMITTED'
CLASS_REVIEWING   → 'SUBMITTED'
CLASS_REVIEWED    → 'CLASS_APPROVED'
ADVISOR_APPROVED  → 'ADVISOR_APPROVED'
...
```

**Frontend** (`ScoringForm.tsx` L282-283) đọc:
```typescript
if (scoresData.sheetStatus) setFormStatus(scoresData.sheetStatus);
```

⚠️ **NHƯNG API trả về `formStatus`, KHÔNG phải `sheetStatus`!**

```typescript
// API response (scoring.service.ts L272):
return { formStatus, formStatusDetail: form.status, ... }
```

**Hậu quả:**
- `scoresData.sheetStatus` luôn là `undefined` → `formStatus` luôn giữ giá trị mặc định `'DRAFT'`
- ScoringForm **KHÔNG bao giờ** nhận đúng trạng thái phiếu từ server
- Phiếu đã submit vẫn hiển thị là DRAFT, cho phép chỉnh sửa khi lẽ ra phải lock

**Khuyến nghị:** Sửa `ScoringForm.tsx` L282:
```diff
- if (scoresData.sheetStatus) setFormStatus(scoresData.sheetStatus);
+ if (scoresData.formStatusDetail) setFormStatus(scoresData.formStatusDetail);
```
Hoặc dùng `formStatus` nếu muốn status đơn giản.

---

### 4. ❌ ADVISOR State Transition — Logic tự mâu thuẫn

**Backend** (`scoring.service.ts` L40-47):
```typescript
ADVISOR: {
  requiredStatus: WorkflowStatus.ADVISOR_APPROVED,  // ← Sai! Cần CLASS_APPROVED
  nextStatus: WorkflowStatus.ADVISOR_APPROVED,
  timestampField: 'advisor_approved_at',
  currentStep: 4,
  errorMessage: 'Cố vấn chỉ được chốt khi Lớp trưởng đã duyệt (CLASS_APPROVED)',
}
```

Rồi ở L58 lại fix:
```typescript
STATE_TRANSITIONS.ADVISOR.requiredStatus = WorkflowStatus.CLASS_APPROVED;
```

**Vấn đề:** Code hoạt động đúng nhờ L58, nhưng logic ban đầu bị viết sai. Nếu ai đó refactor bỏ L58 sẽ gây bug nghiêm trọng.

**Khuyến nghị:** Sửa trực tiếp trong object thay vì patch bên ngoài.

---

### 5. ❌ Workflow Rules (shared) vs Backend State Machine — HAI HỆ THỐNG SONG SONG

| Hệ thống | File | Chi tiết |
|---|---|---|
| **Shared WORKFLOW_RULES** | `workflow-states.ts` | 12 trạng thái, 12 hành động (`SUBMIT`, `APPROVE_CLASS`, `REJECT_CLASS`...) |
| **Backend STATE_TRANSITIONS** | `scoring.service.ts` | 4 trạng thái đơn giản (`DRAFT`, `SUBMITTED`, `CLASS_APPROVED`, `ADVISOR_APPROVED`) |

**Vấn đề:**
- `workflow.service.ts` dùng `WORKFLOW_RULES` từ shared package
- `scoring.service.ts` dùng `STATE_TRANSITIONS` riêng, hoàn toàn **KHÔNG** dùng shared package
- Hai hệ thống có thể cho ra kết quả khác nhau:
  - Shared: `STUDENT_SUBMITTED` → `START_CLASS_REVIEW` → `CLASS_REVIEWING` → `APPROVE_CLASS` → `CLASS_REVIEWED`
  - Backend: `STUDENT_SUBMITTED` → (direct) → `CLASS_REVIEWED` (bỏ qua `CLASS_REVIEWING`)

**Khuyến nghị:** Hợp nhất 2 hệ thống, ưu tiên dùng `WORKFLOW_RULES` từ shared.

---

## 🟡 VẤN ĐỀ TRUNG BÌNH (Nên sửa)

---

### 6. ⚠️ `scoring_sheets_status` enum thiếu `SCHOOL_REJECTED` trong Frontend

**Database** (`schema.prisma` L378-393):
```
DRAFT, STUDENT_SUBMITTED, CLASS_REVIEWING, CLASS_REVIEWED, CLASS_REJECTED,
ADVISOR_REVIEWING, ADVISOR_APPROVED, ADVISOR_REJECTED,
SCHOOL_REVIEWING, SCHOOL_APPROVED, SCHOOL_REJECTED, FINALIZED, APPEALING
```

**Frontend STATUS_MAP** (`ScoringDashboard.tsx` L24-35):
```
NO_SHEET, DRAFT, STUDENT_SUBMITTED, CLASS_REVIEWING, CLASS_REVIEWED, CLASS_REJECTED,
ADVISOR_REVIEWING, ADVISOR_APPROVED, ADVISOR_REJECTED, FINALIZED
```

**Thiếu trong Frontend:**
- ❌ `SCHOOL_REVIEWING`
- ❌ `SCHOOL_APPROVED`
- ❌ `SCHOOL_REJECTED`
- ❌ `APPEALING`

Nếu có phiếu ở trạng thái `SCHOOL_REVIEWING`, `SCHOOL_APPROVED`, `SCHOOL_REJECTED`, hoặc `APPEALING`, UI sẽ hiển thị status text thô.

---

### 7. ⚠️ `ScoringForm` STATUS_INFO thiếu status

**ScoringForm.tsx** (`L605-615`):
```
DRAFT, STUDENT_SUBMITTED, CLASS_REVIEWING, CLASS_REVIEWED, CLASS_REJECTED,
ADVISOR_REVIEWING, ADVISOR_REJECTED, ADVISOR_APPROVED, FINALIZED
```

**Thiếu:** `SCHOOL_REVIEWING`, `SCHOOL_APPROVED`, `SCHOOL_REJECTED`, `APPEALING`

---

### 8. ⚠️ `semesters_status` enum — Backend/Frontend mapping không khớp

**Database** (`schema.prisma` L425-433):
```
UPCOMING, STUDENT_SCORING, CLASS_REVIEWING, ADVISOR_REVIEWING, SCHOOL_REVIEWING, FINALIZED, LOCKED
```

**Frontend SemestersTab** (`L6`):
```
UPCOMING, STUDENT_SCORING, CLASS_REVIEWING, ADVISOR_REVIEWING, SCHOOL_REVIEWING, FINALIZED, LOCKED
```
✅ Khớp hoàn toàn.

---

### 9. ⚠️ `score_details.proof_url` — Backend dùng `proof_url`, Frontend gửi `proofUrl`

| Layer | Field name |
|---|---|
| **Database** | `proof_url` (snake_case) |
| **Backend** (`scoring.service.ts` L377, L423-425) | `proof_url` |
| **Frontend** (`ScoringForm.tsx` L478) | Gửi `proofUrl` trong JSON body |
| **Backend Controller** (`scoring.controller.ts` L33) | Nhận `@Body('proofUrl')` → pass vào service |

✅ Thực tế hoạt động đúng vì Controller nhận `proofUrl` rồi truyền vào service, service gán `proof_url`. Nhưng naming convention không thống nhất.

---

### 10. ⚠️ `score.schema.ts` validation — Không sử dụng thực tế

**Shared** package định nghĩa `SubmitScoreSchema` với validation:
- `studentScore` chỉ cho phép `0-100`, bội số `0.1`

**Nhưng:**
- Backend `scoring.controller.ts` KHÔNG import hay sử dụng schema này
- Frontend `ScoringForm.tsx` KHÔNG validate bằng schema này
- Database `score_details` dùng `Decimal(5,2)` (cho phép 2 chữ số thập phân), nhưng schema chỉ cho 1

**Vấn đề:** Schema viết rồi bỏ đó, không ai dùng.

---

## 🟢 VẤN ĐỀ NHẸ (Nên biết)

---

### 11. ℹ️ `class_roles_role_type` enum vs `users_role` enum

**Database:**
- `class_roles.role_type`: `MONITOR`, `VICE_MONITOR`, `SECRETARY`, `ADVISOR`
- `users.role`: `STUDENT`, `CLASS_COMMITTEE`, `ADVISOR`, `SCHOOL_ADMIN`, `SUPER_ADMIN`

**Nhận xét:** `ADVISOR` xuất hiện ở cả 2 enum nhưng ý nghĩa khác:
- `users.role = ADVISOR`: Role đăng nhập chính
- `class_roles.role_type = ADVISOR`: Vai trò được gán vào lớp cụ thể

Không phải bug, nhưng có thể gây nhầm lẫn khi đọc code.

---

### 12. ℹ️ `criteria.min_score` default 0 nhưng Backend cho phép điểm âm

**Database** (`schema.prisma` L102): `min_score Float @default(0)`

**Backend** (`scoring.service.ts` L352):
```typescript
if (score < (criteria.min_score ?? 0)) {
  throw new BadRequestException(...)
}
```

**Frontend** (`ScoringForm.tsx`): Không có validation min_score trên input.

Đã từng có yêu cầu "cho phép điểm âm cho cột SV tự chấm" (conversation 03db2037). Cần đảm bảo `min_score` trong DB đã được set đúng cho các tiêu chí cần điểm âm.

---

## 📋 BẢNG ĐỐI CHIẾU TOÀN BỘ TRƯỜNG DỮ LIỆU

### Model: `users`

| DB Field | Backend trả FE | Frontend interface | Khớp? |
|---|---|---|:---:|
| `id` | `id` | `id` | ✅ |
| `student_id` | `studentCode` | `studentCode` | ✅ (renamed) |
| `email` | `email` | `email` | ✅ |
| `full_name` | `name` | `name` | ✅ (renamed) |
| `phone` | — | `phone` (UsersTab) | ⚠️ Chỉ UsersTab |
| `role` | `role` (từ JWT) | `role` | ✅ |
| `department_id` | `department_id` | `department_id` | ✅ |
| `class_id` | `class_id` | `class_id` | ✅ |
| `avatar_url` | — | — | ℹ️ Chưa dùng |
| `last_login_at` | — | — | ℹ️ Chưa dùng |
| `is_active` | — | `is_active` | ✅ |
| `password_hash` | — (không expose) | — | ✅ Đúng |

### Model: `scoring_sheets`

| DB Field | Backend trả FE | Frontend dùng | Khớp? |
|---|---|---|:---:|
| `id` | `formId` | `formId` | ✅ |
| `status` | `formStatusDetail` | `formStatus` | ❌ **Key name lệch** |
| `current_step` | `currentStep` | — | ⚠️ Nhận nhưng không dùng |
| `student_total` | `studentTotal` | `studentTotal` | ✅ |
| `class_total` | `classTotal` | `classTotal` | ✅ |
| `advisor_total` | `advisorTotal` | `advisorTotal` | ✅ |
| `final_total` | `finalTotal` | `finalTotal` | ✅ |
| `classification` | `classification` | `classification` | ✅ |
| `student_submitted_at` | `studentSubmittedAt` | — | ⚠️ Không hiển thị |
| `class_reviewed_at` | `classReviewedAt` | — | ⚠️ Không hiển thị |
| `advisor_approved_at` | `advisorApprovedAt` | — | ⚠️ Không hiển thị |
| `school_finalized_at` | — | — | ℹ️ Chưa dùng |
| `rejection_reason` | — | — | ℹ️ Chưa dùng |
| `rejected_by_step` | — | — | ℹ️ Chưa dùng |

### Model: `score_details`

| DB Field | Backend trả FE | Frontend dùng | Khớp? |
|---|---|---|:---:|
| `criteria_id` | `criteria_id` | `criteria_id` | ✅ |
| `student_score` | `student_score` | `student_score` | ✅ |
| `class_score` | `class_score` | `class_score` | ✅ |
| `advisor_score` | `advisor_score` | `advisor_score` | ✅ |
| `proof_url` | `proof_url` | `proof_url` (read) / `proofUrl` (send) | ⚠️ Naming |
| `note` | — | — | ℹ️ Chưa dùng |

### Model: `semesters`

| DB Field | Frontend SemestersTab | Khớp? |
|---|---|:---:|
| `id` | `id` | ✅ |
| `code` | `code` | ✅ |
| `name` | `name` | ✅ |
| `academic_year` | `academic_year` | ✅ |
| `semester_number` | `semester_number` | ✅ |
| `start_date` | `start_date` | ✅ |
| `end_date` | `end_date` | ✅ |
| `student_deadline` | `student_deadline` | ✅ |
| `class_committee_deadline` | `class_committee_deadline` | ✅ |
| `advisor_deadline` | `advisor_deadline` | ✅ |
| `school_deadline` | `school_deadline` | ✅ |
| `status` | `status` | ✅ |
| `is_active` | `is_active` | ✅ |

### Model: `departments`

| DB Field | Frontend DepartmentsTab | Khớp? |
|---|---|:---:|
| `id` | `id` | ✅ |
| `code` | `code` | ✅ |
| `name` | `name` | ✅ |
| `is_active` | `is_active` | ✅ |
| — (computed) | `classCount` | ✅ API tính |
| — (computed) | `userCount` | ✅ API tính |

### Model: `classes`

| DB Field | Frontend ClassesTab | Khớp? |
|---|---|:---:|
| `id` | `id` | ✅ |
| `code` | `code` | ✅ |
| `name` | `name` | ✅ |
| `department_id` | `department_id` | ✅ |
| `academic_year` | `academic_year` | ✅ |
| `is_active` | `is_active` | ✅ |
| — (computed) | `departmentName` | ✅ API join |
| — (computed) | `studentCount` | ✅ API tính |

---

## 🎯 DANH SÁCH SỬA CHỮA ƯU TIÊN

### Ưu tiên 1 — Phải sửa ngay (Gây bug thực tế)
1. **`ScoringForm.tsx` L282:** Sửa `sheetStatus` → `formStatusDetail` (hoặc `formStatus`)
2. **`scoring.service.ts` L40-47:** Sửa `requiredStatus` cho ADVISOR trực tiếp, bỏ L58

### Ưu tiên 2 — Nên sửa sớm (Gây nhầm lẫn)
3. Thêm các status thiếu (`SCHOOL_REVIEWING`, `SCHOOL_APPROVED`, `SCHOOL_REJECTED`, `APPEALING`) vào frontend `STATUS_MAP` và `STATUS_INFO`
4. Xóa `SUPER_ADMIN` khỏi DB enum hoặc thêm xử lý
5. Hợp nhất 2 hệ thống workflow (shared `WORKFLOW_RULES` vs backend `STATE_TRANSITIONS`)

### Ưu tiên 3 — Cải thiện code quality
6. Thống nhất naming convention (`CLASS_PRESIDENT` vs `CLASS_COMMITTEE`)
7. Kích hoạt sử dụng `SubmitScoreSchema` từ shared package
8. Thêm client-side validation dùng Zod schema

---

## 📈 SƠ ĐỒ LUỒNG DỮ LIỆU

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  FRONTEND   │────▶│    BACKEND API   │────▶│  DATABASE   │
│  (Next.js)  │◀────│   (NestJS)       │◀────│  (MySQL)    │
└─────────────┘     └──────────────────┘     └─────────────┘
     │                       │                       │
     │ role=CLASS_PRESIDENT  │ mapped→CLASS_COMMITTEE │ enum=CLASS_COMMITTEE
     │ body.proofUrl         │ mapped→proof_url       │ field=proof_url
     │ sheetStatus ← ???     │ returns formStatus     │ field=status
     │                       │                        │
     │ STATUS_MAP (10 items) │ workflowStepMap(10)    │ enum (13 items)
     │                       │ STATE_TRANSITIONS(3)   │
     │                       │ WORKFLOW_RULES(12)     │
     └───────────────────────┴────────────────────────┘
              ↑ ĐÂY LÀ NƠI LỆCH PHA XẢY RA
```

---

*File này được tạo tự động bằng công cụ kiểm tra tương thích hệ thống.*
