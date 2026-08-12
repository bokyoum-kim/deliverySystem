// 테스트 반복 실행을 위한 초기화 스크립트. OrderBatch(+연쇄) 전부 삭제하고
// 상품/박스 재고를 시드값으로 되돌린다. 앱 코드에서는 쓰지 않음.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STOCK: Record<string, number> = {
  "310537": 130,
  "8081659": 140,
  "8081660": 150,
  "10742422": 300,
  "11280500": 25,
  "11645003": 50,
  "14982357": 0,
};
const BOX_STOCK: Record<string, number> = { "대형 50X40": 10, "중형 40X30": 30, "소형 30X20": 50 };

async function main() {
  const delBatches = await prisma.orderBatch.deleteMany({});
  console.log("deleted batches:", delBatches.count);

  for (const [code, qty] of Object.entries(STOCK)) {
    await prisma.product.update({ where: { code }, data: { stock: { update: { quantity: qty } } } });
  }
  for (const [name, qty] of Object.entries(BOX_STOCK)) {
    await prisma.boxSpec.updateMany({ where: { name }, data: { stockQty: qty } });
  }
  // 테스트 중 즉석 생성됐을 수 있는 상품(주문에만 있던 코드)은 정리
  await prisma.product.deleteMany({ where: { code: { notIn: Object.keys(STOCK) } } });
  console.log("stock reset done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
