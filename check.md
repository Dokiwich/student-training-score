# Báo cáo tối ưu hiệu năng hệ thống

Dựa trên log request thực tế thu thập từ ứng dụng (Next.js + Prisma + PostgreSQL).

---

## Tổng quan vấn đề

| Endpoint | Latency quan sát được | Mức độ | Vấn đề chính |
|---|---|---|---|
| `/api/auth/session` | 663 – 1329ms | 🔴 Nghiêm trọng | Session check chậm bất thường, có thể query DB mỗi request |
| `/api/semester/active` | 250 – 700ms (ổn định) | 🔴 Nghiêm trọng | Dữ liệu gần như static nhưng không cache, bị polling liên tục |
| `/api/notifications?limit=30` | 510 – 1270ms | 🔴 Nghiêm trọng | Thiếu index cho sort, bị polling liên tục |
| `/api/scoring-history` | ~790 – 1230ms (ổn định) | 🟠 Cao | Có thể đang tính tổng điểm thủ công (N+1) thay vì dùng cột denormalized |
| `/api/appeals` | 620 – 1670ms (dao động mạnh) | 🟠 Cao | Dao động lớn → nghi ngờ thiếu index, Seq Scan không ổn định |
| `PATCH /api/notifications` | 789ms | 🟡 Trung bình | Update đơn giản nhưng chậm, có thể do transaction/lock |
| Các trang `/class-president?filter=...` | 25 – 60ms | ✅ Tốt | Không cần tối ưu |

**Nhận định chung:** Vấn đề lớn nhất không phải là một truy vấn SQL đơn lẻ, mà là **kiến trúc gọi API lặp lại (polling) kết hợp với thiếu cache** ở tầng dữ liệu gần như không đổi.

---

## 1. Vấn đề: Polling quá dày (root cause lớn nhất)

**Hiện tượng:** `/api/semester/active` và `/api/notifications?limit=30` lặp lại theo cặp, đều đặn mỗi vài giây trong suốt phiên làm việc.

**Nguyên nhân khả dĩ:** `setInterval` hoặc `useEffect` phía frontend không có cleanup, hoặc interval quá ngắn.

**Hướng giải quyết:**
- Thay polling bằng **WebSocket hoặc Server-Sent Events (SSE)** cho notifications — chỉ đẩy dữ liệu khi có thay đổi thật sự.
- Nếu vẫn giữ polling, dùng **React Query** với `refetchInterval` hợp lý (30–60s) thay vì tự viết `setInterval`, kèm `staleTime` để tránh gọi lại khi dữ liệu chưa cũ.
- Với `semester/active`: dữ liệu gần như không đổi trong ngày → không cần polling, chỉ cần fetch 1 lần lúc load trang + cache.

---

## 2. Vấn đề: `/api/semester/active` chậm ổn định (~250–330ms)

**Hiện tượng:** Bảng `semesters` chỉ query theo `is_active` — quá đơn giản để chậm như vậy, và độ trễ gần như cố định (dấu hiệu của việc luôn phải tính toán lại, không có cache).

**Hướng giải quyết:**

a) **Thêm index cho cột lọc:**
```sql
CREATE INDEX idx_semester_active ON semesters (is_active) WHERE is_active = 1;
```

b) **Kiểm tra lại code Prisma** — tránh `include` kéo theo quan hệ nặng không cần thiết:
```js
// Tệ - kéo theo dữ liệu không cần dùng
prisma.semesters.findFirst({
  where: { is_active: 1 },
  include: { criteria_versions: true, semester_enrollments: true }
})

// Tốt - chỉ lấy field cần thiết
prisma.semesters.findFirst({
  where: { is_active: 1 },
  select: { id: true, code: true, name: true, status: true, student_deadline: true }
})
```

c) **Cache vào Redis/memory** (ưu tiên cao nhất) — dữ liệu này chỉ đổi khi admin thao tác:
```js
const cached = await redis.get('semester:active');
if (cached) return JSON.parse(cached);

const data = await prisma.semesters.findFirst({ where: { is_active: 1 }, select: {...} });
await redis.set('semester:active', JSON.stringify(data), 'EX', 300); // TTL 5 phút
return data;
```
Nhớ **invalidate cache** khi admin đổi/tạo semester mới.

---

## 3. Vấn đề: `/api/notifications` chậm (510 – 1270ms)

**Nguyên nhân khả dĩ:**
- Thiếu composite index cho việc sort theo thời gian.
- Có thể đang join thêm bảng `users` hoặc xử lý nặng cột `data: Json`.

**Hướng giải quyết:**

a) **Thêm index đúng pattern query** (giả định query có `WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`):
```sql
CREATE INDEX idx_notif_user_created ON notifications (user_id, created_at DESC);
```

b) **Kiểm tra N+1** — đảm bảo không loop query riêng lẻ để lấy thông tin liên quan cho từng notification.

c) **Với `PATCH /api/notifications` (789ms):** kiểm tra có đang update từng row một trong loop không, nên dùng `updateMany`:
```js
// Tốt - 1 query duy nhất
await prisma.notifications.updateMany({
  where: { user_id, is_read: 0 },
  data: { is_read: 1, read_at: new Date() }
});
```

---

## 4. Vấn đề: `/api/scoring-history` chậm ổn định (~790 – 1230ms)

**Nguyên nhân khả dĩ:** Đang tính lại tổng điểm ở application code (N+1) thay vì dùng các cột đã denormalized sẵn (`final_total`, `classification`) trên bảng `scoring_sheets`.

**Hướng giải quyết:**
```js
// Tệ - N+1, tính lại điểm thủ công mỗi lần
const sheets = await prisma.scoring_sheets.findMany({ where: {...} });
for (const sheet of sheets) {
  const details = await prisma.score_details.findMany({ where: { scoring_sheet_id: sheet.id } });
  // tính tổng thủ công...
}

// Tốt - 1 query, dùng cột đã có sẵn
const sheets = await prisma.scoring_sheets.findMany({
  where: { semester_enrollments: { user_id } },
  select: {
    id: true, final_total: true, classification: true,
    status: true, created_at: true
  },
  orderBy: { created_at: 'desc' }
});
```

Nếu bắt buộc phải lấy chi tiết điểm, dùng `include` có chọn lọc thay vì query rời từng bảng.

---

## 5. Vấn đề: `/api/appeals` dao động mạnh (620 – 1670ms)

**Nguyên nhân khả dĩ:** Dao động lớn thường là dấu hiệu PostgreSQL đôi khi Seq Scan (do thiếu index trên cột filter thực tế đang dùng).

**Hướng giải quyết:**

a) Kiểm tra lại các cột đang filter trong query thực tế — nếu có lọc theo `dept_decision`, `resolved_by`, hoặc kết hợp nhiều điều kiện, cần thêm composite index:
```sql
-- Ví dụ nếu hay lọc: WHERE status = ? AND resolved_by IS NULL
CREATE INDEX idx_appeal_status_resolver ON appeals (status, resolved_by);
```

b) Chạy `EXPLAIN ANALYZE` để xác nhận có đang Seq Scan không:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM appeals WHERE status = 'PENDING' ORDER BY created_at DESC;
```

---

## 6. Vấn đề: `/api/auth/session` cực kỳ chậm (663 – 1329ms)

**Đây là vấn đề nghiêm trọng nhất về mặt kiến trúc.** Session check chạy ở hầu như mọi trang, nên phải là endpoint nhanh nhất hệ thống, không phải chậm nhất.

**Nguyên nhân khả dĩ:**
- Đang query DB (users + user_roles join) để validate session ở mỗi request thay vì dùng JWT stateless.
- Dùng thuật toán JWT nặng (RS256) không cần thiết cho use case này.

**Hướng giải quyết:**

a) **Cache session vào Redis** với TTL ngắn (30–60s):
```js
const cached = await redis.get(`session:${sessionId}`);
if (cached) return JSON.parse(cached);
// ... query DB, sau đó cache lại
await redis.set(`session:${sessionId}`, JSON.stringify(sessionData), 'EX', 60);
```

b) **Dùng JWT với payload đủ thông tin** (`user_id`, `role`, `session_version`) để tránh phải hit DB mỗi lần — chỉ cần verify chữ ký, không cần query.

c) Nếu cần check `session_version` (đã có sẵn cột này trong bảng `users` để revoke session) — chỉ query 1 cột duy nhất, có index, thay vì load toàn bộ user + roles.

---

## Tổng hợp: Index cần bổ sung

```sql
-- Semester active check
CREATE INDEX idx_semester_active ON semesters (is_active) WHERE is_active = 1;

-- Notifications sort theo thời gian
CREATE INDEX idx_notif_user_created ON notifications (user_id, created_at DESC);

-- Appeals filter kết hợp (điều chỉnh theo query thực tế)
CREATE INDEX idx_appeal_status_resolver ON appeals (status, resolved_by);

-- Scoring sheets nếu hay sort theo updated_at trong 1 status cụ thể
CREATE INDEX idx_sheet_status_updated ON scoring_sheets (status, updated_at DESC);
```

> **Lưu ý:** Đây là index gợi ý dựa trên tên endpoint và schema. Cần chạy `EXPLAIN ANALYZE` trên query thực tế để xác nhận trước khi áp dụng vào production.

---

## Thứ tự ưu tiên xử lý

1. **Sửa polling ở frontend** — impact lớn nhất, ít rủi ro nhất, làm trước tiên.
2. **Cache `session` và `semester/active`** vào Redis — 2 endpoint tần suất gọi cao nhất, dữ liệu gần như static.
3. **Thêm index cho `notifications` và `appeals`.**
4. **Refactor `scoring-history`** để dùng cột denormalized, tránh N+1.
5. **Chạy `EXPLAIN ANALYZE`** cho tất cả query trên để xác nhận hiệu quả sau khi áp dụng.

---

## Công cụ hỗ trợ theo dõi lâu dài

- **`EXPLAIN (ANALYZE, BUFFERS)`** — chạy định kỳ cho các query trong danh sách trên.
- **`pg_stat_statements`** — bật extension này trong PostgreSQL để tự động thống kê query nào chậm nhất, chạy nhiều nhất, không cần đoán từ log.
- **Prisma query logging** (`log: ['query']`) — để đối chiếu query thực tế được sinh ra so với code viết, phát hiện N+1 sớm.