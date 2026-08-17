"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProduct } from "./actions";

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
  return (
    <table>
      <thead>
        <tr>
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
          <Row key={p.id} product={p} />
        ))}
        {products.length === 0 && (
          <tr>
            <td colSpan={11} className="muted" style={{ textAlign: "center", padding: 24 }}>
              상품이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Row({ product }: { product: ProductRow }) {
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
