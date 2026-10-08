# Nhật Ký Phiên Làm Việc: 2026-10-08

## 1. Mục tiêu
Tối ưu hóa hệ thống luật lệ (Rules) của workspace, tách bạch nguyên tắc bất biến khỏi tri thức tình huống, phân chia luật theo từng vị trí làm việc, và xây dựng cơ chế ghi nhật ký công việc (Worklog).

## 2. Thay đổi đã thực hiện
1. **Global Rules (`C:\Users\anh\.gemini\GEMINI.md`):** Rút gọn từ 196 dòng xuống 44 dòng. Thêm bảng phân quyền 3 mức rủi ro, làm mềm phụ thuộc công cụ.
2. **Modular Rules (`.agents/rules/`):**
   - `.agents/rules/database/RULE.md`: 15 quy tắc bất biến cho DB (Postgres, Prisma, $transaction, index).
   - `.agents/rules/database/Rule DB.md`: Di chuyển Constitution đầy đủ vào đây để tra cứu chuyên sâu.
   - `.agents/rules/api/RULE.md`: Quy chuẩn IDOR, verifyActorRole, HTTP method, try-catch chuẩn hóa.
   - `.agents/rules/web/RULE.md`: Data-driven UI, Next.js dynamic cache, Math.max(0, sum).
   - `.agents/rules/scoring/RULE.md`: Bảo mật chấm điểm (Leaf-node, Cross-semester, Evidence, Radio sweep).
3. **Package Rules:**
   - `packages/database/AGENTS.md`
   - `packages/api/AGENTS.md`
   - `packages/web/AGENTS.md`
4. **Worklog Directory (`.agents/worklog/`):**
   - Thiết lập chuẩn ghi nhận tiến độ (`README.md`, `CURRENT_TASK.md`, `sessions/`, `decisions/`).

## 3. Kiểm chứng
- Kiểm tra các đường dẫn file và cấu trúc thư mục đảm bảo đúng chuẩn.
