# Báo cáo: Chuẩn hóa Quản lý Biến Môi trường (Environment Variables)

Tài liệu này ghi chú chi tiết về đợt tái cấu trúc quản lý biến môi trường (`.env`) cho dự án Monorepo `student-training-score`.

## 1. Vấn đề trước khi thay đổi
Trước đây, dự án đang gặp phải tình trạng **phân mảnh cấu hình**. Cụ thể:
- Tồn tại tận **4 file `.env` riêng biệt** nằm rải rác ở các thư mục:
  1. `D:\duan\.env` (Thư mục gốc)
  2. `D:\duan\packages\api\.env` (Backend NestJS)
  3. `D:\duan\packages\database\.env` (Prisma/DB)
  4. `D:\duan\packages\web\.env` (Frontend NextJS)
- **Hậu quả:** 
  - Khó kiểm soát: Khi đổi API key hoặc địa chỉ email, lập trình viên phải copy-paste đi nhiều nơi. 
  - Gây lỗi (Bug): Mới đây nhất, biến `EMAIL_SENDER` bị sai do sửa ở file này nhưng quên sửa ở file kia, và server đọc nhầm file cũ dẫn đến tính năng gửi email bị lỗi `400 Bad Request`.
  - Không tuân thủ nguyên tắc **DRY** (Don't Repeat Yourself) của chuẩn công nghiệp cho Monorepo.

## 2. Giải pháp và Những thay đổi cụ thể

Chúng ta đã áp dụng chuẩn công nghiệp là **Single Source of Truth** (Nguồn chân lý duy nhất) kết hợp với công cụ `dotenv-cli`.

### A. Quy về một mối (Gộp file)
- **[Đã Xóa]** `packages/api/.env`
- **[Đã Xóa]** `packages/database/.env`
- **[Đã Xóa]** `packages/web/.env`
- **[Giữ Lại]** Duy nhất 1 file `D:\duan\.env`. Mọi biến môi trường của Database, Backend, Frontend giờ đây chỉ được phép khai báo tại đây.

### B. Tự động bơm biến môi trường (Dependency Injection)
Vì các package con đã mất file `.env`, chúng ta cần tự động nạp (inject) file `.env` ở thư mục gốc vào chúng mỗi khi chạy lệnh.
- **Cài đặt thư viện:** Đã cài thêm package `dotenv-cli` vào môi trường gốc (`D:\duan`).
- **Sửa file `package.json` gốc:** Đổi lệnh chạy dev để sử dụng `dotenv-cli` chèn `.env` trước khi khởi chạy tiến trình.
  ```json
  "scripts": {
    "dev:web": "dotenv -e .env -- npm run dev --workspace=@student-score/web",
    "dev:api": "dotenv -e .env -- npm run start:dev --workspace=@student-score/api",
    "db:push": "dotenv -e .env -- npm run db:push --workspace=@student-score/database",
    "db:generate": "dotenv -e .env -- npm run db:generate --workspace=@student-score/database",
    "db:studio": "dotenv -e .env -- npm run db:studio --workspace=@student-score/database"
  }
  ```

### C. Dọn dẹp Code Thừa (Ponytail Rule)
Vì `dotenv-cli` đã lo việc nạp cấu hình từ bên ngoài vào `process.env`, đoạn code thủ công trong Backend trở nên vô dụng.
- **[Đã Xóa]** Các dòng code thủ công cấu hình `dotenv` trong `D:\duan\packages\api\src\main.ts`:
  ```typescript
  // Đã xóa bỏ hoàn toàn đoạn này:
  // import * as dotenv from 'dotenv';
  // import * as path from 'path';
  // const envPath = path.resolve(__dirname, '../../../.env');
  // dotenv.config({ path: envPath });
  ```

## 3. Cách sử dụng chuẩn mới cho tương lai

1. **Thêm/Sửa Cấu hình:** BẤT KỲ khi nào có biến môi trường mới (như API Key, DB Pass,...), chỉ mở **duy nhất** file `D:\duan\.env` ra và thêm vào.
2. **Khởi động dự án:** Chạy lệnh ở thư mục gốc như bình thường (`npm run dev:api` hoặc `npm run dev:web`). Hệ thống sẽ tự động rót các biến này xuống các thư mục con tương ứng.
3. **Thao tác với Database (Prisma):** Không cần `cd` vào thư mục `database` nữa. Bạn đứng thẳng ở thư mục gốc `D:\duan` và gõ:
   - `npm run db:push`
   - `npm run db:generate`
   - `npm run db:studio`
