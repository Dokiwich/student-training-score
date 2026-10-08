export interface CriterionMeta {
  col: string;
  code: string;
  dieuNum: number;
  title: string;
  point: number;
  score_type: "FIXED" | "OPTIONS" | "RANGE" | "BOOLEAN" | "DEDUCTION" | "NUMBER";
  noteCol: string;
}

export const CRITERIA_52_METADATA: CriterionMeta[] = [
  {
    "col": "D1_1_1",
    "code": "1.1.1",
    "dieuNum": 1,
    "title": "Học tập tại Trường Đại học Công nghệ Miền Đông",
    "point": 5,
    "score_type": "FIXED",
    "noteCol": "Ghi_chu_D1_1_1"
  },
  {
    "col": "D1_1_2",
    "code": "1.1.2",
    "dieuNum": 1,
    "title": "Kết quả học tập (xếp loại theo điểm TB tích lũy)",
    "point": 5,
    "score_type": "OPTIONS",
    "noteCol": "Ghi_chu_D1_1_2"
  },
  {
    "col": "D1_1_3",
    "code": "1.1.3",
    "dieuNum": 1,
    "title": "Thiếu ý thức trong học tập (vi phạm quy định học vụ, khảo thí)",
    "point": -2,
    "score_type": "DEDUCTION",
    "noteCol": "Ghi_chu_D1_1_3"
  },
  {
    "col": "D1_2_1",
    "code": "1.2.1",
    "dieuNum": 1,
    "title": "Thành viên câu lạc bộ, đội, nhóm về học tập, nghiên cứu khoa học tại Trường",
    "point": 1,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D1_2_1"
  },
  {
    "col": "D1_2_2",
    "code": "1.2.2",
    "dieuNum": 1,
    "title": "Tham dự các buổi hội thảo, báo cáo chuyên đề, tọa đàm, huấn luyện kỹ năng, thi cử, sinh hoạt",
    "point": 1,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D1_2_2"
  },
  {
    "col": "D1_2_3",
    "code": "1.2.3",
    "dieuNum": 1,
    "title": "Dự thi các cuộc thi học thuật tại Trường",
    "point": 2,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D1_2_3"
  },
  {
    "col": "D1_2_4",
    "code": "1.2.4",
    "dieuNum": 1,
    "title": "Thành viên đội tuyển Trường dự thi các cuộc thi cấp trên về học thuật, khoa học",
    "point": 3,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D1_2_4"
  },
  {
    "col": "D1_2_5",
    "code": "1.2.5",
    "dieuNum": 1,
    "title": "Thực hiện nghiên cứu khoa học (công trình nghiên cứu khoa học, bài báo khoa học, bài viết đăng ký kỷ yếu hội thảo khoa học) ",
    "point": 4,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D1_2_5"
  },
  {
    "col": "D1_2_6",
    "code": "1.2.6",
    "dieuNum": 1,
    "title": "Học phần Thực tập và tốt nghiệp được đánh giá đạt",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D1_2_6"
  },
  {
    "col": "D1_2_7",
    "code": "1.2.7",
    "dieuNum": 1,
    "title": "Thiếu ý thức trong tham gia hoạt động học thuật, khoa học",
    "point": -2,
    "score_type": "DEDUCTION",
    "noteCol": "Ghi_chu_D1_2_7"
  },
  {
    "col": "D2_1",
    "code": "2.1",
    "dieuNum": 2,
    "title": "Sinh hoạt tại Trường Đại học Công nghệ Miền Đông",
    "point": 10,
    "score_type": "FIXED",
    "noteCol": "Ghi_chu_D2_1"
  },
  {
    "col": "D2_2",
    "code": "2.2",
    "dieuNum": 2,
    "title": "Tham gia Tuần lễ định hướng / Tuần sinh hoạt công dân",
    "point": 5,
    "score_type": "FIXED",
    "noteCol": "Ghi_chu_D2_2"
  },
  {
    "col": "D2-3",
    "code": "2.3",
    "dieuNum": 2,
    "title": "Thiếu ý thức chấp hành Nội quy, vắng sinh hoạt lớp (vi phạm bị xử lý)",
    "point": -2,
    "score_type": "DEDUCTION",
    "noteCol": "Ghi_chu_D2_3"
  },
  {
    "col": "D2_4",
    "code": "2.4",
    "dieuNum": 2,
    "title": "Tham gia đầy đủ, đúng hạn BHYT/BHXH theo thông báo của Trường",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D2_4"
  },
  {
    "col": "D3_1_1",
    "code": "3.1.1",
    "dieuNum": 3,
    "title": "Rèn luyện tại Trường Đại học Công nghệ Miền Đông",
    "point": 5,
    "score_type": "FIXED",
    "noteCol": "Ghi_chu_D3_1_1"
  },
  {
    "col": "D3_1_2",
    "code": "3.1.2",
    "dieuNum": 3,
    "title": "Thiếu ý thức phòng chống tội phạm và các tệ nạn xã hội (không tham gia các đợt tuyên truyền, vi phạm bị xử lý nhưng chưa đến mức xử lý kỷ luật)",
    "point": -2,
    "score_type": "DEDUCTION",
    "noteCol": "Ghi_chu_D3_1_2"
  },
  {
    "col": "D3_2_1",
    "code": "3.2.1",
    "dieuNum": 3,
    "title": "Thành viên CLB, đội, nhóm hoạt động phong trào, tình nguyện tại Trường",
    "point": 1,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D3_2_1"
  },
  {
    "col": "D3_2_2",
    "code": "3.2.2",
    "dieuNum": 3,
    "title": "Tham dự các buổi sinh hoạt, hoạt động chính trị, xã hội, văn hóa, văn nghệ, thể thao tại Trường (khán giả, cổ vũ, tuyển thành viên…) ",
    "point": 1,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D3_2_2"
  },
  {
    "col": "D3_2_3",
    "code": "3.2.3",
    "dieuNum": 3,
    "title": "Dự thi các cuộc thi về chính trị tư tưởng, văn hóa, văn nghệ, thể thao; Tham gia hoạt động công ích, tình nguyện, công tác xã hội tại Trường.",
    "point": 2,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D3_2_3"
  },
  {
    "col": "D3_2_4",
    "code": "3.2.4",
    "dieuNum": 3,
    "title": "Thành viên đội tuyển Trường dự thi các cuộc thi, hoạt động cấp trên về chính trị, xã hội, văn hóa, văn nghệ, thể thao, phòng chống tội phạm và các tệ nạn xã hội",
    "point": 3,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D3_2_4"
  },
  {
    "col": "D3_2_5",
    "code": "3.2.5",
    "dieuNum": 3,
    "title": "Hoàn thành thực tập tốt nghiệp",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D3_2_5"
  },
  {
    "col": "D3_3",
    "code": "3.3",
    "dieuNum": 3,
    "title": "Thiếu ý thức trong tham gia hoạt động, chính trị, xã hội, văn hóa, văn nghệ, thể thao, công ích, tình nguyện, công tác xã hội",
    "point": -2,
    "score_type": "DEDUCTION",
    "noteCol": "Ghi_chu_D3_3"
  },
  {
    "col": "D4_1",
    "code": "4.1",
    "dieuNum": 4,
    "title": "Sinh hoạt tại cộng đồng",
    "point": 15,
    "score_type": "FIXED",
    "noteCol": "Ghi_chu_D4_1"
  },
  {
    "col": "D4_2_1",
    "code": "4.2.1",
    "dieuNum": 4,
    "title": "Tích cực tham gia hoạt động tại địa phương, nơi cư trú do doanh nghiệp, tổ chức phi chính phủ tổ chức",
    "point": 1,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D4_2_1"
  },
  {
    "col": "D4_2_2",
    "code": "4.2.2",
    "dieuNum": 4,
    "title": "Tham gia hoạt động tình nguyện vì cộng đồng do chính quyền, tổ chức chính trị - xã hội, trường học tại địa phương tổ chức (hiến máu tình nguyện, hoạt động công ích, tình nguyện, công tác xã hội, tiếp sức mùa thi, tư vấn tuyển sinh)",
    "point": 2,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D4_2_2"
  },
  {
    "col": "D4_2_3",
    "code": "4.2.3",
    "dieuNum": 4,
    "title": "Nhận giấy chứng nhận tham gia chiến dịch tình nguyện sinh viên hè của Trường Đại học Công nghệ Miền Đông",
    "point": 3,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D4_2_3"
  },
  {
    "col": "D4_2_4",
    "code": "4.2.4",
    "dieuNum": 4,
    "title": "Nhận giấy khen, bằng khen của chính quyền, tổ chức chính trị - xã hội tại địa phương trong tham gia các hoạt động xã hội",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D4_2_4"
  },
  {
    "col": "D4_3",
    "code": "4.3",
    "dieuNum": 4,
    "title": "Thiếu ý thức trong quan hệ cộng đồng (vi phạm chủ trương, chính sách, pháp luật tại địa phương, nơi cư trú bị xử lý vi phạm hành chính trở lên)",
    "point": -2,
    "score_type": "DEDUCTION",
    "noteCol": "Ghi_chu_D4_3"
  },
  {
    "col": "D5_1_1",
    "code": "5.1.1",
    "dieuNum": 5,
    "title": "Ban cán sự lớp sinh viên",
    "point": 2,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_1"
  },
  {
    "col": "D5_1_2",
    "code": "5.1.2",
    "dieuNum": 5,
    "title": "Ban chấp hành chi đoàn",
    "point": 2,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_2"
  },
  {
    "col": "D5_1_3",
    "code": "5.1.3",
    "dieuNum": 5,
    "title": "Ban chấp hành chi hội sinh viên",
    "point": 2,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_3"
  },
  {
    "col": "D5_1_4",
    "code": "5.1.4",
    "dieuNum": 5,
    "title": "Ban điều hành, ban chủ nhiệm CLB, đội, nhóm",
    "point": 3,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_4"
  },
  {
    "col": "D5_1_5",
    "code": "5.1.5",
    "dieuNum": 5,
    "title": "Ban chấp hành đoàn khoa",
    "point": 4,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_5"
  },
  {
    "col": "D5_1_6",
    "code": "5.1.6",
    "dieuNum": 5,
    "title": "Ban chấp hành liên chi hội sinh viên",
    "point": 4,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_6"
  },
  {
    "col": "D5_1_7",
    "code": "5.1.7",
    "dieuNum": 5,
    "title": "Ban chấp hành đoàn trường",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_7"
  },
  {
    "col": "D5_1_8",
    "code": "5.1.8",
    "dieuNum": 5,
    "title": "Ban chấp hành hội sinh viên trường",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_8"
  },
  {
    "col": "D5_1_9",
    "code": "5.1.9",
    "dieuNum": 5,
    "title": "Cấp ủy chi bộ",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_1_9"
  },
  {
    "col": "D5_2_1",
    "code": "5.2.1",
    "dieuNum": 5,
    "title": "Hỗ trợ/tham gia tích cực hoạt động lớp (không có quyết định Trường công nhận)",
    "point": 2,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_2_1"
  },
  {
    "col": "D5_2_2",
    "code": "5.2.2",
    "dieuNum": 5,
    "title": "Hỗ trợ/tham gia tích cực hoạt động khoa, phòng ban, trung tâm",
    "point": 3,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D5_2_2"
  },
  {
    "col": "D5_2_3",
    "code": "5.2.3",
    "dieuNum": 5,
    "title": "Hỗ trợ/tham gia tích cực hoạt động toàn trường (Lễ khai giảng, đối thoại sinh viên…)",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_2_3"
  },
  {
    "col": "D5_3_1",
    "code": "5.3.1",
    "dieuNum": 5,
    "title": "Đạt giải các cuộc thi, hoạt động tại Trường",
    "point": 2,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D5_3_1"
  },
  {
    "col": "D5_3_2",
    "code": "5.3.2",
    "dieuNum": 5,
    "title": "Đạt danh hiệu Sinh viên 5 tốt cấp khoa",
    "point": 3,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_3_2"
  },
  {
    "col": "D5_3_3",
    "code": "5.3.3",
    "dieuNum": 5,
    "title": "Đạt danh hiệu Sinh viên 5 tốt cấp trường",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D5_3_3"
  },
  {
    "col": "D5_3_4",
    "code": "5.3.4",
    "dieuNum": 5,
    "title": "Nhận giấy khen của Bí thư Đoàn / Chủ tịch Hội Sinh viên",
    "point": 5,
    "score_type": "RANGE",
    "noteCol": "Ghi_chu_D5_3_4"
  },
  {
    "col": "D6_1",
    "code": "6.1",
    "dieuNum": 6,
    "title": "Top 30 thành viên tương tác trên fanpage MIT UNI",
    "point": 3,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_1"
  },
  {
    "col": "D6_2_1",
    "code": "6.2.1",
    "dieuNum": 6,
    "title": "Đạt giải thưởng nghiên cứu khoa học cấp trường",
    "point": 2,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_2_1"
  },
  {
    "col": "D6_2_2",
    "code": "6.2.2",
    "dieuNum": 6,
    "title": "Nhận giấy khen của Hiệu trưởng",
    "point": 3,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_2_2"
  },
  {
    "col": "D6_3_1",
    "code": "6.3.1",
    "dieuNum": 6,
    "title": "Đạt giải thưởng nghiên cứu khoa học từ cấp tỉnh, thành phố trực thuộc trung ương trở lên",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_3_1"
  },
  {
    "col": "D6_3_2",
    "code": "6.3.2",
    "dieuNum": 6,
    "title": "Đạt giải thưởng các cuộc thi, hội thi, hoạt động từ cấp tỉnh, thành phố trực thuộc trung ương trở lên",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_3_2"
  },
  {
    "col": "D6_3_3",
    "code": "6.3.3",
    "dieuNum": 6,
    "title": "Nhận bằng khen từ cấp tỉnh/thành phố trực thuộc TW trở lên",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_3_3"
  },
  {
    "col": "D6_4",
    "code": "6.4",
    "dieuNum": 6,
    "title": "Sinh viên khuyết tật vẫn tích cực tham gia các hoạt động phù hợp",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_4"
  },
  {
    "col": "D6_5",
    "code": "6.5",
    "dieuNum": 6,
    "title": "Các trường hợp khác theo quyết định Hiệu trưởng",
    "point": 5,
    "score_type": "BOOLEAN",
    "noteCol": "Ghi_chu_D6_5"
  }
];
