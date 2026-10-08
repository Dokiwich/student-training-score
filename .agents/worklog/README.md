# Quy Chuẩn Lưu Trữ Nhật Ký Công Việc (.agents/worklog)

Thư mục này dùng để lưu lại ngữ cảnh, lịch sử thao tác, và trạng thái công việc qua các phiên làm việc của AI và chủ dự án.

## Cấu trúc thư mục

```
.agents/worklog/
├── README.md               # File này (hướng dẫn quy chuẩn)
├── CURRENT_TASK.md         # Trạng thái nhiệm vụ đang thực hiện dở dang (để resume khi mở phiên mới)
├── sessions/               # Nhật ký chi tiết từng phiên làm việc (YYYY-MM-DD_<tên-nhiệm-vụ>.md)
└── decisions/              # Lưu các quyết định kiến trúc / phê duyệt từ chủ dự án (ADR)
```

## 1. Định dạng file `CURRENT_TASK.md`
Cập nhật liên tục khi làm việc dở dang:
- **Nhiệm vụ:** Mô tả ngắn việc đang làm.
- **Tiến độ:** Các bước đã xong [x] và chưa xong [ ].
- **File đang xử lý:** Danh sách file liên quan.
- **Vấn đề / Chờ duyệt:** Nếu có thao tác lớn cần xin phép chủ dự án.

## 2. Định dạng file trong `sessions/`
Tạo file mới khi hoàn thành 1 đầu việc: `sessions/YYYY-MM-DD_<tên-task>.md`
- **Mục tiêu:** Yêu cầu ban đầu của chủ dự án.
- **Thay đổi đã thực hiện:** Danh sách file kèm diff tóm tắt.
- **Kiểm chứng:** Kết quả chạy test, lint, hoặc kiểm tra thủ công.
- **Rủi ro & Rollback:** Tác động phụ và cách khôi phục nếu lỗi.
- **Việc chưa làm (chờ duyệt):** Các hạng mục vượt quyền hạn hoặc ngoài phạm vi.

## 3. Định dạng file trong `decisions/`
Tạo khi có quyết định kiến trúc lớn: `decisions/ADR-001-<tên-quyết-định>.md`
- **Ngữ cảnh & Vấn đề.**
- **Các phương án cân nhắc & Trade-off.**
- **Quyết định cuối cùng của chủ dự án.**
