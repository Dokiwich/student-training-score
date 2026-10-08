# Quy Chuẩn Nghiệp Vụ Chấm Điểm (Scoring Domain Rules)

Vị trí áp dụng: Tất cả logic chấm điểm, tính toán kết quả rèn luyện ở cả Backend và Frontend.

## 1. Nguyên tắc bảo mật kép (Double-Check Security)
- **Không tin tưởng Frontend:** Mọi ràng buộc điểm tối đa, điểm tối thiểu, và điều kiện nhập trên UI bắt buộc phải có validation tương đương tại Backend.

## 2. Ràng buộc nghiệp vụ bất biến
1. **Chống Cross-Semester Injection:** Khi lưu điểm, bắt buộc đối soát `criteriaId` thuộc đúng `criteria_version_id` gắn liền với `semester_id` của phiếu điểm hiện tại.
2. **Chỉ chấm điểm Node Lá (Leaf-Node Only):** Tuyệt đối không cho phép nhập điểm vào tiêu chí cha/nhóm. Chỉ chấp nhận điểm khi tiêu chí không có tiêu chí con.
3. **Bắt buộc minh chứng (Evidence Enforcement):** Nếu tiêu chí có `require_evidence === 1`, Backend bắt buộc từ chối (`BadRequestException`) nếu thiếu `proofUrl`.
4. **Loại trừ lẫn nhau (Mutual Exclusivity Sweep):** Với các tiêu chí con thuộc nhóm cha `RADIO` hoặc `OPTIONS`, Backend bắt buộc quét và xóa điểm của các tiêu chí anh em trong cùng nhóm khi tiêu chí mới được chọn (`enforceMutualExclusivity`).
5. **Khóa can thiệp xếp loại (Demotion Lock):** Khi Admin xếp loại thủ công (ví dụ: kỷ luật hạ bậc), phiếu điểm phải được đưa về `FINALIZED` để ngăn việc tự động hoàn tác phân loại khi điểm số thay đổi.
