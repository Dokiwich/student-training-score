# 🔐 Tài liệu Kiểm thử Hệ thống Xác thực Tài khoản
> Phiên bản: 1.0.0 | Ngày: 23/05/2026 | Người lập: ___________

---

## 1. Tổng quan

Tài liệu này mô tả các ca kiểm thử (test case) cho hệ thống xác thực tài khoản người dùng, bao gồm các chức năng: đăng ký, đăng nhập, quên mật khẩu, xác thực hai yếu tố (2FA) và quản lý phiên đăng nhập.

### Phạm vi kiểm thử

| Module | Mô tả |
|---|---|
| Đăng nhập | Xác thực bằng tài khoản/mật khẩu |
| Quản lý phiên | Token, logout, đa thiết bị |

---

## 2. Môi trường kiểm thử

- **Môi trường:** Staging / UAT
- **Trình duyệt:** Chrome 124+, Firefox 125+, Safari 17+
- **Công cụ:** Postman, Jest, Playwright
- **Base URL:** `https://staging.example.com`

---

## 3. Quy ước đánh dấu kết quả

| Ký hiệu | Ý nghĩa |
|---|---|
| ✅ Pass | Test case vượt qua |
| ❌ Fail | Test case thất bại |
| ⏳ Pending | Chưa kiểm thử |
| ⚠️ Blocked | Bị chặn bởi lỗi khác |

---


## 5. TC-LOGIN — Đăng nhập

### TC-LOGIN-001: Đăng nhập thành công

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Điều kiện tiên quyết** | Tài khoản đã được xác minh |
| **Dữ liệu đầu vào** | Email: `test@example.com`, Mật khẩu: `Test@12345` |
| **Kết quả mong đợi** | Đăng nhập thành công, nhận `access_token` + `refresh_token`, chuyển đến Dashboard. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-LOGIN-002: Đăng nhập sai mật khẩu

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Dữ liệu đầu vào** | Email hợp lệ, Mật khẩu: `WrongPass` |
| **Kết quả mong đợi** | Thông báo lỗi: *"Email hoặc mật khẩu không đúng"*. Không tiết lộ thông tin cụ thể. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-LOGIN-003: Khóa tài khoản sau nhiều lần đăng nhập sai

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Các bước thực hiện** | Đăng nhập sai mật khẩu 5 lần liên tiếp với cùng một tài khoản. |
| **Kết quả mong đợi** | Tài khoản bị tạm khóa, hiển thị thông báo và thời gian chờ mở khóa (ví dụ: 30 phút). |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---


### TC-LOGIN-005: Đăng nhập với email để trống

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Trung bình |
| **Dữ liệu đầu vào** | Email: *(để trống)*, Mật khẩu: `Test@12345` |
| **Kết quả mong đợi** | Lỗi validate: *"Vui lòng nhập email"*. Form không submit. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---



## 9. TC-SESSION — Quản lý phiên đăng nhập

### TC-SESSION-001: Access token hết hạn — tự động refresh

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Các bước thực hiện** | 1. Đăng nhập, nhận `access_token` (TTL: 15 phút). 2. Đợi token hết hạn. 3. Thực hiện một request bất kỳ. |
| **Kết quả mong đợi** | Hệ thống tự dùng `refresh_token` để cấp `access_token` mới, không yêu cầu đăng nhập lại. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-SESSION-002: Đăng xuất — thu hồi token

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Các bước thực hiện** | 1. Đăng nhập, nhận token. 2. Nhấn Đăng xuất. 3. Dùng lại `access_token` cũ để gọi API. |
| **Kết quả mong đợi** | Đăng xuất thành công, token bị thu hồi, API trả về `401 Unauthorized`. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-SESSION-003: Đăng xuất khỏi tất cả thiết bị

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Trung bình |
| **Các bước thực hiện** | 1. Đăng nhập trên 2 thiết bị khác nhau. 2. Trên thiết bị A, chọn *"Đăng xuất khỏi tất cả thiết bị"*. |
| **Kết quả mong đợi** | Cả hai thiết bị bị đăng xuất, toàn bộ refresh token bị thu hồi. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-SESSION-004: Phát hiện đăng nhập từ thiết bị mới

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Trung bình |
| **Các bước thực hiện** | Đăng nhập từ trình duyệt / thiết bị chưa từng được sử dụng trước đó. |
| **Kết quả mong đợi** | Email thông báo đăng nhập mới được gửi đến chủ tài khoản, bao gồm thông tin thiết bị và địa điểm. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

## 10. TC-SEC — Bảo mật & tấn công

### TC-SEC-001: SQL Injection vào form đăng nhập

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Dữ liệu đầu vào** | Email: `' OR '1'='1`, Mật khẩu: `anything` |
| **Kết quả mong đợi** | Đăng nhập thất bại, không có dữ liệu bị rò rỉ. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-SEC-002: Brute-force bảo vệ bởi CAPTCHA

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Các bước thực hiện** | Gửi request đăng nhập thất bại liên tục (>10 lần trong 1 phút) từ cùng IP. |
| **Kết quả mong đợi** | Hệ thống hiển thị CAPTCHA hoặc chặn IP tạm thời. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-SEC-003: CSRF — thử thực hiện đăng xuất từ trang ngoài

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Các bước thực hiện** | Gửi request `POST /logout` từ một origin khác, không có CSRF token hợp lệ. |
| **Kết quả mong đợi** | Request bị từ chối với lỗi `403 Forbidden`. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

### TC-SEC-004: Mật khẩu được lưu dưới dạng hash (bcrypt)

| Trường | Nội dung |
|---|---|
| **Mức độ ưu tiên** | Cao |
| **Phương pháp kiểm tra** | Truy vấn trực tiếp database, kiểm tra cột `password`. |
| **Kết quả mong đợi** | Giá trị cột `password` là chuỗi bcrypt hash (bắt đầu bằng `$2b$`), không phải plain text. |
| **Kết quả thực tế** | |
| **Trạng thái** | ⏳ |

---

## 11. Tổng hợp kết quả

| Module | Tổng TC | Pass | Fail | Pending |
|---|---|---|---|---|
| Đăng nhập (LOGIN) | 4 | | | 4 |
| Quản lý phiên (SESSION) | 4 | | | 4 |
| Bảo mật (SEC) | 4 | | | 4 |
| **Tổng cộng** | **12** | **0** | **0** | **12** |

---

## 12. Ghi chú & Rủi ro


- TC-SESSION-001 yêu cầu chỉnh TTL của access token về thời gian ngắn (1–2 phút) trong môi trường test.
- TC-SEC-004 yêu cầu quyền truy cập database trực tiếp, chỉ thực hiện trên môi trường staging.
- Tất cả email kiểm thử nên dùng Mailhog hoặc Mailtrap để không gửi ra bên ngoài.

---

*Tài liệu này được tạo cho mục đích kiểm thử hệ thống xác thực. Cập nhật kết quả thực tế sau mỗi lần chạy kiểm thử.*