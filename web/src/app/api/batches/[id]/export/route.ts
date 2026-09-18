import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { getBatchDetail } from "@/lib/batch-view";
import { getTenantDb } from "@/lib/tenant-db";
import { contentDisposition } from "@/lib/download";

// PackingList 시트: 팔레트에 실린 박스의 품목 행 음영(연한 황색) — 낱개 박스 행과 구분
const PALLET_ROW_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE9B0" } };
// 밀크런/쉽먼트 시트: 박스가 바뀔 때마다 번갈아 넣는 음영(연한 회색) — 같은 박스 행끼리 묶어 보이게
const BOX_BAND_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };

type Cell = string | number;

function addAoaSheet(wb: ExcelJS.Workbook, name: string, rows: Cell[][]) {
  const ws = wb.addWorksheet(name);
  for (const row of rows) ws.addRow(row);
  ws.getRow(1).font = { bold: true };
  return ws;
}

function fillRow(row: ExcelJS.Row, fill: ExcelJS.Fill) {
  row.eachCell({ includeEmpty: true }, (cell) => (cell.fill = fill));
}

// 박스번호(첫 열)가 바뀔 때마다 음영을 켰다 껐다 하며 행을 추가한다
function addBoxBandedSheet(wb: ExcelJS.Workbook, name: string, header: string[], rows: Cell[][]) {
  const ws = wb.addWorksheet(name);
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  let prevBox: Cell | null = null;
  let banded = false;
  for (const row of rows) {
    if (row[0] !== prevBox) {
      banded = prevBox === null ? false : !banded;
      prevBox = row[0];
    }
    const r = ws.addRow(row);
    if (banded) fillRow(r, BOX_BAND_FILL);
  }
  return ws;
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

  const sum: Cell[][] = [["배송지", "통합지역", "지역", "주소", "박스수", "패킹수량"]];
  const bsum: Cell[][] = [["배송지", "박스번호", "팔레트번호", "박스종류", "품목수", "총수량", "총중량(g)"]];
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
  const detRows: { row: Cell[]; onPallet: boolean }[] = [];

  // 밀크런(팔레트 포장분) / 쉽먼트(박스 포장분) — 쿠팡 쉽먼트 업로드 양식 컬럼 앞에 박스번호를 붙인 형태.
  // 박스 단위 행이라 같은 발주번호·상품이 여러 박스에 나뉘면 박스마다 한 행씩 나온다.
  const shipHeader = [
    "박스번호",
    "발주번호",
    "배송지",
    "입고유형",
    "입고 예정일",
    "상품번호",
    "바코드",
    "상품명",
    "수량",
    "송장번호",
    "확정수량",
  ];
  const milkRunRows: Cell[][] = [];
  const shipmentRows: Cell[][] = [];

  for (const d of detail.dests) {
    const wh = whByName.get(d.dest);
    sum.push([d.dest, wh?.region || "", wh?.area || "", wh?.address || "", d.boxes.length, d.qty]);
    for (const bx of d.boxes) {
      const boxId = `${d.dest}-B${String(bx.boxNo).padStart(2, "0")}`;
      const onPallet = bx.palletNo != null;
      const palletId = onPallet ? `${d.dest}-PLT${String(bx.palletNo).padStart(2, "0")}` : "";
      const inboundType = onPallet ? "밀크런" : "쉽먼트";
      const target = onPallet ? milkRunRows : shipmentRows;
      let bq = 0,
        bw = 0;
      for (const it of bx.items) {
        // 등록된 무게는 포장(팩) 1개 기준값이라, 실제 중량은 완전한 포장 묶음 수만큼만 곱한다
        const packQty = Math.max(1, it.packQty || 1);
        const lw = it.weightG * Math.floor(it.qty / packQty);
        bq += it.qty;
        bw += lw;
        detRows.push({
          row: [d.dest, boxId, palletId, bx.boxSpecName, it.po, it.code, it.barcode || "", it.name, it.qty, packQty, it.weightG, lw],
          onPallet,
        });
        target.push([boxId, it.po, d.dest, inboundType, etaDate, it.code, it.barcode || "", it.name, it.qty, "", it.qty]);
      }
      bsum.push([d.dest, boxId, palletId, bx.boxSpecName, bx.items.length, bq, bw]);
    }
  }

  const unreg: Cell[][] = [["발주번호", "배송지", "상품번호", "상품명", "수량"]];
  for (const x of detail.unregistered) unreg.push([x.po, x.dest, x.code, x.name, x.qty]);

  const shorts: Cell[][] = [["상품번호", "상품명", "부족수량"]];
  for (const x of detail.shorts) shorts.push([x.code, x.name, x.short]);

  const holds: Cell[][] = [["발주번호", "배송지", "상품번호", "상품명", "수량"]];
  for (const x of detail.holds) holds.push([x.po, x.dest, x.code, x.name, x.qty]);

  // 시트 순서 고정: PackingList, 밀크런, 쉽먼트, 미등록상품, 배송지요약, 박스요약, 재고부족, 단종
  // (데이터가 없는 시트도 헤더만으로 항상 만들어 순서가 파일마다 달라지지 않게 한다)
  const wb = new ExcelJS.Workbook();

  const detWs = wb.addWorksheet("PackingList");
  detWs.addRow(detHeader);
  detWs.getRow(1).font = { bold: true };
  for (const { row, onPallet } of detRows) {
    const r = detWs.addRow(row);
    if (onPallet) fillRow(r, PALLET_ROW_FILL);
  }

  addBoxBandedSheet(wb, "밀크런", shipHeader, milkRunRows);
  addBoxBandedSheet(wb, "쉽먼트", shipHeader, shipmentRows);
  addAoaSheet(wb, "미등록상품", unreg);
  addAoaSheet(wb, "배송지요약", sum);
  addAoaSheet(wb, "박스요약", bsum);
  addAoaSheet(wb, "재고부족", shorts);
  addAoaSheet(wb, "단종", holds);

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(`PackingList_${detail.key}.xlsx`),
    },
  });
}
