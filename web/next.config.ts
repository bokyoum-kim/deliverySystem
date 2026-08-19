import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 회사(테넌트) 생성 시 prisma/migrations/*.sql을 런타임에 읽어서 새 스키마에 재생하고,
  // schema.prisma를 읽어 재생된 테이블 수가 맞는지 가드레일 검사를 한다(src/lib/tenant-provision.ts).
  // 파일 트레이싱이 기본적으로 이 파일들을 배포 번들에 안 실어주므로 명시적으로 포함시켜야 한다.
  outputFileTracingIncludes: {
    "/**/*": ["./prisma/migrations/**/*.sql", "./prisma/schema.prisma"],
  },
};

export default nextConfig;
