"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProduct, deleteProducts } from "./actions";

export type ProductRow = {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  packQty: number;
  weightG: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  price: number;
  status: string;
  stockQty: number;
};

export default function ProductsTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const headRef = useRef<HTMLInputElement>(null);

  // 삭제·검색으로 목록에서 사라진 상품의 선택은 무시한다(화면에 보이는 것만 센다)
  const selectedRows = products.filter((p) => selected.has(p.id));
  const allChecked = products.length > 0 && selectedRows.length === products.length;
  const partial = selectedRows.length > 0 && !allChecked;

  // 일부만 선택된 상태는 체크박스 속성으로만 표현할 수 있어 ref로 직접 넣는다
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = partial;
  }, [partial]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function removeSelected() {
    const ids = selectedRows.map((p) => p.id);
    if (!ids.length) return;
    const preview = selectedRows
      .slice(0, 5)
      .map((p) => `· ${p.code} ${p.name}`)
      .join("\n");
    const more = ids.length > 5 ? `\n… 외 ${ids.length - 5}개` : "";
    if (!confirm(`선택한 상품 ${ids.length}개를 삭제할까요?\n\n${preview}${more}`)) return;

    setDeleting(true);
    const res = await deleteProducts(ids);
    setDeleting(false);

    if (res.error) {
      alert(res.error);
      return;
    }
    setSelected(new Set());
    router.refresh();

    const blocked = res.blocked ?? [];
    if (blocked.length) {
      const lines = blocked
        .slice(0, 10)
        .map((b) => `· ${b.code} — ${b.reason}`)
        .join("\n");
      const rest = blocked.length > 10 ? `\n… 외 ${blocked.length - 10}개` : "";
      alert(
        `${res.deleted ?? 0}개를 삭제했습니다.\n\n` +
          `아래 ${blocked.length}개는 이미 사용된 이력이 있어 삭제하지 않았습니다.\n` +
          `더 이상 쓰지 않으려면 '단종'에 체크하세요.\n\n${lines}${rest}`
      );
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "10px 18px",
          borderTop: "1px solid var(--line)",
        }}
      >
        <span className="muted" style={{ fontSize: 13 }}>
          {selectedRows.length ? `${selectedRows.length}개 선택됨` : "삭제할 상품을 체크하세요 (여러 개 선택 가능)"}
        </span>
        <button
          className="btn danger sm"
          type="button"
          disabled={!selectedRows.length || deleting}
          onClick={removeSelected}
        >
          {deleting ? "삭제 중…" : "선택 삭제"}
        </button>
        {selectedRows.length > 0 && (
          <button className="btn ghost sm" type="button" disabled={deleting} onClick={() => setSelected(new Set())}>
            선택 해제
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input
                  ref={headRef}
                  type="checkbox"
                  checked={allChecked}
                  disabled={products.length === 0}
                  aria-label="전체 선택"
                  title="전체 선택"
                  onChange={(e) => setSelected(e.target.checked ? new Set(products.map((p) => p.id)) : new Set())}
                />
              </th>
              <th>상품번호</th>
              <th>바코드</th>
              <th>상품명</th>
              <th>포장수량</th>
              <th>무게</th>
              <th>가로</th>
              <th>세로</th>
              <th>높이</th>
              <th>단가</th>
              <th className="num-c">재고</th>
              <th>단종</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <Row key={p.id} product={p} checked={selected.has(p.id)} onToggle={toggle} />
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={12} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({
  product,
  checked,
  onToggle,
}: {
  product: ProductRow;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    barcode: product.barcode ?? "",
    name: product.name,
    packQty: product.packQty,
    weightG: product.weightG,
    lengthMm: product.lengthMm,
    widthMm: product.widthMm,
    heightMm: product.heightMm,
    price: product.price,
    stockQty: product.stockQty,
    discontinued: product.status === "DISCONTINUED",
  });

  async function save(next: typeof f) {
    const fd = new FormData();
    fd.set("id", product.id);
    fd.set("barcode", next.barcode);
    fd.set("name", next.name);
    fd.set("packQty", String(next.packQty));
    fd.set("weightG", String(next.weightG));
    fd.set("lengthMm", String(next.lengthMm));
    fd.set("widthMm", String(next.widthMm));
    fd.set("heightMm", String(next.heightMm));
    fd.set("price", String(next.price));
    fd.set("stock", String(next.stockQty));
    if (next.discontinued) fd.set("discontinued", "on");
    await updateProduct(fd);
    router.refresh();
  }

  function field(key: keyof typeof f, mono = true) {
    return (
      <input
        className="cell"
        style={mono ? undefined : { fontFamily: "inherit", textAlign: "left", width: "100%" }}
        value={f[key] as string | number}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        onBlur={() => save(f)}
      />
    );
  }

  return (
    <tr>
      <td>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`${product.code} 선택`}
          onChange={(e) => onToggle(product.id, e.target.checked)}
        />
      </td>
      <td className="mono">{product.code}</td>
      <td>{field("barcode", false)}</td>
      <td>{field("name", false)}</td>
      <td>{field("packQty")}</td>
      <td>{field("weightG")}</td>
      <td>{field("lengthMm")}</td>
      <td>{field("widthMm")}</td>
      <td>{field("heightMm")}</td>
      <td>{field("price")}</td>
      <td className="num-c">{field("stockQty")}</td>
      <td>
        <input
          type="checkbox"
          checked={f.discontinued}
          onChange={(e) => {
            const next = { ...f, discontinued: e.target.checked };
            setF(next);
            save(next);
          }}
        />
      </td>
    </tr>
  );
}
