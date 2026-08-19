import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchDetail } from "@/lib/batch-view";
import { getTenantDb } from "@/lib/tenant-db";
import { PackDestCards, HoldsTable } from "@/components/PackDestCards";

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getTenantDb();
  const detail = await getBatchDetail(db, id);
  if (!detail) notFound();

  const hasPallets = detail.dests.some((d) => d.boxes.some((b) => b.palletNo != null));

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Link href="/dashboard/history" className="btn ghost sm">
          ← 목록으로
        </Link>
        <h1 style={{ margin: 0 }}>{detail.key} 상세</h1>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {detail.reflectedAt?.toLocaleString("ko-KR")} 반영 완료
      </p>

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
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <a className="btn ghost sm" href={`/api/batches/${detail.id}/export`}>
          엑셀 내보내기
        </a>
        {hasPallets && (
          <a className="btn ghost sm" href={`/api/batches/${detail.id}/export-pallets`}>
            팔레트 명세서 엑셀
          </a>
        )}
        {detail.holds.length > 0 && (
          <a className="btn ghost sm" href={`/api/batches/${detail.id}/export-returns`}>
            반송 리스트 엑셀
          </a>
        )}
      </div>

      <div className="card-h" style={{ border: 0, padding: "2px 2px 12px" }}>
        <h3>물류창고별 Packing List</h3>
      </div>
      <PackDestCards dests={detail.dests} />
      <HoldsTable holds={detail.holds} />
    </section>
  );
}
