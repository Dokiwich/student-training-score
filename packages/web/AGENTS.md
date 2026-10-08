# Frontend Web Package Rules

Áp dụng cho mọi tác vụ trong `packages/web`:

1. **Data-Driven UI:** Render form từ cây tiêu chí DB; cấm hardcode ID tiêu chí (như `1.1.2`).
2. **Next.js Dynamic Cache:** Các route/component cần dữ liệu mới phải có `export const dynamic = 'force-dynamic'`.
3. **Tính toán an toàn:** Bọc tổng điểm danh mục trong `Math.max(0, sum)`; ánh xạ Stepper đủ các trạng thái backend.
4. **Minh chứng rõ ràng:** Hiển thị cảnh báo bắt buộc khi `require_evidence === 1`.

> Chi tiết: xem [.agents/rules/web/RULE.md](file:///d:/duan/.agents/rules/web/RULE.md) và [.agents/rules/scoring/RULE.md](file:///d:/duan/.agents/rules/scoring/RULE.md).
