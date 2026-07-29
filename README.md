<div align="center">
  <img src="packages/web/public/assets/dash/logom.png" alt="MIT UNI" width="96" />

  <h1>Cổng Chấm Điểm Rèn Luyện</h1>

  <p><strong>Student Training Evaluation System</strong></p>

  <p>
    Nền tảng số hóa quy trình tự đánh giá, xét duyệt và quản lý<br/>
    điểm rèn luyện sinh viên theo nhiều cấp xử lý.
  </p>

  <p>
    Sinh viên · Ban cán sự · Cố vấn học tập · Khoa · Nhà trường
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/NestJS_11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

<p align="center">
  <a href="#tổng-quan">Tổng quan</a> ·
  <a href="#tính-năng-nổi-bật">Tính năng</a> ·
  <a href="#quy-trình-nghiệp-vụ">Quy trình</a> ·
  <a href="#kiến-trúc-hệ-thống">Kiến trúc</a> ·
  <a href="#bắt-đầu-nhanh">Bắt đầu nhanh</a> ·
  <a href="#đóng-góp">Đóng góp</a>
</p>

> [!IMPORTANT]
> Dự án đang trong quá trình phát triển và hoàn thiện.
> API, giao diện và cấu trúc dữ liệu có thể tiếp tục thay đổi.

---

## Tổng quan

**Cổng Chấm Điểm Rèn Luyện** là hệ thống web hỗ trợ số hóa toàn bộ quy trình tự đánh giá và phê duyệt điểm rèn luyện của sinh viên. Mỗi phiếu đánh giá được xử lý theo một luồng phân quyền nhiều cấp — từ sinh viên tự chấm, qua Ban cán sự lớp, Cố vấn học tập, đến cấp Khoa và Nhà trường.

Hệ thống được tổ chức theo kiến trúc **monorepo**, cho phép frontend (Next.js), backend (NestJS), database (Prisma) và shared types cùng phát triển trong một repository duy nhất. Cơ chế phân giải phạm vi lớp được xử lý hoàn toàn phía server, đảm bảo mỗi người dùng chỉ truy cập được đúng dữ liệu trong phạm vi được phân công.

### Bài toán

Quy trình chấm điểm rèn luyện truyền thống thường dựa trên biểu mẫu giấy hoặc bảng tính, gây ra nhiều bất cập:

- Khó theo dõi phiếu đang ở cấp xử lý nào.
- Quyền xem và chấm điểm không được giới hạn rõ ràng theo lớp, khoa.
- Thiếu lịch sử điều chỉnh khi có tranh chấp hoặc khiếu nại.
- Tổng hợp kết quả theo lớp, khoa, học kỳ tốn nhiều công sức thủ công.

Hệ thống này giải quyết các vấn đề trên bằng cách số hóa toàn bộ luồng xử lý, phân quyền chặt chẽ và lưu vết mọi thao tác.

---

## Tính năng nổi bật

| Nhóm chức năng | Mô tả |
| :--- | :--- |
| **Quy trình nhiều cấp** | Phiếu đánh giá đi qua các trạng thái từ Nháp → Nộp → Duyệt BCS → Duyệt CVHT → Hoàn tất, có hỗ trợ xóa/reset để làm lại. |
| **Dashboard theo vai trò** | Giao diện thống kê riêng cho Sinh viên, Ban cán sự, Cố vấn học tập, Khoa và Quản trị viên. |
| **Phân quyền phạm vi lớp** | Backend xác định lớp được phân công dựa trên role assignment; client không thể tự chọn lớp ngoài phạm vi. |
| **Duyệt hàng loạt** | Ban cán sự và Cố vấn học tập có thể thao tác bulk trên nhiều phiếu cùng lúc. |
| **Quản lý học kỳ & tiêu chí** | Tạo học kỳ, thiết lập deadline, áp dụng bộ tiêu chí chấm điểm theo phiên bản. |
| **Khiếu nại & phúc khảo** | Sinh viên có thể gửi khiếu nại sau khi phiếu được hoàn tất; hệ thống lưu audit log đầy đủ. |
| **Thông báo** | Hệ thống thông báo nội bộ cho các sự kiện liên quan đến phiếu đánh giá. |
| **Xuất báo cáo** | Hỗ trợ export dữ liệu ra định dạng XLSX phục vụ lưu trữ và thống kê. |
| **Dark mode** | Giao diện hỗ trợ chuyển đổi sáng/tối thông qua `next-themes`. |
| **Responsive** | Giao diện thích ứng nhiều kích thước màn hình với Tailwind CSS. |

---

## Quy trình nghiệp vụ

Luồng xử lý phiếu đánh giá dựa trên state machine được định nghĩa trong mã nguồn:

```mermaid
flowchart LR
    DRAFT["Nháp"]
    SUBMITTED["Sinh viên<br/>đã nộp"]
    CLASS_ING["Ban cán sự<br/>đang duyệt"]
    CLASS_ED["Ban cán sự<br/>đã duyệt"]
    ADV_ING["CVHT<br/>đang duyệt"]
    ADV_ED["CVHT<br/>đã duyệt"]
    SCH_ING["Nhà trường<br/>đang duyệt"]
    FINAL["Hoàn tất"]
    APPEAL["Khiếu nại"]

    DRAFT -->|Nộp| SUBMITTED
    SUBMITTED -->|Bắt đầu duyệt| CLASS_ING
    CLASS_ING -->|Duyệt| CLASS_ED
    CLASS_ED -->|Bắt đầu duyệt| ADV_ING
    ADV_ING -->|Duyệt| ADV_ED
    ADV_ED -->|Bắt đầu duyệt| SCH_ING
    SCH_ING -->|Duyệt| FINAL
    FINAL -->|Khiếu nại| APPEAL
    APPEAL -->|Giải quyết| FINAL
```

- Ở mỗi giai đoạn, chỉ người dùng có vai trò tương ứng mới được thao tác.
- Phiếu có thể bị xóa/reset bởi cấp có quyền để sinh viên tạo lại từ đầu (không có trạng thái "trả lại" trung gian).
- Deadline học kỳ giới hạn thời gian sinh viên được phép nộp và chỉnh sửa phiếu.
- Mọi thao tác chuyển trạng thái đều được ghi vào `audit_logs`.

---

## Vai trò người dùng

| Vai trò | Phạm vi | Trách nhiệm chính |
| :--- | :--- | :--- |
| **Sinh viên** | Phiếu cá nhân | Tự chấm điểm theo tiêu chí, nộp phiếu, theo dõi tiến độ và gửi khiếu nại. |
| **Ban cán sự** | Lớp được phân công | Rà soát và duyệt phiếu sinh viên trong lớp. Gồm các chức danh: Lớp trưởng, Lớp phó, Bí thư. |
| **Cố vấn học tập** | Các lớp được phân công | Đánh giá và chốt điểm cho sinh viên các lớp mình quản lý (có thể phụ trách nhiều lớp). |
| **Khoa** | Các lớp thuộc khoa | Import sinh viên/lớp, theo dõi tiến độ chấm điểm và quản lý nhân sự thuộc khoa. |
| **Quản trị trường** | Toàn hệ thống | Thiết lập học kỳ, bộ tiêu chí, phân quyền người dùng, xuất báo cáo và phê duyệt cuối. |

> **Phân giải phạm vi lớp phía server:** Quyền truy cập dữ liệu không được suy ra từ phía client. Backend xác định danh sách lớp của người dùng dựa trên bảng phân công, và mọi endpoint — từ danh sách, chi tiết đến thao tác đơn lẻ hay hàng loạt — đều áp dụng cùng nguyên tắc kiểm tra phạm vi.

---

## Kiến trúc hệ thống

Dự án được tổ chức theo dạng monorepo với npm workspaces:

```mermaid
flowchart TB
    USER(["Người dùng"])
    WEB["<strong>packages/web</strong><br/>Next.js 16 · React 19"]
    PROXY["Proxy Rewrite<br/>/proxy-api → API"]
    API["<strong>packages/api</strong><br/>NestJS 11 · REST"]
    SHARED["<strong>packages/shared</strong><br/>Types · Zod · Constants"]
    DB["<strong>packages/database</strong><br/>Prisma ORM · Client"]
    PG[("PostgreSQL")]

    USER --> WEB
    WEB --> PROXY
    PROXY --> API
    WEB -.-> SHARED
    API -.-> SHARED
    API --> DB
    DB --> PG
```

| Package | Vai trò |
| :--- | :--- |
| `packages/web` | Ứng dụng giao diện Next.js với App Router, NextAuth, Tailwind CSS và các dashboard chuyên biệt theo vai trò. |
| `packages/api` | Dịch vụ backend NestJS xử lý toàn bộ logic nghiệp vụ, phân quyền, workflow và API endpoints. |
| `packages/database` | Prisma schema, database client wrapper và migrations. Được cả Web và API sử dụng. |
| `packages/shared` | Các kiểu dữ liệu, hằng số workflow và Zod schemas dùng chung để đảm bảo tính nhất quán. |

---

## Công nghệ sử dụng

| Lớp | Công nghệ | Vai trò |
| :--- | :--- | :--- |
| **Web** | Next.js 16, React 19, TypeScript | Giao diện với App Router và Server/Client Components |
| **Styling** | Tailwind CSS 4, next-themes | Hệ thống thiết kế responsive, hỗ trợ dark mode |
| **API** | NestJS 11, TypeScript | REST API với ValidationPipe, global exception filter |
| **Authentication** | NextAuth, JWT, bcrypt | Xác thực phiên và mã hóa mật khẩu |
| **Database** | PostgreSQL, Prisma ORM | Quản lý schema, truy vấn type-safe, migrations |
| **Validation** | class-validator, Zod | Kiểm tra dữ liệu đầu vào phía server và shared schemas |
| **Security** | Helmet, HPP, express-rate-limit | HTTP headers, chống tham số trùng, giới hạn request |
| **Export** | SheetJS (xlsx) | Xuất dữ liệu báo cáo ra bảng tính |
| **UI** | Lucide React | Bộ icon nhất quán |
| **Tooling** | npm workspaces, dotenv-cli | Quản lý monorepo và biến môi trường |

---

## Cấu trúc thư mục

```text
student-training-score/
├── packages/
│   ├── web/              # Next.js frontend
│   │   ├── app/          # App Router: pages, API routes, components
│   │   └── public/       # Static assets, logos
│   ├── api/              # NestJS backend
│   │   └── src/modules/  # auth, scoring, workflow, appeal, department
│   ├── database/         # Prisma schema và client
│   │   └── prisma/       # schema.prisma, migrations
│   └── shared/           # Constants, validators, types dùng chung
├── Dockerfile.api        # Multi-stage Docker build cho API
├── Dockerfile.web        # Multi-stage Docker build cho Web
├── .env.example          # Mẫu biến môi trường
└── package.json          # Monorepo root với workspace scripts
```

---

## Yêu cầu hệ thống

- **Node.js** 20 LTS (Dockerfiles sử dụng `node:20-bookworm-slim`)
- **npm** có hỗ trợ workspaces
- **PostgreSQL** đang chạy và có thể kết nối

---

## Bắt đầu nhanh

### 1. Clone và cài đặt

```bash
git clone https://github.com/Dokiwich/student-training-score.git
cd student-training-score
npm install
```

### 2. Cấu hình môi trường

macOS / Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Mở tệp `.env` và cập nhật các giá trị — đặc biệt là `DATABASE_URL`. Xem bảng [Biến môi trường](#biến-môi-trường) bên dưới.

> [!WARNING]
> Tệp `.env.example` mặc định `PORT=3000`, nhưng mã nguồn API thực tế mặc định cổng `3001` khi biến `PORT` không được đặt. Đồng thời Next.js cũng mặc định cổng `3000`. Khuyến nghị đặt `PORT=3001` trong `.env` để tránh xung đột.

### 3. Khởi tạo cơ sở dữ liệu

```bash
npm run db:generate
npm run db:push
```

Lệnh `db:push` đồng bộ Prisma schema trực tiếp vào database — phù hợp cho môi trường phát triển.

### 4. Chạy ứng dụng

Mở hai terminal riêng biệt:

**Terminal 1 — API Backend:**

```bash
npm run dev:api
```

**Terminal 2 — Web Frontend:**

```bash
npm run dev:web
```

Sau khi khởi chạy:

- Web: `http://localhost:3000`
- API: `http://localhost:3001` (hoặc cổng trong `PORT`)

---

## Biến môi trường

| Biến | Bắt buộc | Package | Mô tả |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Có | database, api | Chuỗi kết nối PostgreSQL. Ví dụ: `postgresql://user:pass@localhost:5432/dgrl_mit` |
| `PORT` | Không | api | Cổng API. Mặc định trong code: `3001` |
| `NEXTAUTH_SECRET` | Có | web, api | Chuỗi bí mật cho JWT/session. Tạo bằng `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Có | web, api | URL ứng dụng Next.js. Ví dụ: `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | Không | web | URL gốc API cho proxy rewrite. Mặc định: `http://127.0.0.1:3001` |
| `MAILEROO_API_KEY` | Không | api | API key dịch vụ gửi email (nếu sử dụng) |
| `EMAIL_SENDER` | Không | api | Địa chỉ email người gửi hệ thống |

---

## Các lệnh hữu ích

Chạy từ thư mục gốc repository:

| Lệnh | Công dụng |
| :--- | :--- |
| `npm run dev:web` | Khởi chạy frontend development server |
| `npm run dev:api` | Khởi chạy backend development server |
| `npm run db:generate` | Tạo Prisma Client từ schema hiện tại |
| `npm run db:push` | Đồng bộ schema vào database (development) |
| `npm run db:studio` | Mở Prisma Studio — giao diện quản lý dữ liệu trực quan |
| `npm run build --workspace=packages/web` | Build production cho frontend |
| `npm run build --workspace=packages/api` | Build production cho backend |
| `npm run lint --workspace=packages/web` | Kiểm tra lint cho frontend |

---

<details>
<summary><strong>Docker</strong></summary>

Repository cung cấp Dockerfile multi-stage riêng cho Web và API (sử dụng `node:20-bookworm-slim`). Hiện chưa có `docker-compose.yml`.

**Build API:**

```bash
docker build -f Dockerfile.api -t student-score-api .
```

**Build Web:**

```bash
docker build \
  -f Dockerfile.web \
  --build-arg NEXT_PUBLIC_API_URL=http://your-api-host:3001 \
  -t student-score-web .
```

**Chạy:**

```bash
# API (cần truyền biến môi trường)
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="http://localhost:3000" \
  student-score-api

# Web
docker run -p 3000:3000 student-score-web
```

</details>

---

## Trạng thái dự án

| Hạng mục | Trạng thái |
| :--- | :--- |
| Authentication & phân quyền | ✅ Đã triển khai |
| Workflow chấm điểm nhiều cấp | ✅ Đã triển khai |
| Dashboard theo vai trò | ✅ Đã triển khai |
| Phân giải phạm vi lớp phía server | ✅ Đã triển khai |
| Quản lý học kỳ & tiêu chí | ✅ Đã triển khai |
| Khiếu nại & phúc khảo | ✅ Đã triển khai |
| Export XLSX | ✅ Đã triển khai |
| Thông báo | ✅ Đã triển khai |
| Automated tests | ⚠️ Một phần |
| Production deployment | Chưa công bố |

---

## Bảo mật

- Không commit tệp `.env` hoặc chia sẻ `NEXTAUTH_SECRET`.
- Backend sử dụng Helmet, HPP và rate limiting (100 request/15 phút).
- Input validation qua `ValidationPipe` với `whitelist` và `forbidNonWhitelisted`.
- Mật khẩu được hash bằng bcrypt, không lưu plaintext.
- Thay đổi thông tin tài khoản seed trước khi triển khai.
- Chỉ sử dụng dữ liệu giả trong quá trình phát triển.

---

## Đóng góp

1. Fork repository.
2. Tạo branch theo quy cách: `feature/...`, `fix/...`, `docs/...`
3. Commit theo [Conventional Commits](https://www.conventionalcommits.org/):
   ```text
   feat(scoring): thêm chức năng duyệt hàng loạt
   fix(auth): sửa lỗi hết hạn token
   docs(readme): cập nhật hướng dẫn cài đặt
   ```
4. Chạy build để xác nhận không có lỗi:
   ```bash
   npm run build --workspace=packages/api
   npm run build --workspace=packages/web
   ```
5. Tạo Pull Request kèm mô tả rõ ràng.

---

## Giấy phép

Repository hiện chưa công bố giấy phép mã nguồn ở cấp dự án.
Vui lòng liên hệ chủ sở hữu trước khi sử dụng lại hoặc phân phối.

---

<div align="center">
  <sub>
    Xây dựng hướng tới một quy trình đánh giá rèn luyện
    minh bạch, nhất quán và dễ theo dõi hơn.
  </sub>
</div>
