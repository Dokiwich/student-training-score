# Quy Chuẩn Cơ Sở Dữ Liệu (Database Rules)

Vị trí áp dụng: `packages/database`, Prisma Schema, Migrations, DB Queries.

## 1. Nguyên tắc cốt lõi (Bất biến)
- **Đúng đắn trước, hiệu năng sau (Correctness first):** Tuyệt đối không hy sinh tính toàn vẹn dữ liệu.
- **Thẩm quyền:** Mọi thay đổi schema, migration, seed, xóa/sửa bảng phải trình phương án và được chủ dự án phê duyệt trước.

## 2. Quy tắc kỹ thuật bắt buộc
1. **Transaction bắt buộc:** Mọi thao tác ghi/cập nhật trên từ 2 bảng trở lên (ví dụ: `score_details`, `score_entries`, `audit_logs`) bắt buộc bọc trong `await prisma.$transaction(async (tx) => { ... })`.
2. **Idempotency khi ghi dữ liệu:** Các thao tác lưu dữ liệu phải an toàn khi retry/F5:
   - Dùng Prisma `upsert` với compound unique index (ví dụ: `@@unique([score_detail_id, scorer_role])`).
   - Hoặc Optimistic Locking qua `updateMany` có kiểm tra điều kiện trạng thái.
3. **Hiệu năng truy vấn (Tránh tuần tự):**
   - Không viết `await query1; await query2;` nếu hai truy vấn độc lập.
   - Luôn gộp qua `Promise.all([query1, query2])` hoặc dùng Prisma `include`/`select` để giảm round-trip (đặc biệt quan trọng với Neon / Serverless DB).
4. **Đánh Index có chủ đích:** Bắt buộc có index cho: Foreign keys, cột lọc/tìm kiếm thường xuyên, và unique constraint kết hợp.
5. **Ràng buộc dữ liệu không âm:** Giá trị điểm/tổng số không được âm; xử lý chặn ở cả tầng logic và DB constraint nếu khả dụng.
6. **Migration an toàn:** Migration không được làm mất dữ liệu cũ; phải có phương án kiểm tra và rollback trước khi áp dụng.

## 3. Tra cứu nâng cao
- Khi cần thiết kế phân vùng, locking mức cao, hoặc tối ưu truy vấn sâu, tra cứu tài liệu đầy đủ tại: [Rule DB.md](file:///d:/duan/.agents/rules/database/Rule%20DB.md).
