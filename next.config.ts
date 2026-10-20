import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // E2E 테스트에서 API 키가 있는 빌드를 별도 폴더에 만들기 위한 옵션 (평소에는 기본값 .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // data/ 폴더의 CSV·JSON은 서버에서 fs로 읽으므로 배포 번들에 포함시킵니다.
  outputFileTracingIncludes: { "/": ["./data/**/*"], "/api/route": ["./data/**/*"] },
};

export default nextConfig;
