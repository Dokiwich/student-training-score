# Backend API Package Rules

Áp dụng cho mọi tác vụ trong `packages/api`:

1. **Chống IDOR & Phân quyền:** Bắt buộc gọi `verifyActorRole(actorId, studentId, role, semesterId)` ở đầu endpoint.
2. **Double-Check:** Tự kiểm tra lại 100% giới hạn điểm và minh chứng tại backend, không tin cậy frontend.
3. **HTTP Methods & Errors:** Chỉ dùng `POST`/`PUT`/`PATCH` cho thao tác đổi dữ liệu; chuẩn hóa `try-catch` và exception HTTP.
4. **Scoring Logic:** Tuân thủ quy tắc chỉ chấm node lá, quét xóa điểm anh em khi chọn radio/options, chặn cross-semester.

> Chi tiết: xem [.agents/rules/api/RULE.md](file:///d:/duan/.agents/rules/api/RULE.md) và [.agents/rules/scoring/RULE.md](file:///d:/duan/.agents/rules/scoring/RULE.md).
