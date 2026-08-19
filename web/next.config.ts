import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 회사(테넌트) 생성 시 prisma/migrations/*.sql을 런타임에 읽어서 새 스키마에 재생한다
  // (src/lib/tenant-provision.ts). 파일 트레이싱이 기본적으로 이 SQL 파일들을 배포 번들에
  // 안 실어주므로 명시적으로 포함시켜야 한다.
  outputFileTracingIncludes: {
    "/**/*": ["./prisma/migrations/**/*.sql"],
  },
};

export default nextConfig;
