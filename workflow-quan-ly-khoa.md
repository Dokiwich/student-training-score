# Workflow quản lý khoa — Hệ thống chấm điểm sinh viên

> **Phạm vi:** Chỉ bao gồm logic nghiệp vụ cho module Khoa.  
> Database schema và UI component đã hoàn thiện.

---

## 1. Tổng quan luồng dữ liệu theo khoa

```
Khoa (faculty)
 └── Lớp (class)          ← thuộc 1 khoa
      ├── Ban cán sự       ← quản lý 1 lớp
      ├── Cố vấn học tập   ← có thể quản nhiều lớp trong cùng khoa
      └── Sinh viên        ← thuộc 1 lớp
```

Mọi query điểm, người dùng, lớp đều phải **filter theo `faculty_id`** trước khi filter sâu hơn.

---

## 2. CRUD khoa (Admin only)

### 2.1 Tạo khoa mới

```
[Admin] Nhập tên khoa
   → Validate: tên không được trùng, không để trống
   → INSERT faculties (name)
   → Trả về faculty_id mới
   → Log hành động vào audit_log
```

**Lưu ý:** Tạo khoa không tự động tạo lớp. Admin phải tạo lớp riêng sau đó.

### 2.2 Sửa tên khoa

```
[Admin] Chọn khoa → Nhập tên mới
   → Validate: tên mới không trùng với khoa khác
   → UPDATE faculties SET name = ? WHERE id = ?
   → Các lớp, user, điểm con không bị ảnh hưởng (chỉ thay tên)
```

### 2.3 Xoá khoa

```
[Admin] Chọn khoa → Xác nhận xoá
   → Kiểm tra: khoa có lớp nào không?
        ├── Có lớp → Từ chối, báo lỗi: "Cần xoá hoặc chuyển lớp trước"
        └── Không có lớp → DELETE faculties WHERE id = ?
```

> ❌ **Không cho xoá cascade.** Tránh mất dữ liệu điểm không thể khôi phục.

---

## 3. Phân quyền theo khoa

Mỗi user khi đăng nhập, hệ thống xác định `scope` dựa trên role:

| Role | Scope khoa |
|---|---|
| Admin | Tất cả khoa |
| Cố vấn học tập | Chỉ khoa mình phụ trách (lấy qua `advisor_classes → class → faculty`) |
| Ban cán sự | Chỉ khoa của lớp mình |
| Sinh viên | Chỉ khoa của lớp mình |

### Logic lấy faculty scope

```javascript
// Middleware gọi mỗi request
async function getFacultyScope(userId, role) {
  if (role === 'admin') return null; // null = không filter, lấy tất cả

  if (role === 'advisor') {
    // Lấy tất cả faculty mà cố vấn phụ trách
    return db.query(`
      SELECT DISTINCT c.faculty_id
      FROM advisor_classes ac
      JOIN classes c ON ac.class_id = c.id
      WHERE ac.advisor_id = ?
    `, [userId]);
  }

  // BCS và sinh viên: lấy faculty từ class của họ
  return db.query(`
    SELECT faculty_id FROM classes
    WHERE id = (SELECT class_id FROM users WHERE id = ?)
  `, [userId]);
}
```

---

## 4. Gán cố vấn học tập vào khoa/lớp

```
[Admin] Chọn cố vấn → Chọn lớp (thuộc khoa nào đó)
   → Validate: lớp đó chưa có cố vấn chính? (tuỳ rule trường)
   → INSERT advisor_classes (advisor_id, class_id)
   → Cố vấn ngay lập tức thấy lớp đó trong dashboard
```

**Gán nhiều lớp cho 1 cố vấn:**

```
Lặp lại bước trên cho từng lớp
→ Không cần tạo tài khoản mới
→ 1 cố vấn có thể quản lớp thuộc nhiều khoa khác nhau
```

---

## 5. Chuyển lớp sang khoa khác (edge case)

```
[Admin] Chọn lớp → Chọn khoa mới
   → Cảnh báo: "Toàn bộ sinh viên trong lớp sẽ chuyển khoa theo"
   → Xác nhận
   → UPDATE classes SET faculty_id = ? WHERE id = ?
   → Không cần cập nhật bảng users (user gắn với class_id, không phải faculty_id)
```

---

## 6. Báo cáo tổng hợp theo khoa

```
[Admin / Cố vấn] Chọn khoa → Chọn kỳ học
   → Query: SELECT avg(score), count(students) GROUP BY class_id
            WHERE class.faculty_id = ?
   → Render bảng: từng lớp trong khoa + điểm trung bình + số SV
   → Export CSV nếu cần
```

**Cố vấn chỉ thấy lớp mình phụ trách**, dù chọn khoa nào — scope filter vẫn áp dụng.

---

## 7. Checklist tích hợp

- [ ] Mọi API endpoint có tham số `faculty_id` đều phải qua middleware scope check
- [ ] Dropdown chọn khoa ở UI tự filter theo role (admin thấy tất cả, cố vấn chỉ thấy khoa mình)
- [ ] Khi tạo lớp mới bắt buộc chọn khoa (`faculty_id NOT NULL`)
- [ ] Audit log ghi lại mọi thay đổi trên bảng `faculties`
- [ ] Test case: cố vấn không thể xem điểm lớp thuộc khoa khác dù biết `class_id`
