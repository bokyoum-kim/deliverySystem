import { prisma } from "@/lib/prisma";
import { createProduct, updateProduct, deleteProduct } from "./actions";

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { stock: true },
    orderBy: { code: "asc" },
  });

  return (
    <section>
      <h1 style={{ margin: "0 0 4px" }}>상품</h1>
      <p className="muted" style={{ marginTop: 0 }}>상품 크기·무게·단가·재고를 관리합니다.</p>

      <div className="card">
        <div className="card-h">
          <h3>상품 마스터</h3>
          <span className="muted" style={{ fontSize: 13 }}>{products.length}개</span>
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

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>상품번호</th>
                <th>바코드</th>
                <th>상품명</th>
                <th>무게</th>
                <th>가로</th>
                <th>세로</th>
                <th>높이</th>
                <th>단가</th>
                <th className="num-c">재고</th>
                <th>단종</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td colSpan={11} style={{ padding: 0 }}>
                    <form
                      action={updateProduct}
                      style={{ display: "flex", alignItems: "center" }}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <Cell width={110}>
                        <span className="mono">{p.code}</span>
                      </Cell>
                      <Cell width={120}>
                        <input className="txt mono" name="barcode" defaultValue={p.barcode ?? ""} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={200}>
                        <input className="txt" name="name" defaultValue={p.name} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={70}>
                        <input className="txt mono" name="weightG" defaultValue={p.weightG} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={60}>
                        <input className="txt mono" name="lengthMm" defaultValue={p.lengthMm} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={60}>
                        <input className="txt mono" name="widthMm" defaultValue={p.widthMm} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={60}>
                        <input className="txt mono" name="heightMm" defaultValue={p.heightMm} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={70}>
                        <input className="txt mono" name="price" defaultValue={p.price} style={{ width: "100%" }} />
                      </Cell>
                      <Cell width={70}>
                        <input
                          className="txt mono"
                          name="stock"
                          defaultValue={p.stock?.quantity ?? 0}
                          style={{ width: "100%", textAlign: "right" }}
                        />
                      </Cell>
                      <Cell width={50}>
                        <input type="checkbox" name="discontinued" defaultChecked={p.status === "DISCONTINUED"} />
                      </Cell>
                      <Cell width={130}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn ghost sm" type="submit">저장</button>
                          <button className="btn ghost sm" type="submit" formAction={deleteProduct}>
                            삭제
                          </button>
                        </div>
                      </Cell>
                    </form>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={11} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    등록된 상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Cell({ children, width }: { children: React.ReactNode; width: number }) {
  return (
    <div style={{ padding: "6px 8px", width, flex: `0 0 ${width}px`, minWidth: 0 }}>
      {children}
    </div>
  );
}
