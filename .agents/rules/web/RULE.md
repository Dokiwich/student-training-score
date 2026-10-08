# Quy Chuẩn Frontend Web (Web Rules)

Vị trí áp dụng: `packages/web`, Next.js App Router, Components, Hooks, UI Logic.

## 1. Giao diện động theo dữ liệu (Data-Driven UI)
1. **Không hardcode ID tiêu chí:** Cấu trúc form chấm điểm (`ScoringForm.tsx`) phải hoàn toàn dựa trên cây dữ liệu trả về từ Database. Tuyệt đối không hardcode ID cụ thể (ví dụ: `1.1.2`, `2.3`) trong logic giao diện.
2. **Hiển thị nhóm và tiêu chí con:** Node cha tự động mở rộng/thu gọn nếu có phần tử con; node lá hiển thị trường nhập/chọn điểm tương ứng với `score_type`.

## 2. Quản lý Cache & Dynamic Rendering
1. **Kiểm soát Cache Next.js:** Các API route hoặc Server Component cần dữ liệu thời gian thực (ví dụ: học kỳ active, danh sách sinh viên) bắt buộc khai báo `export const dynamic = 'force-dynamic'` ở đầu file.
2. **Tránh cache tĩnh sai lệch:** Đảm bảo revalidate hoặc vô hiệu hóa cache khi người dùng vừa submit dữ liệu.

## 3. Tính toán & Hiển thị trạng thái
1. **Chặn điểm âm:** Mọi phép tính tổng điểm danh mục trên giao diện phải bọc qua `Math.max(0, sum)` để không hiển thị điểm âm.
2. **Ánh xạ Stepper đầy đủ:** Tiến trình workflow (Stepper) phải ánh xạ toàn bộ trạng thái backend (bao gồm `DRAFT`, `SUBMITTED`, `CLASS_APPROVED`, `ADVISOR_APPROVED`, `SCHOOL_REVIEWING`, `FINALIZED`), không để trạng thái thiếu rơi vào mặc định `-1`.
3. **Cảnh báo minh chứng:** Hiển thị rõ cảnh báo bắt buộc khi tiêu chí có `require_evidence === 1`.
