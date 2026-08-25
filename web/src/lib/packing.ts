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

// 한 발주번호(po) 전체의 포장(팩) 수가 이 값 미만이면, 전용 박스를 새로 열지 않고
// 같은 목적지로 가는 "다른 발주번호" 박스 중 여유가 가장 많은 곳에 합쳐 담는다(2026-08 추가).
const SMALL_ORDER_PACK_LIMIT = 10;
// 한 발주번호를 담다가 박스가 가득 차서 새 박스를 열어야 하는 시점에, 그 발주번호의
// 나머지 물량(현재 박스 이후 남은 전체)이 이 값 이내면 새 박스 대신 지금 박스에
// 정원을 넘겨서라도 그대로 얹는다(2026-08 추가).
const OVERFLOW_TAIL_PACK_LIMIT = 10;

type OpenBox = {
  boxSpecId: string;
  boxSpecName: string;
  items: PackedItem[];
  over: boolean;
  usedVol: number;
  usedWeight: number;
  usedPacks: number; // 이 박스에 실제로 채워진 포장(팩) 수 합계 — 다른 발주번호를 합칠 때 여유 판단에 씀
};

// 여러 박스 종류 혼용: 큰 박스부터 채우고, 재고 소진 시 다음 박스로.
// 기본은 한 박스에 하나의 발주번호(po) 물품만 담는 것이지만, 아래 두 예외가 있다:
//  1) 한 발주번호의 꼬리 잔량이 10묶음 이내면 새 박스 대신 그 발주번호의 마지막 박스에 넘쳐서 담는다.
//  2) 한 발주번호 전체가 10묶음 미만이면 전용 박스 대신, 같은 목적지의 다른 발주번호 박스 중
//     여유가 가장 많은 박스에 합쳐 담는다(그 박스는 발주번호가 2개 이상이 될 수 있다).
// 마지막 잔량 박스는 더 작은 박스로 다운사이즈.
function packDest(
  ship: ShipLine[],
  enabled: BoxSpecLite[],
  pool: Record<string, number>,
  used: Record<string, number>,
  eta: number,
  cap: number
): PackedBox[] {
  const boxes: OpenBox[] = [];

  function packQtyOf(code: string) {
    return Math.max(1, productLookupCache.get(code)?.packQty || 1);
  }
  function pick(): { b: BoxSpecLite; over: boolean } {
    for (const b of enabled) if ((pool[b.id] || 0) > 0) return { b, over: false };
    return { b: enabled[0], over: true };
  }
  function pushItem(items: PackedItem[], code: string, name: string, po: string, qty: number) {
    const last = items[items.length - 1];
    if (last && last.code === code && last.po === po) last.qty += qty;
    else items.push({ code, name, po, qty });
  }

  const sorted = [...ship].sort((a, b) => {
    if (a.po !== b.po) return a.po < b.po ? -1 : 1;
    return a.code < b.code ? -1 : 1;
  });

  // 발주번호 단위로 묶는다 (이미 발주번호 기준으로 정렬돼 있어 연속 구간으로 나뉜다)
  const groups: { po: string; lines: ShipLine[]; totalPacks: number }[] = [];
  for (const ln of sorted) {
    const g = groups[groups.length - 1];
    if (g && g.po === ln.po) g.lines.push(ln);
    else groups.push({ po: ln.po, lines: [ln], totalPacks: 0 });
  }
  for (const g of groups) {
    g.totalPacks = g.lines.reduce((a, ln) => a + Math.floor(ln.ship / packQtyOf(ln.code)), 0);
  }

  // 이미 만들어진 다른 발주번호 박스 중, need(부피·무게·팩 수)가 그대로 들어갈 수 있는
  // 박스를 찾아 "여유가 가장 많은" 순으로 고른다.
  function findMergeTarget(need: { vol: number; weight: number; packs: number }): OpenBox | null {
    let best: OpenBox | null = null;
    for (const b of boxes) {
      const spec = enabled.find((s) => s.id === b.boxSpecId);
      if (!spec) continue;
      const remVol = volCapOf(spec, eta) - b.usedVol;
      const remWeight = (spec.maxWeightG || Infinity) - b.usedWeight;
      const remPacks = cap - b.usedPacks;
      if (remVol >= need.vol && remWeight >= need.weight && remPacks >= need.packs) {
        if (!best || b.usedPacks < best.usedPacks) best = b;
      }
    }
    return best;
  }

  for (const group of groups) {
    // 예외 2: 발주번호 전체 물량이 10묶음 미만이면 전용 박스 대신 여유 있는 다른 발주번호 박스에 합친다
    if (group.totalPacks < SMALL_ORDER_PACK_LIMIT) {
      const need = { vol: 0, weight: 0, packs: 0 };
      for (const ln of group.lines) {
        const packs = Math.floor(ln.ship / packQtyOf(ln.code));
        need.vol += packs * ln.pv;
        need.weight += packs * ln.pw;
        need.packs += packs;
      }
      const target = findMergeTarget(need);
      if (target) {
        for (const ln of group.lines) pushItem(target.items, ln.code, ln.name, ln.po, ln.ship);
        target.usedVol += need.vol;
        target.usedWeight += need.weight;
        target.usedPacks += need.packs;
        continue; // 이 발주번호는 새 박스를 열지 않고 끝
      }
    }

    // 일반 패킹 (예외 2에 해당하지 않거나, 합칠 곳을 못 찾은 경우)
    let t: OpenBox | null = null;
    let curSpec: BoxSpecLite | null = null;
    let cv = 0,
      cw = 0,
      cp = 0; // cp: 박스에 담긴 "포장(팩)" 수 — 박스당 최대 수량은 개별 낱개가 아니라 팩 단위로 센다

    function openB() {
      const pk = pick();
      curSpec = pk.b;
      t = { boxSpecId: pk.b.id, boxSpecName: pk.b.name, items: [], over: pk.over, usedVol: 0, usedWeight: 0, usedPacks: 0 };
      cv = 0;
      cw = 0;
      cp = 0;
    }
    function closeB() {
      if (!t || !t.items.length) {
        t = null;
        return;
      }
      t.usedVol = cv;
      t.usedWeight = cw;
      t.usedPacks = cp;
      boxes.push(t);
      used[t.boxSpecId] = (used[t.boxSpecId] || 0) + 1;
      if ((pool[t.boxSpecId] || 0) > 0) pool[t.boxSpecId]--;
      t = null;
    }

    // 이 발주번호 안에서, 몇 번째 줄부터 끝까지 남은 포장(팩) 합계 — 꼬리 잔량 판단용
    const suffixPacks: number[] = new Array(group.lines.length).fill(0);
    for (let i = group.lines.length - 1; i >= 0; i--) {
      const packs = Math.floor(group.lines[i].ship / packQtyOf(group.lines[i].code));
      suffixPacks[i] = packs + (i + 1 < group.lines.length ? suffixPacks[i + 1] : 0);
    }

    // 등록된 가로·세로·높이·무게는 "포장수량" 단위(포장 1개) 기준값이므로, 부피·무게는
    // 포장 단위(팩) 배수로만 채운다. 포장 단위에 못 미치는 나머지는 이미 열려 있는 그 박스에
    // 부피·무게 계산 없이(공간을 차지하지 않는 것으로 보고) 그대로 얹는다.
    for (let i = 0; i < group.lines.length; i++) {
      const ln = group.lines[i];
      const pv = ln.pv; // 포장(팩) 1개 부피
      const pw = ln.pw; // 포장(팩) 1개 무게
      const packQty = packQtyOf(ln.code);
      let remPacks = Math.floor(ln.ship / packQty);
      const looseUnits = ln.ship % packQty;
      const suffixAfter = i + 1 < group.lines.length ? suffixPacks[i + 1] : 0;

      while (remPacks > 0) {
        if (!t) openB();
        const spec = curSpec!;
        const volCap = volCapOf(spec, eta);
        const maxw = spec.maxWeightG || Infinity;
        const canC = cap - cp; // 박스당 최대 수량은 포장(팩) 개수 기준
        const canV = pv > 0 ? Math.floor((volCap - cv) / pv) : Infinity;
        const canW = pw > 0 ? Math.floor((maxw - cw) / pw) : Infinity;
        let fitPacks = Math.min(canC, canV, canW, remPacks);
        if (fitPacks <= 0) {
          if (cp === 0) {
            fitPacks = 1;
          } else {
            // 예외 1: 이 발주번호의 남은 물량(현재 줄 + 이후 줄)이 10묶음 이내면
            // 새 박스를 열지 않고 지금 박스에 정원을 넘겨서라도 그대로 담는다.
            const remainingForPo = remPacks + suffixAfter;
            if (remainingForPo <= OVERFLOW_TAIL_PACK_LIMIT) {
              fitPacks = remPacks;
            } else {
              closeB();
              continue;
            }
          }
        }
        const fitUnits = fitPacks * packQty;
        pushItem(t!.items, ln.code, ln.name, ln.po, fitUnits);
        cv += fitPacks * pv;
        cw += fitPacks * pw;
        cp += fitPacks;
        remPacks -= fitPacks;
      }

      if (looseUnits > 0) {
        if (!t) openB();
        pushItem(t!.items, ln.code, ln.name, ln.po, looseUnits);
      }
    }
    closeB();
  }

  // 마지막 박스 다운사이즈
  if (boxes.length) {
    const lb = boxes[boxes.length - 1];
    let lv = 0,
      lw = 0,
      lp = 0; // lp: 포장(팩) 수 합계 — 박스당 최대 수량은 팩 단위로 비교
    for (const it of lb.items) {
      const p = productLookupCache.get(it.code);
      const packQty = Math.max(1, p?.packQty || 1);
      const packs = Math.floor(it.qty / packQty); // 포장 단위 나머지는 부피·무게·수량에 포함하지 않음
      lv += (p ? p.lengthMm * p.widthMm * p.heightMm : 0) * packs;
      lw += (p ? p.weightG : 0) * packs;
      lp += packs;
    }
    const curB = enabled.find((b) => b.id === lb.boxSpecId)!;
    let best: BoxSpecLite | null = null;
    for (const b of enabled) {
      if (b.id === lb.boxSpecId || (pool[b.id] || 0) <= 0) continue;
      if (volNom(b) >= volNom(curB)) continue;
      if (lv <= volCapOf(b, eta) && lw <= (b.maxWeightG || Infinity) && lp <= cap) {
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

  return boxes.map((b, i) => ({
    boxSpecId: b.boxSpecId,
    boxSpecName: b.boxSpecName,
    boxNo: i + 1,
    items: b.items,
    over: b.over,
  }));
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
