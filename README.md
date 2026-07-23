<div align="center">
  <img src="packages/web/public/assets/login/logo.png" alt="MIT UNI Logo" width="120" />

  <h1>Cổng Chấm Điểm Rèn Luyện</h1>

  <p>
    Nền tảng quản lý và số hóa quy trình đánh giá điểm rèn luyện sinh viên theo nhiều cấp độ xử lý.
  </p>

  <p>
    <strong>Sinh viên → Ban cán sự → Cố vấn học tập → Khoa → Nhà trường</strong>
  </p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

---

## Mục lục
- [Tổng quan](#tổng-quan)
- [Điểm nổi bật](#điểm-nổi-bật)
- [Quy trình nghiệp vụ](#quy-trình-nghiệp-vụ)
- [Vai trò người dùng](#vai-trò-người-dùng)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Các lệnh hữu ích](#các-lệnh-hữu-ích)
- [Trạng thái dự án](#trạng-thái-dự-án)
- [Bảo mật](#bảo-mật)
- [Đóng góp](#đóng-góp)

---

## Tổng quan

**Cổng Chấm Điểm Rèn Luyện** là hệ thống web hỗ trợ số hóa toàn bộ quy trình tự đánh giá và phê duyệt điểm rèn luyện của sinh viên tại MIT UNI. Mỗi phiếu đánh giá được xử lý theo một luồng phân quyền rõ ràng, minh bạch từ sinh viên đến Ban cán sự, Cố vấn học tập, Khoa và Nhà trường.

Hệ thống được thiết kế theo kiến trúc **monorepo**, cho phép tách bạch rõ ràng giữa ứng dụng giao diện (Next.js) và dịch vụ xử lý nghiệp vụ backend (NestJS), đảm bảo tính nhất quán của workflow, khả năng lưu vết điều chỉnh, và phân giải phạm vi lớp an toàn ở cấp độ máy chủ.

## Điểm nổi bật

- **Workflow đánh giá nhiều cấp:** Trạng thái phiếu thay đổi tuần tự từ `DRAFT` đến `FINALIZED`.
- **Phân giải phạm vi lớp phía server:** Ngăn chặn tuyệt đối việc người dùng truy cập hoặc sửa điểm của lớp không được phân công.
- **Bulk actions:** Ban cán sự và Cố vấn học tập có thể duyệt hàng loạt nhiều phiếu cùng lúc.
- **Theo dõi tiến độ:** Từng trạng thái chấm điểm được cập nhật thời gian thực trên giao diện.
- **Dark mode:** Giao diện hỗ trợ cả hai chế độ sáng tối với Next Themes.
- **Export báo cáo:** Hỗ trợ xuất dữ liệu ra định dạng XLSX cho việc lưu trữ và thống kê.
- **Dashboard chuyên biệt:** Giao diện hiển thị thống kê được thiết kế riêng cho từng cấp quản lý (Ban cán sự, CVHT, Khoa, Admin).

## Quy trình nghiệp vụ

Luồng chuyển trạng thái chuẩn của một phiếu đánh giá rèn luyện:

```mermaid
flowchart LR
    A[Sinh viên<br/>tự đánh giá]
    B[Ban cán sự lớp<br/>kiểm tra]
    C[Cố vấn học tập<br/>đánh giá]
    D[Hoàn tất<br/>(Dự kiến)]

    A -->|Nộp phiếu| B
    B -->|Duyệt| C
    B -.->|Trả lại| A
    C -->|Duyệt| D
    C -.->|Trả lại| B
```

- Phiếu chỉ được nộp trong thời hạn học kỳ.
- Người dùng ở từng vai trò chỉ có thể can thiệp điểm khi trạng thái phiếu thuộc quyền xử lý của mình.
- Khi phiếu bị trả lại (Reject), sinh viên hoặc cấp xử lý trước đó sẽ phải chỉnh sửa và nộp lại.

## Vai trò người dùng

| Vai trò | Trách nhiệm chính |
| :--- | :--- |
| **Sinh viên** | Tự chấm điểm, nộp phiếu và theo dõi kết quả. Thực hiện khiếu nại nếu cần. |
| **Ban cán sự** | *(Bao gồm Lớp trưởng, Lớp phó, Bí thư)*: Kiểm tra, duyệt hoặc điều chỉnh điểm cho sinh viên trong lớp được phân công. |
| **Cố vấn học tập** | Đánh giá và chốt điểm cho các lớp mình quản lý (có thể quản lý nhiều lớp). |
| **Khoa** | Quản lý tiến độ chấm điểm của Khoa, import sinh viên/lớp, theo dõi và tổng hợp dữ liệu. |
| **Quản trị trường** | Thiết lập học kỳ, bộ tiêu chí, phân quyền người dùng và xuất báo cáo toàn trường. |

## Kiến trúc hệ thống

Dự án được cấu trúc theo dạng Monorepo sử dụng npm workspaces.

```mermaid
flowchart TB
    WEB[Next.js Web Application]
    API[NestJS REST API]
    SHARED[Shared Types & Validation]
    DBPKG[Prisma Database Package]
    POSTGRES[(PostgreSQL)]

    WEB --> API
    WEB --> SHARED
    API --> SHARED
    API --> DBPKG
    DBPKG --> POSTGRES
```

## Công nghệ sử dụng

| Lớp | Công nghệ |
| :--- | :--- |
| **Frontend** | Next.js (v16), React (v19), TypeScript, Tailwind CSS (v4) |
| **Backend** | NestJS (v11), TypeScript |
| **Authentication** | NextAuth, JWT, bcrypt |
| **Database** | PostgreSQL, Prisma ORM |
| **Validation** | class-validator, class-transformer |
| **UI Components** | Lucide React, next-themes |
| **Export/Import** | SheetJS (xlsx) |
| **Tooling** | npm workspaces, dotenv-cli |

## Cấu trúc thư mục

```text
student-training-score/
├── packages/
│   ├── api/          # NestJS backend (REST API, logic nghiệp vụ, bảo mật)
│   ├── web/          # Next.js frontend (Giao diện UI, client rendering)
│   ├── database/     # Prisma schema, migrations và database client wrapper
│   └── shared/       # Types, constants và schemas dùng chung cho cả FE & BE
├── Dockerfile.api    # Dockerfile cho API Server
├── Dockerfile.web    # Dockerfile cho Web App
├── .env.example
└── package.json      # Monorepo root
```

## Yêu cầu hệ thống

- Node.js phiên bản LTS hiện đại (đáp ứng Next.js 16 và NestJS 11).
- npm với hỗ trợ workspaces.
- Cơ sở dữ liệu PostgreSQL.

## Bắt đầu nhanh

Để thiết lập môi trường phát triển trên máy cá nhân:

**Bước 1: Clone repository và cài đặt dependencies**
```bash
git clone https://github.com/Dokiwich/student-training-score.git
cd student-training-score
npm install
```

**Bước 2: Cấu hình biến môi trường**
Trên Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```
Trên MacOS/Linux:
```bash
cp .env.example .env
```
Mở tệp `.env` và cập nhật thông tin kết nối Database.

**Bước 3: Khởi tạo cơ sở dữ liệu**
```bash
npm run db:generate
npm run db:push
```

**Bước 4: Chạy ứng dụng**
Khởi chạy API backend ở Terminal 1:
```bash
npm run dev:api
```
Khởi chạy ứng dụng Web ở Terminal 2:
```bash
npm run dev:web
```
Ứng dụng sẽ hoạt động tại `http://localhost:3000` (Web) và API tại cổng `3001` hoặc cổng do bạn cấu hình.

## Cấu hình môi trường

Tệp `.env` cần chứa các cấu hình quan trọng sau đây:

| Biến | Bắt buộc | Mô tả | Ví dụ |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Có | Chuỗi kết nối đến PostgreSQL | `postgresql://user:pass@localhost:5432/dgrl_mit` |
| `PORT` | Không | Cổng chạy API Backend (Mặc định: 3001) | `3001` |
| `NEXT_PUBLIC_API_URL`| Không | URL kết nối API cho Frontend | `http://localhost:3001/api` |
| `NEXTAUTH_SECRET` | Có | Chuỗi bí mật mã hóa Session/JWT | *(Tạo ngẫu nhiên)* |
| `NEXTAUTH_URL` | Có | URL ứng dụng Next.js | `http://localhost:3000` |
| `MAILEROO_API_KEY` | Không | API Key gửi thông báo qua email | *(Bảo mật)* |
| `EMAIL_SENDER` | Không | Email người gửi hệ thống | `noreply@student.mit.vn` |

## Các lệnh hữu ích

Tại thư mục gốc, bạn có thể chạy các script sau:

| Lệnh | Công dụng |
| :--- | :--- |
| `npm run dev:web` | Khởi chạy frontend ở chế độ development |
| `npm run dev:api` | Khởi chạy backend ở chế độ development |
| `npm run db:generate` | Tạo mới Prisma Client dựa trên schema |
| `npm run db:push` | Đồng bộ Schema trực tiếp vào Database (Development) |
| `npm run db:studio` | Mở Prisma Studio để xem và quản lý dữ liệu |
| `npm run build --workspace=packages/api` | Build dự án Backend |
| `npm run build --workspace=packages/web` | Build dự án Frontend |

## Trạng thái dự án

> [!IMPORTANT]
> Dự án đang trong quá trình phát triển và hoàn thiện các module nghiệp vụ (Phase 5+). Cấu trúc Database schema, API route và giao diện Dashboard có thể tiếp tục thay đổi để đáp ứng thực tế.

Repository có cung cấp cấu hình `Dockerfile.web` và `Dockerfile.api` nhằm hỗ trợ đóng gói môi trường.

## Bảo mật

Hệ thống được thiết kế lưu tâm đến vấn đề an toàn:
- Sử dụng các middleware bảo mật cơ bản phía Backend (`helmet`, `hpp`, `express-rate-limit`).
- Token JWT được bảo vệ chặt chẽ và không lưu trữ mật khẩu plaintext.
- **Lưu ý:** Tuyệt đối không commit tệp `.env` hay chia sẻ `NEXTAUTH_SECRET` vào mã nguồn chung. Báo cáo mọi lỗ hổng trực tiếp thông qua kênh nội bộ của team.

## Đóng góp

Để tham gia đóng góp cho dự án:
1. Fork repository.
2. Tạo nhánh tính năng (`feature/them-chuc-nang` hoặc `fix/sua-loi`).
3. Commit mã nguồn theo quy chuẩn Conventional Commits.
4. Đảm bảo mã nguồn không có lỗi bằng cách chạy build cho cả `packages/web` và `packages/api`.
5. Tạo Pull Request mô tả rõ vấn đề giải quyết.

<div align="center">
  <br/>
  <sub>Xây dựng nhằm minh bạch hóa và tự động hóa quy trình đánh giá chất lượng sinh viên.</sub>
</div>
