import { prisma } from '@student-score/database';
async function main() {
  const parentId = 129; // 1.1.2
  const categoryId = "cat_HK2_2025_2026_CAT1";

  // Xoá options của parent để nó trở thành 1 mục cha thuần túy (dù frontend check isParent = có children, nhưng xoá cho sạch)
  await prisma.criteria.update({
    where: { id: parentId },
    data: { score_options: null, score_type: 'OPTIONS' }
  });

  const children = [
    { code: '1.1.2.a', content: 'Từ 3.60 đến 4.00 (Xuất sắc)', point: 5 },
    { code: '1.1.2.b', content: 'Từ 3.20 đến 3.59 (Giỏi)', point: 4 },
    { code: '1.1.2.c', content: 'Từ 2.50 đến 3.19 (Khá)', point: 3 },
    { code: '1.1.2.d', content: 'Từ 2.00 đến 2.49 (Trung bình)', point: 2 },
  ];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    await prisma.criteria.create({
      data: {
        category_id: categoryId,
        parent_id: parentId,
        code: child.code,
        content: child.content,
        point: child.point,
        score_type: 'BOOLEAN', // Chọn 1 hoặc 0 (RADIO button style)
        sort_order: i + 1,
        is_active: 1
      }
    });
  }

  console.log("Inserted children for 1.1.2 successfully.");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
