// 엑셀 헤더 자동인식 등 서버·클라이언트 양쪽에서 쓰는 순수 유틸.
export function normHeader(h: unknown): string {
  return String(h == null ? "" : h)
    .replace(/^사용자\s*지정\./, "")
    .replace(/\s+/g, "")
    .trim();
}
export function findCol(headers: string[], candidates: string[]): number {
  for (let i = 0; i < headers.length; i++)
    for (const c of candidates) if (headers[i].indexOf(c) > -1) return i;
  return -1;
}
export function parseNum(v: unknown): number {
  const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}
export function boolish(v: unknown): boolean {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  return s === "y" || s === "yes" || s === "true" || s === "1" || s === "단종" || s === "o";
}
