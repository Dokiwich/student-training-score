# Hệ thống Chấm điểm Rèn luyện Sinh Viên

Đây là dự án quản lý chấm điểm rèn luyện (monorepo).
Dự án bao gồm:
- **`packages/database`**: Chứa Prisma schema và Database client.
- **`packages/shared`**: Chứa Zod schemas (`score.schema.ts`), TypeScript types dùng chung.
- **`packages/api`**: Backend NestJS (chuẩn bị API lưu/chấm điểm).
- **`packages/web`**: Frontend Next.js (Dashboard nhập điểm sinh viên).

## Chuẩn bị môi trường
Lưu ý quan trọng: Code không đính kèm file `.env` vì lý do bảo mật.
1. Copy file `.env.example` thành `.env` (ở các thư mục gốc và thư mục cần thiết).
2. Điền Database URL thật vào file `.env` mới tạo.
3. Chạy `npm install` để cài đặt thư viện.
4. Chạy `npx prisma db push` (hoặc `npx prisma migrate dev`) trong `packages/database`.
5. Tiếp theo, chạy `npx tsx prisma/seed.ts` để bơm dữ liệu giả.

## Khởi chạy dự án
Chạy lệnh gốc tại thư mục chính (hoặc các thư mục tương ứng):
- Backend: `npm run start:dev` (trong thư mục API)
- Frontend: `npm run dev` (trong thư mục Web)

## Cách Push lên Github
Để đẩy source code này lên Github một cách an toàn nhất:

1. **Khởi tạo và add code:**
   Mở terminal (PowerShell/CMD) tại thư mục `d:\duan` và chạy:
   ```bash
   git add .
   git commit -m "Khởi tạo dự án Điểm Rèn Luyện"
   ```

2. **Cấu hình Repo trên Github:**
   - Lên trang [github.com](https://github.com/) và tạo một repository mới (New Repository). Đừng check vào dòng "Add a README file".
   - Sau khi tạo, Github sẽ cung cấp cho bạn một đường link dạng `https://github.com/TênBạn/TenRepo.git`.

3. **Gắn repo và đẩy (Push) dữ liệu**
   Quay lại terminal vừa nãy, chạy 2 lệnh sau (nhớ thay link git của bạn vào):
   ```bash
   git remote add origin https://github.com/Tên-Của-Bạn/Tên-Repo-Vừa-Tạo.git
   git push -u origin main
   ```
   *(Nếu git báo lỗi nhánh mặc định đang là `master`, hãy đổi `main` thành `master` ở lệnh cuối, hoặc chạy `git branch -M main` trước khi push)*

> **An toàn Dữ liệu:** Code có thể public tự nhiên vì file `.env` chứa chuỗi kết nối Database thật đã được tự động loại bỏ (ignored) bởi `git`.
