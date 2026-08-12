// 한글 등 비ASCII 파일명은 Content-Disposition 헤더에 바로 못 넣으므로(ByteString만 허용)
// RFC 5987 filename*= 형식으로 인코딩한다. 오래된 클라이언트 대비 ASCII 대체명도 같이 넣는다.
export function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
