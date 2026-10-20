import { expect, test } from "@playwright/test";
import fs from "node:fs";

// 요구된 5개 뷰포트에서 렌더링·가로 스크롤·핵심 요소 겹침을 확인하고 스크린샷을 남깁니다.
const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: false },
  { name: "desktop-1280", width: 1280, height: 800, mobile: false },
  { name: "wide-1920", width: 1920, height: 1080, mobile: false },
] as const;

for (const vp of VIEWPORTS) {
  test(`레이아웃 ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, isMobile: vp.mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto("/");
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(page.getByTestId("map-loading")).toHaveCount(0);
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(30);
    await page.waitForTimeout(2500); // 타일 로딩 대기(스크린샷용)

    // 가로 스크롤 없음
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // 모바일/데스크톱 구조
    if (vp.width < 768) {
      await expect(page.getByTestId("bottom-sheet")).toBeVisible();
      await expect(page.getByTestId("side-panel")).toHaveCount(0);
    } else {
      await expect(page.getByTestId("side-panel")).toBeVisible();
      await expect(page.getByTestId("bottom-sheet")).toHaveCount(0);
    }

    // 지도 컨트롤이 화면 안에 있고 바텀시트와 겹치지 않는다
    const controls = await page.getByTestId("map-controls").boundingBox();
    expect(controls).not.toBeNull();
    expect(controls!.x + controls!.width).toBeLessThanOrEqual(vp.width + 1);
    if (vp.mobile) {
      const sheet = await page.getByTestId("bottom-sheet").boundingBox();
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(sheet!.y + 1);
    }

    fs.mkdirSync("docs/screenshots", { recursive: true });
    await page.screenshot({ path: `docs/screenshots/${vp.name}.png` });

    // 상세 열기 → 스크린샷
    await page.getByTestId("marker-cafe-ivy").click();
    await expect(page.getByTestId("place-detail-cafe-ivy")).toBeVisible();
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `docs/screenshots/${vp.name}-detail.png` });
    await ctx.close();
  });
}
