import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getBatchDetail } from "@/lib/batch-view";
import { getTenantDb } from "@/lib/tenant-db";
import { contentDisposition } from "@/lib/download";

// 팔레트에 실린 박스의 품목 행에 표시하는 음영(연한 황색) — 낱개 박스 행과 구분하기 위함
const PALLET_ROW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE9B0" } };

function addAoaSheet(wb: ExcelJS.Workbook, name: string, rows: (string | number)[][]) {
  const ws = wb.addWorksheet(name);
  for (const row of rows) ws.addRow(row);
  ws.getRow(1).font = { bold: true };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  // 입고 예정일 — 발주서에 저장된 값이 아니라, 사용자가 이 엑셀을 내려받기 직전에 입력한 값.
  // 쿠팡 쉽먼트 업로드 양식(data/쉽먼트 업로드양식파일.xlsx)의 EDD 컬럼이 "20260904"처럼
  // YYYYMMDD(하이픈 없이)라, <input type="date">가 주는 "2026-09-04" 형식에서 하이픈만 제거한다.
  const etaDateRaw = new URL(req.url).searchParams.get("etaDate") || "";
  const etaDate = etaDateRaw.replace(/-/g, "");

  const db = await getTenantDb();
  const { id } = await params;
  const detail = await getBatchDetail(db, id);
  if (!detail) return new NextResponse("Not found", { status: 404 });

  const warehouses = await db.warehouse.findMany();
  const whByName = new Map(warehouses.map((w) => [w.name, w]));

  const sum: (string | number)[][] = [["배송지", "통합지역", "지역", "주소", "박스수", "패킹수량"]];
  const bsum: (string | number)[][] = [
    ["배송지", "박스번호", "팔레트번호", "박스종류", "품목수", "총수량", "총중량(g)"],
  ];
  const detHeader = [
    "배송지",
    "박스번호",
    "팔레트번호",
    "박스종류",
    "발주번호",
    "상품번호",
    "바코드",
    "상품명",
    "수량",
    "포장수량",
    "포장중량(g)",
    "라인중량(g)",
  ];
  const detRows: { row: (string | number)[]; onPallet: boolean }[] = [];

  for (const d of detail.dests) {
    const wh = whByName.get(d.dest);
    sum.push([d.dest, wh?.region || "", wh?.area || "", wh?.address || "", d.boxes.length, d.qty]);
    for (const bx of d.boxes) {
      const id2 = `${d.dest}-B${String(bx.boxNo).padStart(2, "0")}`;
      const onPallet = bx.palletNo != null;
      const palletId = onPallet ? `${d.dest}-PLT${String(bx.palletNo).padStart(2, "0")}` : "";
      let bq = 0,
        bw = 0;
      for (const it of bx.items) {
        // 등록된 무게는 포장(팩) 1개 기준값이라, 실제 중량은 완전한 포장 묶음 수만큼만 곱한다
        const packQty = Math.max(1, it.packQty || 1);
        const lw = it.weightG * Math.floor(it.qty / packQty);
        bq += it.qty;
        bw += lw;
        detRows.push({
          row: [
            d.dest,
            id2,
            palletId,
            bx.boxSpecName,
            it.po,
            it.code,
            it.barcode || "",
            it.name,
            it.qty,
            packQty,
            it.weightG,
            lw,
          ],
          onPallet,
        });
      }
      bsum.push([d.dest, id2, palletId, bx.boxSpecName, bx.items.length, bq, bw]);
    }
  }

  // 쉽먼트 시트 — 발주번호+배송지+상품 단위로 합산(박스 단위 아님). 입고유형은 그 배송지
  // 박스가 팔레트로 묶였는지(밀크런) 낱개인지(쉽먼트)로 정해지는데, 같은 배송지 박스는
  // 팔레트 전환 기준을 넘으면 전부 팔레트로 묶이므로(packing.ts) 배송지 단위로 한 번만 봐도 된다.
  type ShipKey = string;
  const shipMap = new Map<
    ShipKey,
    { po: string; dest: string; code: string; barcode: string; name: string; qty: number; isMilkRun: boolean }
  >();
  for (const d of detail.dests) {
    const isMilkRun = d.boxes.some((b) => b.palletNo != null);
    for (const bx of d.boxes) {
      for (const it of bx.items) {
        const key = `${it.po}::${d.dest}::${it.code}`;
        const cur = shipMap.get(key);
        if (cur) cur.qty += it.qty;
        else shipMap.set(key, { po: it.po, dest: d.dest, code: it.code, barcode: it.barcode || "", name: it.name, qty: it.qty, isMilkRun });
      }
    }
  }
  const shipRows = [...shipMap.values()].sort((a, b) =>
    a.dest !== b.dest ? a.dest.localeCompare(b.dest) : a.po !== b.po ? a.po.localeCompare(b.po) : a.code.localeCompare(b.code)
  );
  const ship: (string | number)[][] = [
    ["발주번호", "배송지", "입고유형", "입고 예정일", "상품번호", "바코드", "상품명", "수량", "송장번호", "확정수량"],
  ];
  for (const r of shipRows) {
    ship.push([r.po, r.dest, r.isMilkRun ? "밀크런" : "쉽먼트", etaDate, r.code, r.barcode, r.name, r.qty, "", r.qty]);
  }

  const wb = new ExcelJS.Workbook();
  addAoaSheet(wb, "배송지요약", sum);
  addAoaSheet(wb, "박스요약", bsum);

  const detWs = wb.addWorksheet("PackingList");
  detWs.addRow(detHeader);
  detWs.getRow(1).font = { bold: true };
  for (const { row, onPallet } of detRows) {
    const r = detWs.addRow(row);
    if (onPallet) r.eachCell({ includeEmpty: true }, (cell) => (cell.fill = PALLET_ROW_FILL));
  }

  addAoaSheet(wb, "쉽먼트", ship);

  if (detail.shorts.length) {
    const s: (string | number)[][] = [["상품번호", "상품명", "부족수량"]];
    for (const x of detail.shorts) s.push([x.code, x.name, x.short]);
    addAoaSheet(wb, "재고부족", s);
  }
  if (detail.holds.length) {
    const h: (string | number)[][] = [["발주번호", "배송지", "상품번호", "상품명", "수량"]];
    for (const x of detail.holds) h.push([x.po, x.dest, x.code, x.name, x.qty]);
    addAoaSheet(wb, "반송", h);
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`PackingList_${detail.key}.xlsx`),
    },
  });
}
