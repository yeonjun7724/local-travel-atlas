import { defineConfig, devices } from "@playwright/test";

const launchOptions = {
  // 헤드리스 환경에서도 MapLibre(WebGL)가 동작하도록 소프트웨어 렌더러를 사용합니다.
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-report.json" }]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions },
  projects: [
    { name: "desktop", testIgnore: /routing-key\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, launchOptions } },
    { name: "mobile", testIgnore: /routing-key\.spec\.ts/, use: { ...devices["Pixel 7"], launchOptions } },
    // API 키가 "설정된" 빌드에서 경로 UI 와 오류 처리를 확인하는 프로젝트 (가짜 키 → 외부 API 가 거절하는 경로)
    { name: "with-key", testMatch: /routing-key\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, baseURL: "http://localhost:3101", launchOptions } },
  ],
  webServer: [
    { command: "npm run build && npx next start -p 3100", url: "http://localhost:3100", timeout: 240_000, reuseExistingServer: true },
    {
      command: "npx next build && npx next start -p 3101",
      url: "http://localhost:3101",
      timeout: 240_000,
      reuseExistingServer: true,
      env: { NEXT_DIST_DIR: ".next-ors", ORS_API_KEY: "invalid-test-key-for-e2e" },
    },
  ],
});
