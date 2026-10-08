# Quy Chuẩn Backend API (API Rules)

Vị trí áp dụng: `packages/api`, NestJS Controllers/Services/Modules, API Routes.

## 1. Kiểm soát quyền truy cập & Chống IDOR
1. **Xác thực quyền (`verifyActorRole`):** Bắt buộc gọi `verifyActorRole(actorId, studentId, role, semesterId)` ở đầu mọi endpoint liên quan đến chấm điểm hoặc hồ sơ.
2. **Khóa định danh:** Luôn dùng `studentId` và `actorId` từ JWT/Session đã xác thực, không tin cậy ID do client tự truyền lên thân request.
3. **Giới hạn vai trò:** Chỉ các vai trò hợp lệ (`STUDENT`, `CLASS_COMMITTEE`, `ADVISOR`, `ADMIN`) mới được phép truy cập theo ma trận quyền quy định.

## 2. Thiết kế API & Xử lý lỗi
1. **Chuẩn HTTP Method:** Mọi endpoint thay đổi dữ liệu hoặc trạng thái bắt buộc dùng `POST`, `PUT` hoặc `PATCH`. Tuyệt đối không dùng `GET` để sửa dữ liệu.
2. **Xử lý Exception chuẩn hóa:** Bọc logic trong `try-catch`, ném exception chính xác (`BadRequestException`, `ForbiddenException`, `NotFoundException`), không nuốt lỗi âm thầm.
3. **Idempotent Actions:** Các endpoint submit form, xác nhận điểm phải xử lý an toàn trước tình trạng double-submit (kiểm tra trạng thái trước khi chuyển tiếp).
4. **Audit Logging:** Các thao tác điều chỉnh điểm, phê duyệt hoặc can thiệp quản trị phải ghi log vào `audit_logs` / `review_actions` trong cùng transaction.
