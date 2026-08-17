// 패킹 알고리즘 — 물류관리시스템 프로토타입(HTML)의 packDest/generate 로직을 그대로 포팅.
// 순수 함수: DB나 DOM에 의존하지 않는다.

export const PALLET_SIZE = 10;

export type ProductLite = {
  code: string;
  name: string;
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  packQty: number; // 포장수량 — 등록된 무게·부피는 이 수량 단위(포장) 기준값
  stock: number;
  discontinued: boolean;
};

export type BoxSpecLite = {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxWeightG: number;
  stockQty: number;
};

export type OrderLineInput = {
  po: string;
  dest: string;
  code: string;
  name: string;
  qty: number;
  // 발주서 원본의 금액 정보 — 패킹 계산에는 쓰이지 않고 통계용으로 그대로 저장된다
  unitCost?: number;
  supplyPrice?: number;
  vat?: number;
  totalAmount?: number;
};

export type PackedItem = { code: string; name: string; po: string; qty: number };
export type PackedBox = {
  boxSpecId: string;
  boxSpecName: string;
  boxNo: number;
  items: PackedItem[];
  over: boolean;
};
export type PackedPallet = { palletNo: number; boxNos: number[] };
export type PackedDest = {
  dest: string;
  qty: number;
  boxes: PackedBox[];
  pallets: PackedPallet[] | null;
};
export type HoldLine = { po: string; dest: string; code: string; name: string; qty: number };
export type ShortLine = { code: string; name: string; short: number };

export type PackResult = {
  dests: PackedDest[];
  holds: HoldLine[];
  shorts: ShortLine[];
  shipTotal: number;
  boxesUsed: number;
  palletTotal: number;
  boxUsage: Record<string, number>; // boxSpecId -> 사용 개수
};

type ShipLine = { code: string; name: string; ship: number; po: string; pv: number; pw: number };

function volNom(b: BoxSpecLite) {
  return b.lengthMm * b.widthMm * b.heightMm;
}
function volCapOf(b: BoxSpecLite, eta: number) {
  return b.lengthMm * b.widthMm * b.heightMm * (eta / 100);
}

// 여러 박스 종류 혼용: 큰 박스부터 채우고, 재고 소진 시 다음 박스로.
// 한 박스에는 하나의 발주번호(po) 물품만 담는다. 마지막 잔량 박스는 더 작은 박스로 다운사이즈.
function packDest(
  ship: ShipLine[],
  enabled: BoxSpecLite[],
  pool: Record<string, number>,
  used: Record<string, number>,
  eta: number,
  cap: number
): PackedBox[] {
  const boxes: { boxSpecId: string; boxSpecName: string; items: PackedItem[]; over: boolean }[] = [];
  let t: BoxSpecLite | null = null;
  let over = false;
  let cur: PackedItem[] = [];
  let cc = 0,
    cv = 0,
    cw = 0;
  let curPo: string | null = null;

  function pick(): { b: BoxSpecLite; over: boolean } {
    for (const b of enabled) if ((pool[b.id] || 0) > 0) return { b, over: false };
    return { b: enabled[0], over: true };
  }
  function openB() {
    const pk = pick();
    t = pk.b;
    over = pk.over;
    cur = [];
    cc = 0;
    cv = 0;
    cw = 0;
  }
  function closeB() {
    if (!cur.length || !t) {
      t = null;
      return;
    }
    boxes.push({ boxSpecId: t.id, boxSpecName: t.name, items: cur, over });
    used[t.id] = (used[t.id] || 0) + 1;
    if ((pool[t.id] || 0) > 0) pool[t.id]--;
    t = null;
  }

  const sorted = [...ship].sort((a, b) => {
    if (a.po !== b.po) return a.po < b.po ? -1 : 1;
    return a.code < b.code ? -1 : 1;
  });

  // 등록된 가로·세로·높이·무게는 "포장수량" 단위(포장 1개) 기준값이므로, 부피·무게는
  // 포장 단위(팩) 배수로만 채운다. 포장 단위에 못 미치는 나머지는 이미 열려 있는 그 박스에
  // 부피·무게 계산 없이(공간을 차지하지 않는 것으로 보고) 그대로 얹는다.
  function addToCur(code: string, name: string, po: string, qty: number) {
    const last = cur[cur.length - 1];
    if (last && last.code === code && last.po === po) last.qty += qty;
    else cur.push({ code, name, po, qty });
  }

  for (const ln of sorted) {
    // 발주번호가 바뀌면 박스에 여유가 있어도 새 박스로 넘어간다
    if (t && curPo !== null && curPo !== ln.po) closeB();
    const pv = ln.pv; // 포장(팩) 1개 부피
    const pw = ln.pw; // 포장(팩) 1개 무게
    const packQty = Math.max(1, productLookupCache.get(ln.code)?.packQty || 1);

    let remPacks = Math.floor(ln.ship / packQty);
    const looseUnits = ln.ship % packQty;

    while (remPacks > 0) {
      if (!t) {
        openB();
        curPo = ln.po;
      }
      const box = t!;
      const volCap = volCapOf(box, eta);
      const maxw = box.maxWeightG || Infinity;
      const canC = Math.floor((cap - cc) / packQty);
      const canV = pv > 0 ? Math.floor((volCap - cv) / pv) : Infinity;
      const canW = pw > 0 ? Math.floor((maxw - cw) / pw) : Infinity;
      let fitPacks = Math.min(canC, canV, canW, remPacks);
      if (fitPacks <= 0) {
        if (cc === 0) {
          fitPacks = 1;
        } else {
          closeB();
          continue;
        }
      }
      const fitUnits = fitPacks * packQty;
      addToCur(ln.code, ln.name, ln.po, fitUnits);
      cc += fitUnits;
      cv += fitPacks * pv;
      cw += fitPacks * pw;
      remPacks -= fitPacks;
    }

    if (looseUnits > 0) {
      if (!t) {
        openB();
        curPo = ln.po;
      }
      addToCur(ln.code, ln.name, ln.po, looseUnits);
    }
  }
  closeB();

  // 마지막 박스 다운사이즈
  if (boxes.length) {
    const lb = boxes[boxes.length - 1];
    let lv = 0,
      lw = 0,
      lc = 0;
    for (const it of lb.items) {
      const p = productLookupCache.get(it.code);
      const packQty = Math.max(1, p?.packQty || 1);
      const packs = Math.floor(it.qty / packQty); // 포장 단위 나머지는 부피·무게에 포함하지 않음
      lv += (p ? p.lengthMm * p.widthMm * p.heightMm : 0) * packs;
      lw += (p ? p.weightG : 0) * packs;
      lc += it.qty;
    }
    const curB = enabled.find((b) => b.id === lb.boxSpecId)!;
    let best: BoxSpecLite | null = null;
    for (const b of enabled) {
      if (b.id === lb.boxSpecId || (pool[b.id] || 0) <= 0) continue;
      if (volNom(b) >= volNom(curB)) continue;
      if (lv <= volCapOf(b, eta) && lw <= (b.maxWeightG || Infinity) && lc <= cap) {
        if (!best || volNom(b) < volNom(best)) best = b;
      }
    }
    if (best) {
      if (!lb.over) pool[lb.boxSpecId] = (pool[lb.boxSpecId] || 0) + 1;
      used[lb.boxSpecId]--;
      used[best.id] = (used[best.id] || 0) + 1;
      pool[best.id]--;
      lb.boxSpecId = best.id;
      lb.boxSpecName = best.name;
      lb.over = false;
    }
  }

  return boxes.map((b, i) => ({ ...b, boxNo: i + 1 }));
}

// packDest 안에서 상품 치수 조회가 필요해 모듈 스코프 캐시를 씀 (runPacking 호출마다 새로 세팅)
let productLookupCache = new Map<string, ProductLite>();

export function runPacking(
  lines: OrderLineInput[],
  products: Map<string, ProductLite>,
  boxSpecs: BoxSpecLite[],
  opts: { eta?: number; cap?: number } = {}
): PackResult {
  const eta = Math.min(95, Math.max(30, opts.eta ?? 80));
  const cap = Math.max(1, opts.cap ?? 100);
  productLookupCache = products;

  const enabled = [...boxSpecs].sort((a, b) => volNom(b) - volNom(a));
  const pool: Record<string, number> = {};
  const used: Record<string, number> = {};
  enabled.forEach((b) => (pool[b.id] = b.stockQty));

  const byDest = new Map<string, ShipLine[]>();
  const holds: HoldLine[] = [];
  let shipTotal = 0;

  for (const l of lines) {
    const p = products.get(l.code);
    if (p?.discontinued) {
      holds.push({ po: l.po || "", dest: l.dest, code: l.code, name: l.name, qty: l.qty });
      continue;
    }
    shipTotal += l.qty;
    const pv = p ? p.lengthMm * p.widthMm * p.heightMm : 0;
    const pw = p ? p.weightG : 0;
    const arr = byDest.get(l.dest) || [];
    arr.push({ code: l.code, name: l.name, ship: l.qty, po: l.po || "", pv, pw });
    byDest.set(l.dest, arr);
  }
  holds.sort((a, b) => {
    if (a.po !== b.po) return a.po < b.po ? -1 : 1;
    if (a.dest !== b.dest) return a.dest < b.dest ? -1 : 1;
    return a.code < b.code ? -1 : 1;
  });

  const packedByProd: Record<string, number> = {};
  for (const arr of byDest.values()) {
    for (const x of arr) packedByProd[x.code] = (packedByProd[x.code] || 0) + x.ship;
  }
  const shorts: ShortLine[] = [];
  for (const code of Object.keys(packedByProd)) {
    const p = products.get(code);
    const need = packedByProd[code];
    const av = p ? p.stock : 0;
    if (need > av) shorts.push({ code, name: p ? p.name : code, short: need - av });
  }

  const dests: PackedDest[] = [];
  let boxesUsed = 0;
  let palletTotal = 0;

  for (const [dest, arr] of byDest.entries()) {
    const boxes = packDest(arr, enabled, pool, used, eta, cap);
    boxesUsed += boxes.length;
    const qty = arr.reduce((a, c) => a + c.ship, 0);

    let pallets: PackedPallet[] | null = null;
    if (boxes.length > PALLET_SIZE) {
      const fullCount = Math.floor(boxes.length / PALLET_SIZE);
      pallets = [];
      for (let pi = 0; pi < fullCount; pi++) {
        pallets.push({
          palletNo: pi + 1,
          boxNos: boxes.slice(pi * PALLET_SIZE, (pi + 1) * PALLET_SIZE).map((b) => b.boxNo),
        });
      }
      palletTotal += pallets.length;
    }

    dests.push({ dest, qty, boxes, pallets });
  }

  dests.sort((a, b) => b.boxes.length - a.boxes.length);

  return { dests, holds, shorts, shipTotal, boxesUsed, palletTotal, boxUsage: used };
}
