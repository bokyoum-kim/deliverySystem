// Order 엑셀 파싱 — 프로토타입(HTML)의 parseOrder() 컬럼 자동인식 로직을 그대로 포팅.
import * as XLSX from "xlsx";
import type { OrderLineInput } from "./packing";

function norm(h: unknown): string {
  return String(h == null ? "" : h)
    .replace(/^사용자\s*지정\./, "")
    .replace(/\s+/g, "")
    .trim();
}
function col(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++)
    for (const c of candidates) if (headers[i].indexOf(c) > -1) return i;
  return -1;
}
function num(v: unknown): number {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export const SAMPLE_ORDER: OrderLineInput[] = [
  { po: "PO-1001", dest: "경기광주3", code: "310537", name: "", qty: 50 },
  { po: "PO-1001", dest: "경기광주3", code: "8081659", name: "", qty: 80 },
  { po: "PO-1001", dest: "경기광주3", code: "14982357", name: "", qty: 20 },
  { po: "PO-1001", dest: "경기광주3", code: "10742422", name: "", qty: 120 },
  { po: "PO-1002", dest: "서울", code: "8081660", name: "", qty: 60 },
  { po: "PO-1002", dest: "서울", code: "11280500", name: "", qty: 30 },
  { po: "PO-1002", dest: "서울", code: "11645003", name: "", qty: 40 },
  { po: "PO-1003", dest: "이천2", code: "310537", name: "", qty: 200 },
  { po: "PO-1003", dest: "이천2", code: "10742422", name: "", qty: 250 },
  { po: "PO-1003", dest: "이천2", code: "8081659", name: "", qty: 100 },
  { po: "PO-1004", dest: "양산1", code: "11645003", name: "", qty: 30 },
  { po: "PO-1004", dest: "양산1", code: "8081660", name: "", qty: 90 },
];

export async function parseOrderFile(file: File): Promise<OrderLineInput[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheetName = wb.SheetNames.includes("Order")
    ? "Order"
    : wb.SheetNames.includes("테스트데이터")
      ? "테스트데이터"
      : wb.SheetNames[0];
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
  if (!aoa.length) throw new Error("시트에서 데이터를 찾지 못했습니다.");

  const headers = (aoa[0] as unknown[]).map(norm);
  const ci = {
    po: col(headers, ["발주번호"]),
    dest: col(headers, ["물류센터", "명칭", "배송지"]),
    code: col(headers, ["상품번호"]),
    name: col(headers, ["상품명", "상품이름"]),
    qty: col(headers, ["확정수량"]),
  };
  if (ci.qty < 0) ci.qty = col(headers, ["발주수량", "수량"]);
  if (ci.code < 0 || ci.dest < 0 || ci.qty < 0) {
    throw new Error("필수 컬럼(상품번호·물류센터·수량)을 찾지 못했습니다.");
  }

  const lines: OrderLineInput[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    const code = String(row[ci.code] ?? "").trim();
    if (!code) continue;
    if (ci.po > -1) {
      const po = String(row[ci.po] ?? "").trim();
      if (!po) continue;
    }
    const qty = num(row[ci.qty]);
    if (qty <= 0) continue;
    const dest = String(row[ci.dest] ?? "").trim();
    const name = ci.name > -1 ? String(row[ci.name] ?? "").trim() : code;
    lines.push({ po: ci.po > -1 ? String(row[ci.po]).trim() : "", dest, code, name, qty });
  }
  if (!lines.length) throw new Error("유효한 주문 라인을 찾지 못했습니다.");
  return lines;
}
