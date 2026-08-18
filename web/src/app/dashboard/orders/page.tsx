import { prisma } from "@/lib/prisma";
import { getActiveBatch } from "./actions";
import { getBatchDetail } from "@/lib/batch-view";
import { PALLET_SIZE } from "@/lib/packing";
import UploadPanel from "./UploadPanel";
import BatchActions from "./BatchActions";
import { PackDestCards, HoldsTable } from "@/components/PackDestCards";

// 대량 발주서 Packing List 생성/출고확정은 상품·박스 종류가 많으면 시간이 걸릴 수 있어 여유를 둠
export const maxDuration = 60;

export default async function OrdersPage() {
  const active = await getActiveBatch();

  if (!active) {
    const boxSpecs = await prisma.boxSpec.findMany({ where: { archived: false }, orderBy: { name: "asc" } });
    const products = await prisma.product.findMany({ select: { code: true, status: true } });
    return (
      <section>
        <h1 style={{ margin: "0 0 4px" }}>Order · 패킹</h1>
        <p className="muted" style={{ marginTop: 0 }}>주문을 올려 보유 박스에 나눠 담고 재고를 차감합니다.</p>
        <UploadPanel
          boxSpecs={boxSpecs}
          products={products.map((p) => ({ code: p.code, discontinued: p.status === "DISCONTINUED" }))}
        />
      </section>
    );
  }

  const detail = await getBatchDetail(active.id);
  if (!detail) return null;

  const hasPallets = detail.dests.some((d) => d.boxes.some((b) => b.palletNo != null));

  const boxSpecs = await prisma.boxSpec.findMany();
  const stockById = new Map(boxSpecs.map((b) => [b.id, b.stockQty]));
  const usageStr =
    detail.boxUsage.map((u) => `${u.name} ×${u.count}`).join(" · ") || "-";
  const shortBoxMsgs = detail.boxUsage
    .filter((u) => u.count > (stockById.get(u.boxSpecId ?? "") ?? 0))
    .map((u) => `${u.name} 필요 ${u.count}/보유 ${stockById.get(u.boxSpecId ?? "") ?? 0}`);

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>Order · 패킹</h1>
      <p className="muted" style={{ marginTop: 0 }}>주문을 올려 보유 박스에 나눠 담고 재고를 차감합니다.</p>

      <div className="stats">
        <div className="stat s">
          <div className="l">패킹 수량</div>
          <div className="n mono">{detail.shipTotal.toLocaleString()}</div>
        </div>
        <div className="stat s">
          <div className="l">사용 박스</div>
          <div className="n mono">{detail.boxesUsed}</div>
        </div>
        <div className="stat w">
          <div className="l">재고부족</div>
          <div className="n mono">{detail.shorts.length}품목</div>
        </div>
        <div className="stat e">
          <div className="l">반송(단종)</div>
          <div className="n mono">{detail.holds.length}라인</div>
        </div>
        <div className="stat">
          <div className="l">배송지</div>
          <div className="n mono">{detail.dests.length}</div>
        </div>
        {detail.palletTotal > 0 && (
          <div className="stat w">
            <div className="l">팔레트</div>
            <div className="n mono">{detail.palletTotal}개</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, fontSize: 14, color: "var(--muted)" }}>
        박스 사용 내역: <b style={{ color: "var(--ink)" }}>{usageStr}</b> · 패킹 리스트는 재고와 무관하게 전량 작성됩니다.
        한 박스에는 하나의 발주번호 물품만 담기며, 재고 부족분은 출고 확정 시 반영되고 발주·입고 탭에 모입니다.
        배송지 박스가 {PALLET_SIZE}개를 넘으면 {PALLET_SIZE}박스 단위로 팔레트가 자동 구성됩니다. 파일 하나당 패킹
        리스트는 한 번만 생성할 수 있으며, 출고 확정 후 &quot;히스토리 반영&quot;을 누르면 오더패킹 히스토리에
        저장되고 화면이 초기화되어 다음 주문을 받을 수 있습니다.
      </div>

      <BatchActions
        batchId={active.id}
        status={active.status}
        hasPallets={hasPallets}
        hasHolds={detail.holds.length > 0}
        shortBoxMsgs={shortBoxMsgs}
      />

      <div className="card-h" style={{ border: 0, padding: "2px 2px 12px" }}>
        <h3>물류창고별 Packing List</h3>
      </div>
      <PackDestCards dests={detail.dests} />
      <HoldsTable holds={detail.holds} />
    </section>
  );
}
