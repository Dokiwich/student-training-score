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

