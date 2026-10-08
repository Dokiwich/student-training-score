# Hướng Dẫn & Điều Phối AI (Master AGENTS.md)

## 1. Quyền quyết định của chủ dự án

Chủ dự án là người quyết định cuối cùng về kiến trúc, cấu trúc thư mục, công nghệ, dependency, công cụ, quyền truy cập, schema/migration, API, commit, push và deploy.

AI được tự đọc, phân tích, kiểm tra và đề xuất. AI chỉ được tự sửa các thay đổi cục bộ đã nằm trong phạm vi yêu cầu, không đổi contract hay cấu trúc hệ thống.

| Mức rủi ro | Hành vi | Quyền hạn AI |
| :--- | :--- | :--- |
| **Đọc / Phân tích** | Đọc code, tìm kiếm, chạy test/lint chỉ-đọc, đề xuất phương án | **Tự thực hiện**, không cần xin phép. |
| **Thay đổi cục bộ** | Sửa lỗi nhỏ đúng phạm vi giao, thêm test phù hợp | **Tự thực hiện**. Nếu làm đổi hành vi/UX/API/schema: **Phải hỏi**. |
| **Tác động lớn** | Migration DB, cài dependency/tool/plugin, đổi kiến trúc/thư mục, commit/push/deploy, xóa/ghi đè dữ liệu | **Bắt buộc trình phương án & chờ duyệt**. |

Trước mọi thay đổi có ảnh hưởng rộng, AI phải nêu:
1. Vấn đề và phạm vi ảnh hưởng (blast radius).
2. Ít nhất một phương án thay thế cùng trade-off.
3. Phương án khuyến nghị, rủi ro và kế hoạch rollback.
4. Chờ phê duyệt rõ ràng từ chủ dự án trước khi thực hiện.

---

## 2. Cây Thư Mục Luật & Hướng Dẫn Điều Hướng

Khi thực hiện nhiệm vụ ở từng vị trí cụ thể, AI **bắt buộc đọc và tuân thủ luật riêng** tại vị trí đó:

```
d:\duan\
├── AGENTS.md                            # [Bạn đang ở đây] Quyền hạn & Cây điều hướng luật
├── .agents/
│   ├── AGENTS.md                        # Luật bất biến & nguyên tắc chung toàn dự án
│   ├── rules/                           # THƯ MỤC LUẬT CHUYÊN BIỆT THEO TỪNG VỊ TRÍ
│   │   ├── database/RULE.md             # Đọc khi đụng: PostgreSQL, Prisma, $transaction, index, migration
│   │   │   └── Rule DB.md               # Tra cứu khi cần thiết kế schema/database chuyên sâu (2.187 dòng)
│   │   ├── api/RULE.md                  # Đọc khi đụng: NestJS, API routes, IDOR, verifyActorRole, HTTP methods
│   │   ├── web/RULE.md                  # Đọc khi đụng: Next.js, ScoringForm, UI data-driven, dynamic cache
│   │   └── scoring/RULE.md              # Đọc khi đụng: Quy tắc chấm điểm, leaf-node, evidence, radio/options
│   ├── worklog/                         # THƯ MỤC LƯU TẠM & LỊCH SỬ CÔNG VIỆC
│   │   ├── CURRENT_TASK.md              # Kiểm tra trước khi làm và cập nhật tiến độ dở dang
│   │   ├── sessions/                    # Lưu nhật ký sau mỗi phiên hoàn thành nhiệm vụ
│   │   └── decisions/                   # Lưu các quyết định kiến trúc đã được duyệt (ADR)
│   └── skills/
│       └── dokiwich_project_knowledge/  # Skill tra cứu tình huống bug cũ (on-demand)
└── packages/
    ├── database/AGENTS.md               # Tự nạp khi làm việc trong packages/database
    ├── api/AGENTS.md                    # Tự nạp khi làm việc trong packages/api
    └── web/AGENTS.md                    # Tự nạp khi làm việc trong packages/web
```

---

## 3. Quy Trình Phân Tích Mã (GitNexus & Code Intelligence)

1. **Trước khi sửa function/class/method:** Bắt buộc chạy `impact({target: "symbolName", direction: "upstream"})` và báo blast radius (caller, process, risk). Cảnh báo nếu mức `HIGH` hoặc `CRITICAL`.
2. **Trước khi commit:** Bắt buộc chạy `detect_changes()` để đảm bảo thay đổi đúng phạm vi mong muốn.
3. **Cấm đổi tên bằng find-and-replace:** Dùng call-graph rename.
4. **Dự phòng công cụ:** Ưu tiên công cụ phân tích mã được cấp (GitNexus, CodeGraph). Nếu không khả dụng, dùng grep/search cơ bản tương đương và nêu rõ giới hạn.

---

## 4. Báo Cáo Kết Quả Chuẩn

Mỗi phản hồi sau khi thực hiện công việc phải nêu:
1. Đã đổi gì (file nào, thay đổi gì).
2. Vì sao đổi (gốc rễ vấn đề).
3. Rủi ro & cách rollback nếu có.
4. Việc chưa làm vì chờ chủ dự án phê duyệt (nếu có).
