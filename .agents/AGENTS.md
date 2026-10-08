# Quy Chuẩn Dự Án Dokiwich (.agents/AGENTS.md)

Áp dụng thường trực (Always-on) cho toàn bộ workspace:

## 1. Mục tiêu, Phạm vi & Quyền hạn
- **Đúng phạm vi (YAGNI):** Chỉ làm đúng yêu cầu được giao, không tự ý mở rộng tính năng hay thêm abstraction thừa.
- **Cổng duyệt chủ dự án:** Mọi thay đổi kiến trúc, schema/migration, dependency, tool/plugin, API contract, phân quyền, commit/push/deploy bắt buộc trình phương án (blast radius + rollback plan) và chờ duyệt.

## 2. Bảo mật chấm điểm bất biến (Double-Check)
- **Không tin Frontend:** Mọi validation và giới hạn điểm trên UI bắt buộc có kiểm tra tương đương tại Backend.
- **Cross-Semester:** Bắt buộc đối soát `criteriaId` thuộc đúng `criteria_version_id` của `semester_id`.
- **Leaf-Node Only:** Chỉ chấm điểm ở node lá, cấm ghi điểm vào node cha/danh mục.
- **Evidence:** `require_evidence === 1` bắt buộc có `proofUrl` hợp lệ, thiếu thì ném `BadRequestException`.
- **Radio/Options Sweep:** Khi lưu điểm node radio/options, Backend bắt buộc quét xóa điểm của các tiêu chí anh em (`enforceMutualExclusivity`).
- **IDOR & Role:** Bắt buộc gọi `verifyActorRole(actorId, studentId, role, semesterId)` ở đầu API.

## 3. Toàn vẹn Cơ sở dữ liệu & Hiệu năng
- **Transaction:** Bắt buộc dùng `prisma.$transaction` cho mọi thao tác ghi từ 2 bảng trở lên.
- **Idempotency:** Ghi dữ liệu phải an toàn khi retry/F5 (dùng `upsert` hoặc optimistic lock).
- **Điểm không âm:** Mọi phép tính tổng điểm phải chặn dưới qua `Math.max(0, sum)`.
- **Dynamic Rendering:** Route/component cần dữ liệu mới phải có `export const dynamic = 'force-dynamic'`.
- **Hiệu năng query:** Không `await` tuần tự khi có thể gộp qua `Promise.all` hoặc `include`. Index cho foreign key và query nóng.
- **UI Data-Driven:** Form render theo cây DB; tuyệt đối không hardcode ID tiêu chí cụ thể.

## 4. Quy trình phân tích mã & Báo cáo
- **Trước khi sửa:** Chạy `impact({target, direction: "upstream"})`, cảnh báo nếu rủi ro HIGH/CRITICAL.
- **Trước khi commit:** Chạy `detect_changes()` để kiểm tra phạm vi ảnh hưởng.
- **Báo cáo chuẩn:** Nêu rõ: Đã đổi gì / Vì sao đổi / Rủi ro & Rollback / Việc chưa làm vì chờ duyệt.