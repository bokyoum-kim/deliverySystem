import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MASTER_PRODUCTS = [
  { code: "310537", barcode: "4901681461264", name: "클립온멀티 화이트", w: 20, L: 120, W: 20, H: 20, price: 2000, stock: 130, hold: false },
  { code: "8081659", barcode: "4901681136292", name: "제브라 중성펜 사라사3색 J3J2 0.5mm 와인", w: 15, L: 140, W: 50, H: 20, price: 1500, stock: 140, hold: false },
  { code: "8081660", barcode: "4901681136230", name: "제브라 중성펜 사라사3색 J3J2 0.5mm 투명", w: 15, L: 140, W: 50, H: 20, price: 1500, stock: 150, hold: false },
  { code: "10742422", barcode: "4901681577316", name: "블렌(bLen) 0.7mm 혼합5본세트", w: 25, L: 150, W: 40, H: 30, price: 1800, stock: 300, hold: false },
  { code: "11280500", barcode: "RS20200100576", name: "Pack_제브라 클립온멀티 4색 B4SA1 볼펜0.7+샤프0.5 블랙 2개", w: 12, L: 110, W: 20, H: 10, price: 1500, stock: 25, hold: false },
  { code: "11645003", barcode: "RS20200400239", name: "제브라 델가드 샤프 MAB85 0.7mm 블랙 2개", w: 13, L: 110, W: 30, H: 10, price: 1500, stock: 50, hold: false },
  { code: "14982357", barcode: "4901681185627", name: "제브라_사라사 그랜드 빈티지 볼펜 0.5mm_다크블루", w: 8, L: 110, W: 30, H: 20, price: 800, stock: 0, hold: true },
];

const MASTER_DESTS = [
  { region: "경기남부", area: "경기광주", name: "경기광주1" },
  { region: "경기남부", area: "경기광주", name: "경기광주3" },
  { region: "경기북부", area: "고양", name: "고양1" },
  { region: "대구", area: "대구", name: "대구2" },
  { region: "대구", area: "대구", name: "대구3" },
  { region: "대구", area: "대구", name: "대구6" },
  { region: "경기남부", area: "동탄", name: "동탄1" },
  { region: "서울", area: "서울", name: "서울" },
  { region: "경기서부", area: "시흥", name: "시흥2" },
  { region: "경기서부", area: "안산", name: "안산3" },
  { region: "경남", area: "양산", name: "양산1" },
  { region: "경기서부", area: "이천", name: "이천2" },
  { region: "경기서부", area: "이천", name: "이천4" },
  { region: "경기서부", area: "인천", name: "인천14" },
  { region: "경기서부", area: "인천", name: "인천28" },
  { region: "경기서부", area: "인천", name: "인천30" },
  { region: "경기서부", area: "인천", name: "인천32" },
  { region: "경기서부", area: "인천", name: "인천36" },
  { region: "경기서부", area: "인천", name: "인천4" },
  { region: "전남", area: "전라광주", name: "전라광주2" },
  { region: "경남", area: "창원", name: "창원1" },
  { region: "경남", area: "창원", name: "창원3" },
  { region: "경남", area: "창원", name: "창원4" },
];

const MASTER_BOXES = [
  { name: "대형 50X40", L: 500, W: 300, H: 400, maxw: 10000, stock: 10 },
  { name: "중형 40X30", L: 400, W: 300, H: 250, maxw: 8000, stock: 30 },
  { name: "소형 30X20", L: 300, W: 200, H: 150, maxw: 5000, stock: 50 },
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const company = await prisma.company.upsert({
    where: { schemaName: "public" },
    update: {},
    create: { name: "샘플 회사", schemaName: "public" },
  });

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: adminEmail } },
    update: {},
    create: { email: adminEmail, name: "관리자", passwordHash, role: "ADMIN", companyId: company.id },
  });
  console.log(`admin user ready: ${adminEmail} / ${adminPassword}`);

  for (const p of MASTER_PRODUCTS) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        barcode: p.barcode,
        name: p.name,
        weightG: p.w,
        lengthMm: p.L,
        widthMm: p.W,
        heightMm: p.H,
        price: p.price,
        status: p.hold ? "DISCONTINUED" : "ACTIVE",
        stock: { create: { quantity: p.stock } },
      },
    });
  }
  console.log(`products seeded: ${MASTER_PRODUCTS.length}`);

  for (const d of MASTER_DESTS) {
    await prisma.warehouse.upsert({
      where: { code: d.name },
      update: {},
      create: { code: d.name, name: d.name, region: d.region, area: d.area },
    });
  }
  console.log(`warehouses seeded: ${MASTER_DESTS.length}`);

  for (const b of MASTER_BOXES) {
    const existing = await prisma.boxSpec.findFirst({ where: { name: b.name } });
    if (!existing) {
      await prisma.boxSpec.create({
        data: {
          name: b.name,
          lengthMm: b.L,
          widthMm: b.W,
          heightMm: b.H,
          maxWeightG: b.maxw,
          stockQty: b.stock,
        },
      });
    }
  }
  console.log(`box specs seeded: ${MASTER_BOXES.length}`);

  await prisma.palletSpec.upsert({
    where: { id: "default-pallet-spec" },
    update: {},
    create: { id: "default-pallet-spec", name: "표준 팔레트", maxBoxCount: 10 },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
