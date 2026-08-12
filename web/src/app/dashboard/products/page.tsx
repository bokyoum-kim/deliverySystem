import { prisma } from "@/lib/prisma";
import { createProduct } from "./actions";
import SearchBox from "../SearchBox";
import ProductBulkUpload from "./ProductBulkUpload";
import ProductsTable, { type ProductRow } from "./ProductsTable";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const products = await prisma.product.findMany({
    include: { stock: true },
    orderBy: { code: "asc" },
  });

  const query = (q ?? "").toLowerCase().trim();
  const filtered = query
    ? products.filter((p) => p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query))
    : products;

  const rows: ProductRow[] = filtered.map((p) => ({
    id: p.id,
    code: p.code,
    barcode: p.barcode,
    name: p.name,
    weightG: p.weightG,
    lengthMm: p.lengthMm,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    price: p.price,
    status: p.status,
    stockQty: p.stock?.quantity ?? 0,
  }));

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>상품</h1>
      <p className="muted" style={{ marginTop: 0 }}>상품 크기·무게·단가·재고를 관리합니다.</p>

      <div className="card">
        <div className="card-h">
          <h3>상품 마스터</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <SearchBox placeholder="검색" />
            <ProductBulkUpload />
          </div>
        </div>

        <form
          action={createProduct}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "12px 18px",
            background: "var(--line-2)",
          }}
        >
          <input className="txt" name="code" placeholder="상품번호" style={{ width: 110 }} required />
          <input className="txt mono" name="barcode" placeholder="바코드" style={{ width: 130 }} />
          <input className="txt" name="name" placeholder="상품명" style={{ width: 200 }} />
          <input className="txt mono" name="weightG" placeholder="무게g" style={{ width: 70 }} />
          <input className="txt mono" name="lengthMm" placeholder="가로" style={{ width: 60 }} />
          <input className="txt mono" name="widthMm" placeholder="세로" style={{ width: 60 }} />
          <input className="txt mono" name="heightMm" placeholder="높이" style={{ width: 60 }} />
          <input className="txt mono" name="price" placeholder="단가" style={{ width: 70 }} />
          <input className="txt mono" name="stock" placeholder="재고" style={{ width: 70 }} />
          <button className="btn sm" type="submit">추가</button>
        </form>
        <p className="hint" style={{ padding: "0 18px 10px", margin: 0 }}>
          대량 등록·수정: 엑셀에 상품번호(필수)·바코드·상품명·무게·가로·세로·높이·단가·재고·단종 컬럼을 넣어
          업로드하면, 있는 상품번호는 값을 갱신하고 없는 상품번호는 새로 추가합니다.
        </p>

        <div style={{ overflowX: "auto" }}>
          <ProductsTable products={rows} />
        </div>
      </div>
    </section>
  );
}
