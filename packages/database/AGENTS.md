# Database Package Rules

Áp dụng cho mọi tác vụ trong `packages/database`:

1. **Transaction bắt buộc:** Bọc mọi thao tác ghi nhiều bảng trong `await prisma.$transaction()`.
2. **Idempotency:** Ghi dữ liệu phải idempotent khi retry (dùng `upsert` hoặc optimistic lock).
3. **Hiệu năng:** Gộp query qua `Promise.all` hoặc `include`, không dùng sequential `await` gây chậm mạng trên serverless DB.
4. **Index & Constraints:** Luôn đánh index cho foreign key và filter column; đảm bảo ràng buộc không âm.
5. **Cổng duyệt:** Thay đổi schema, migration hoặc xóa dữ liệu bắt buộc chờ chủ dự án phê duyệt.

> Chi tiết: xem [.agents/rules/database/RULE.md](file:///d:/duan/.agents/rules/database/RULE.md) và tra cứu sâu tại [.agents/rules/database/Rule DB.md](file:///d:/duan/.agents/rules/database/Rule%20DB.md).
