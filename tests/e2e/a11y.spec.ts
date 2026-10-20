import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// 자동 접근성 검사(axe-core). 지도 캔버스·타일은 제외하고 UI 영역의 serious/critical 위반이 없는지 확인합니다.
// 자동 검사는 접근성 문제의 일부(약 30~40%)만 잡으므로 수동 점검(키보드·스크린 리더)을 대체하지 않습니다.
async function scan(page: Page) {
  await page.waitForTimeout(600); // 등장 애니메이션(페이드)이 끝난 뒤 대비를 측정합니다
  const results = await new AxeBuilder({ page }).exclude(".maplibregl-canvas-container").analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}
const fmt = (v: Awaited<ReturnType<typeof scan>>) => v.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`).join("\n");

test("접근성(axe): 첫 화면", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-testid^="marker-"]').first()).toBeVisible();
  const v = await scan(page);
  expect(v, fmt(v)).toEqual([]);
});

test("접근성(axe): 장소 상세", async ({ page }) => {
  await page.goto("/?place=cafe-ivy");
  await expect(page.getByTestId("place-detail-cafe-ivy")).toBeVisible();
  const v = await scan(page);
  expect(v, fmt(v)).toEqual([]);
});

test("접근성(axe): 코스 화면", async ({ page }) => {
  await page.goto("/?route=history-tour");
  await expect(page.getByTestId("route-detail")).toBeVisible();
  const v = await scan(page);
  expect(v, fmt(v)).toEqual([]);
});

test("접근성(axe): 공유 대화상자 + 영어 화면", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("lang-en").click();
  await page.getByTestId("share-button").click();
  await expect(page.getByTestId("qr-image")).toBeVisible();
  const v = await scan(page);
  expect(v, fmt(v)).toEqual([]);
});
