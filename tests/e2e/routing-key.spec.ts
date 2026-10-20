import { expect, test } from "@playwright/test";

// 가짜 키로 빌드한 서버(3101)에서 확인합니다. 외부 API 가 키를 거절하므로 "실패 처리"가 올바른지 검증합니다.
// 실제 유효한 키로 성공 응답을 받는 경로는 키가 필요하므로 TEST_REPORT 의 미검증 항목입니다.
test("키가 있으면 이동시간 버튼이 보이고, 실패해도 지도·코스는 정상 동작한다", async ({ page, request }) => {
  await page.goto("/?route=cafe-alley-walk");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("routing-disabled")).toHaveCount(0);
  await expect(page.getByTestId("load-times")).toBeVisible();

  await page.getByTestId("load-times").click();
  // 유효하지 않은 키 → 외부 API 거절 → 가상의 이동시간을 보여 주지 않고 오류 안내
  await expect(page.getByTestId("route-error")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("route-summary")).toHaveCount(0);
  await expect(page.getByTestId("map-container")).toHaveAttribute("data-route-line", "straight");
  await expect(page.locator(".atlas-marker--numbered")).toHaveCount(7);

  // 입력 검증
  const bad = await request.post("/api/route", { data: { routeId: "../../x", mode: "walking" } });
  expect(bad.status()).toBe(400);
  const badMode = await request.post("/api/route", { data: { routeId: "cafe-alley-walk", mode: "flying" } });
  expect(badMode.status()).toBe(400);
  const unknown = await request.post("/api/route", { data: { routeId: "no-such-route", mode: "walking" } });
  expect(unknown.status()).toBe(404);
});
