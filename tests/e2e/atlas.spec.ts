import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 768;
const shot = async (page: Page, name: string) => {
  fs.mkdirSync("docs/screenshots", { recursive: true });
  await page.screenshot({ path: `docs/screenshots/${name}.png` });
};

async function openApp(page: Page, search = "") {
  await page.goto("/" + search);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.locator('[data-testid^="marker-"]').first()).toBeVisible();
}

/** 모바일에서 시트가 접혀 있으면 펼칩니다 */
async function ensureListVisible(page: Page) {
  if (isMobile(page) && (await page.getByTestId("bottom-sheet").getAttribute("data-state")) === "collapsed") {
    await page.getByTestId("list-toggle").click();
  }
}

test.describe("지도와 장소", () => {
  test("지도가 렌더링되고 마커 30개가 표시된다", async ({ page }) => {
    await openApp(page);
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(30);
    await expect(page.getByRole("alert").filter({ hasText: /지도를 불러오지/ })).toHaveCount(0);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible(); // 출처 표시 유지(시트에 가리지 않음)
    await expect(page.getByTestId("brand")).toHaveText("LOCAL ATLAS");
    await expect(page.getByTestId("map-loading")).toHaveCount(0);
  });

  test("출처 표시가 바텀시트에 가리지 않는다", async ({ page }) => {
    await openApp(page);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
    const attrib = await page.locator(".maplibregl-ctrl-attrib").boundingBox();
    expect(attrib).not.toBeNull();
    if (isMobile(page)) {
      const sheet = await page.getByTestId("bottom-sheet").boundingBox();
      expect(attrib!.y + attrib!.height).toBeLessThanOrEqual(sheet!.y + 2);
    }
  });

  test("지도 컨트롤·목록 토글이 출처 표시를 가리지 않는다", async ({ page }) => {
    await openApp(page);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible();
    const attrib = (await page.locator(".maplibregl-ctrl-attrib").boundingBox())!;
    const targets = ["locate-button", "reset-button", ...(isMobile(page) ? ["list-toggle"] : ["zoom-out"])];
    for (const id of targets) {
      const b = (await page.getByTestId(id).boundingBox())!;
      const overlap = !(b.x + b.width <= attrib.x || b.x >= attrib.x + attrib.width || b.y + b.height <= attrib.y || b.y >= attrib.y + attrib.height);
      expect(overlap, `${id} overlaps attribution`).toBe(false);
    }
  });

  test("가상 샘플 안내가 보인다", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await expect(page.getByTestId("sample-banner")).toBeVisible();
  });

  test("테마 필터가 마커와 목록을 함께 바꾼다", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await expect(page.getByTestId("result-count")).toHaveText("30곳");
    await page.getByTestId("chip-cafe").click();
    await expect(page.getByTestId("chip-cafe")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("result-count")).toHaveText("7곳");
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(7);
    await expect(page.locator('[data-testid^="place-item-"]')).toHaveCount(7);
    await page.getByTestId("reset-filters").click();
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(30);
  });

  test("검색 + 필터를 함께 적용하고, 결과 없음 안내와 초기화", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByLabel("장소 검색").fill("국수");
    await expect(page.getByTestId("result-count")).toHaveText("1곳");
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(1);
    // 필터와 검색이 충돌하지 않고 교집합으로 동작
    await page.getByTestId("chip-cafe").click();
    await expect(page.getByTestId("result-count")).toHaveText("0곳");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await page.getByTestId("chip-cafe").click(); // 토글 해제
    await expect(page.getByTestId("result-count")).toHaveText("1곳");
    await page.getByLabel("장소 검색").fill("zzzz없는장소");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(0);
    await page.getByTestId("reset-filters").click();
    await expect(page.getByTestId("result-count")).toHaveText("30곳");
    await expect(page.getByLabel("장소 검색")).toHaveValue("");
  });

  test("검색어 지우기 버튼과 Esc", async ({ page }) => {
    await openApp(page);
    await page.getByLabel("장소 검색").fill("카페");
    await page.getByTestId("search-clear").click();
    await expect(page.getByLabel("장소 검색")).toHaveValue("");
    await page.getByLabel("장소 검색").fill("카페");
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("장소 검색")).toHaveValue("");
  });

  test("마커를 눌러도 목록 카드를 눌러도 같은 장소 상세가 열린다", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    // 1) 마커 → 상세 + 팝업 + 목록 카드 활성
    await page.getByTestId("marker-cafe-ivy").click();
    await expect(page.getByTestId("place-detail-cafe-ivy")).toBeVisible();
    await expect(page.getByTestId("place-item-cafe-ivy")).toHaveAttribute("aria-current", "true");
    await expect(page.getByTestId("marker-cafe-ivy")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".maplibregl-popup")).toContainText("담쟁이 로스터리");
    const link = page.getByTestId("place-detail-cafe-ivy").getByRole("link", { name: "외부 길찾기" });
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("target", "_blank");
    if (!isMobile(page)) await shot(page, "desktop-detail-flow");
    // 2) 뒤로 → 목록 복귀, 카드로 포커스 복원
    await page.getByTestId("detail-back").click();
    await expect(page.getByTestId("place-detail-cafe-ivy")).toHaveCount(0);
    await expect(page.getByTestId("place-item-cafe-ivy")).toBeVisible();
    await expect(page.getByTestId("place-item-cafe-ivy")).toBeFocused();
    // 3) 목록 카드 → 같은 상세 + 팝업 이동
    await page.getByTestId("place-item-food-hansang").click();
    await expect(page.getByTestId("place-detail-food-hansang")).toBeVisible();
    await expect(page.locator(".maplibregl-popup")).toContainText("한상 식당");
    await expect(page.getByTestId("marker-food-hansang")).toHaveAttribute("aria-pressed", "true");
  });

  test("상세에서 이 장소가 포함된 코스로 이동한다", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("marker-cafe-ivy").click();
    await expect(page.getByTestId("detail-routes")).toBeVisible();
    await page.getByTestId("detail-route-cafe-alley-walk").click();
    await expect(page.getByTestId("route-title")).toHaveText("감성 카페와 골목 산책");
    await expect(page.locator(".atlas-marker--numbered")).toHaveCount(7);
  });

  test("키보드: / 로 검색 포커스, Tab 으로 칩 선택, Esc 로 상세 닫기", async ({ page }) => {
    test.skip(isMobile(page), "키보드 흐름은 데스크톱 기준");
    await openApp(page);
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(page.getByLabel("장소 검색")).toBeFocused();
    await page.keyboard.press("Tab"); // 지우기 버튼이 없으면 다음 컨트롤
    await page.getByTestId("chip-nature").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("chip-nature")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("result-count")).toHaveText("6곳");
    await page.getByTestId("place-item-nature-stream").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("place-detail-nature-stream")).toBeVisible();
    await expect(page.locator("#place-detail-title")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("place-detail-nature-stream")).toHaveCount(0);
  });
});

test.describe("추천 코스", () => {
  test("코스 3종 → 번호 마커 순서 + 직선 연결선 안내", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("tab-routes").click();
    await expect(page.locator('[data-testid^="route-card-"]')).toHaveCount(3);
    if (!isMobile(page)) await shot(page, "desktop-routes");
    await page.getByTestId("route-card-cafe-alley-walk").click();
    await expect(page.getByTestId("route-title")).toHaveText("감성 카페와 골목 산책");
    const numbered = page.locator(".atlas-marker--numbered");
    await expect(numbered).toHaveCount(7);
    expect((await numbered.allTextContents()).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    await expect(page.getByTestId("map-container")).toHaveAttribute("data-route-line", "straight");
    await expect(page.getByTestId("straight-notice")).toContainText("직선 연결선");
    const stops = page.getByTestId("route-stops").locator('[data-testid^="place-item-"]');
    await expect(stops).toHaveCount(7);
    await expect(stops.first()).toContainText("담쟁이 로스터리");
    await expect(stops.last()).toContainText("달빛 디저트");
    // 키가 없으면 이동시간을 꾸며내지 않고 안내만 한다
    await expect(page.getByTestId("routing-disabled")).toBeVisible();
    await expect(page.getByTestId("load-times")).toHaveCount(0);
    await expect(page.getByTestId("route-summary")).toHaveCount(0);
    // 방문지 → 상세(코스 N번째) → 코스로 복귀
    await stops.nth(2).click();
    await expect(page.getByTestId("place-detail-food-noodle-alley")).toBeVisible();
    await expect(page.getByTestId("detail-route-order")).toContainText("3");
    await page.getByTestId("detail-back").click();
    await expect(page.getByTestId("route-title")).toBeVisible();
    await page.getByTestId("route-back").click();
    await expect(page.locator('[data-testid^="route-card-"]')).toHaveCount(3);
    await expect(page.getByTestId("map-container")).toHaveAttribute("data-route-line", "none");
  });

  test("3개 코스 모두 열린다 (5~8곳)", async ({ page }) => {
    await openApp(page);
    for (const id of ["cafe-alley-walk", "history-tour", "nature-weekend"]) {
      await page.getByTestId("tab-routes").click();
      if (await page.getByTestId("route-back").count()) await page.getByTestId("route-back").click();
      await page.getByTestId(`route-card-${id}`).click();
      const n = await page.locator(".atlas-marker--numbered").count();
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(8);
    }
  });

  test("경로 API 미설정 시 서버가 503 not_configured", async ({ request }) => {
    const res = await request.post("/api/route", { data: { routeId: "cafe-alley-walk", mode: "walking" } });
    expect(res.status()).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
  });
});

test.describe("다국어", () => {
  test("영어 전환 + 새로고침 후 유지 + 모든 UI 문구 번역 + 영어 누락 폴백", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("lang-en").click();
    await expect(page.getByTestId("tab-places")).toHaveText(/Explore/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await expect(page.getByTestId("lang-en")).toHaveAttribute("aria-pressed", "true");
    await ensureListVisible(page);
    await expect(page.getByTestId("sample-banner")).toContainText("Fictional");
    await expect(page.getByLabel("Search places")).toBeVisible();
    await expect(page.getByTestId("chip-cafe")).toContainText("Cafés");
    await expect(page.getByTestId("result-count")).toHaveText("30 places");
    await expect(page.getByTestId("locate-button")).toHaveAttribute("aria-label", "My location");
    await expect(page.getByTestId("reset-button")).toHaveAttribute("aria-label", "Reset view");
    await page.getByTestId("marker-cafe-ivy").click();
    await expect(page.locator(".maplibregl-popup")).toContainText("Ivy Roastery");
    await expect(page.getByTestId("detail-back")).toContainText("Back to list");
    await expect(page.getByTestId("place-detail-cafe-ivy")).toContainText("Included in these routes");
    await page.getByTestId("detail-back").click();
    // 영어 번역이 없는 장소는 한국어 + 안내
    await page.getByLabel("Search places").fill("국밥");
    await page.getByTestId("marker-food-gukbap").click();
    await expect(page.getByTestId("place-detail-food-gukbap")).toContainText("No English translation");
    if (!isMobile(page)) await shot(page, "desktop-en");
    await page.getByTestId("lang-ko").click();
    await expect(page.getByTestId("tab-places")).toHaveText(/장소 탐색/);
  });
});

test.describe("현재 위치", () => {
  test("권한 거부 시 안내만 보이고 지도는 계속 동작한다", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    // 헤드리스 Chromium 은 권한 요청을 거부로 처리합니다. 명시적으로 PERMISSION_DENIED 를 흉내 냅니다.
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, err) =>
        err?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await openApp(page);
    await page.getByTestId("locate-button").click();
    await expect(page.getByTestId("toast-text")).toContainText("위치 권한이 거부");
    await expect(page.getByTestId("toast")).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("user-marker")).toHaveCount(0);
    await expect(page.getByTestId("locate-button")).toBeEnabled();
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(30);
    await ctx.close();
  });

  test("권한 허용 시 내 위치 마커와 성공 안내", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, permissions: ["geolocation"], geolocation: { latitude: 35.8155, longitude: 127.1535 } });
    const page = await ctx.newPage();
    await openApp(page);
    await page.getByTestId("locate-button").click();
    await expect(page.getByTestId("user-marker")).toBeVisible();
    await expect(page.getByTestId("toast-text")).toContainText("내 위치로 이동");
    await ctx.close();
  });

  test("페이지 접속만으로는 위치 권한을 요청하지 않는다", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __geoCalls: number };
      w.__geoCalls = 0;
      const orig = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      navigator.geolocation.getCurrentPosition = (...a) => {
        w.__geoCalls++;
        return orig(...a);
      };
      navigator.geolocation.watchPosition = () => {
        w.__geoCalls++;
        return 0;
      };
    });
    await openApp(page);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls)).toBe(0);
    await ctx.close();
  });
});

test.describe("공유 / QR", () => {
  test("공유 대화상자: URL, QR, 로컬 주소 안내, 범위 전환", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("share-button").click();
    const dlg = page.getByTestId("share-dialog");
    await expect(dlg).toBeVisible();
    await expect(page.getByTestId("share-url")).toHaveValue(/^http:\/\/localhost:3100\/$/);
    await expect(page.getByTestId("qr-image")).toBeVisible();
    await expect(page.getByTestId("local-notice")).toBeVisible();
    expect(await page.getByTestId("qr-download").getAttribute("href")).toMatch(/^data:image\/png;base64,/);
    await expect(page.getByTestId("scope-route")).toBeDisabled();
    await expect(page.getByTestId("scope-place")).toBeDisabled();
    await shot(page, isMobile(page) ? "mobile-share" : "desktop-share");
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
  });

  test("코스·장소 공유 URL 에 id 가 담긴다", async ({ page }) => {
    await openApp(page, "?route=history-tour&place=history-museum");
    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("scope-place")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("share-url")).toHaveValue(/route=history-tour&place=history-museum/);
    await page.getByTestId("scope-route").click();
    await expect(page.getByTestId("share-url")).toHaveValue(/\?route=history-tour$/);
    await page.getByTestId("scope-map").click();
    await expect(page.getByTestId("share-url")).toHaveValue(/3100\/$/);
  });

  test("상세의 '이 장소 공유' 버튼이 장소 범위로 열린다", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("marker-cafe-ivy").click();
    await page.getByTestId("share-place").click();
    await expect(page.getByTestId("scope-place")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("share-url")).toHaveValue(/\?place=cafe-ivy$/);
  });

  test("공유 링크를 열면 코스와 장소가 자동 선택된다", async ({ page }) => {
    await openApp(page, "?route=history-tour&place=history-museum");
    await expect(page.getByTestId("place-detail-history-museum")).toBeVisible();
    await expect(page.getByTestId("detail-route-order")).toContainText("4");
    await expect(page.locator(".atlas-marker--numbered")).toHaveCount(7);
    await page.getByTestId("detail-back").click();
    await expect(page.getByTestId("route-title")).toHaveText("역사문화 탐방 코스");
  });

  test("잘못된 공유 파라미터는 무시된다", async ({ page }) => {
    await openApp(page, "?place=nope&route=%3Cscript%3E");
    await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(30);
    await expect(page.getByTestId("route-detail")).toHaveCount(0);
  });

  test("URL 복사", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
    await openApp(page);
    await page.getByTestId("share-button").click();
    await page.getByTestId("copy-url").click();
    await expect(page.getByTestId("copy-url")).toContainText(/복사했어요|링크 복사/);
  });
});

test.describe("반응형 / 바텀시트", () => {
  test("모바일: 바텀시트 + 칩 + 상단 검색 / 데스크톱: 사이드 패널", async ({ page }) => {
    await openApp(page);
    if (isMobile(page)) {
      await expect(page.getByTestId("bottom-sheet")).toBeVisible();
      await expect(page.getByTestId("side-panel")).toHaveCount(0);
      await expect(page.getByTestId("theme-chips")).toBeVisible();
      await expect(page.getByLabel("장소 검색")).toBeVisible();
      await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "half");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    } else {
      await expect(page.getByTestId("side-panel")).toBeVisible();
      await expect(page.getByTestId("bottom-sheet")).toHaveCount(0);
    }
  });

  test("모바일: 손잡이 탭으로 단계 순환, 목록/지도 토글", async ({ page }) => {
    test.skip(!isMobile(page), "모바일 전용");
    await openApp(page);
    await page.getByTestId("sheet-handle").click();
    await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "full");
    await page.getByTestId("sheet-handle").click();
    await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "collapsed");
    await page.getByTestId("list-toggle").click();
    await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "half");
    await page.getByTestId("list-toggle").click();
    await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "collapsed");
    // 접힌 상태의 목록은 포커스/읽기 대상에서 제외
    await expect(page.locator("#panel-content")).toHaveAttribute("aria-hidden", "true");
  });

  test("모바일: 손잡이를 끌어서(drag) 높이를 바꾸면 가까운 단계로 스냅", async ({ page }) => {
    test.skip(!isMobile(page), "모바일 전용");
    await openApp(page);
    const sheet = page.getByTestId("bottom-sheet");
    const drag = async (dy: number) => {
      const box = (await page.getByTestId("sheet-handle").boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + dy / 2, { steps: 5 });
      await page.mouse.move(x, y + dy, { steps: 5 });
      await page.mouse.up();
    };
    await drag(-300); // 위로 → 전체
    await expect(sheet).toHaveAttribute("data-state", "full");
    await drag(500); // 아래로 → 접힘
    await expect(sheet).toHaveAttribute("data-state", "collapsed");
    await drag(-130); // 조금 위로 → 절반
    await expect(sheet).toHaveAttribute("data-state", "half");
  });

  test("모바일: 지도를 직접 끌어도 시트가 튀어 오르거나 페이지가 흔들리지 않는다", async ({ page }) => {
    test.skip(!isMobile(page), "모바일 전용");
    await openApp(page);
    await page.getByTestId("sheet-handle").click(); // full
    // 전체 상태에서도 위쪽 검색 바는 가려지지 않는다
    await expect(page.getByLabel("장소 검색")).toBeInViewport();
    await page.getByTestId("sheet-handle").click(); // collapsed
    const box = (await page.getByTestId("map-container").boundingBox())!;
    await page.mouse.move(box.x + 120, box.y + 300);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 340, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "collapsed");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("모바일: 마커를 누르면 접힌 시트가 열려 상세를 보여 준다", async ({ page }) => {
    test.skip(!isMobile(page), "모바일 전용");
    await openApp(page);
    await page.getByTestId("sheet-handle").click(); // full
    await page.getByTestId("sheet-handle").click(); // collapsed
    await page.getByTestId("marker-cafe-ivy").click({ force: true });
    await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "half");
    await expect(page.getByTestId("place-detail-cafe-ivy")).toBeVisible();
  });

  test("지도 컨트롤: 확대·축소(마우스 환경)·처음 위치", async ({ page }) => {
    await openApp(page);
    await expect(page.getByTestId("locate-button")).toBeVisible();
    await expect(page.getByTestId("reset-button")).toBeVisible();
    if (!isMobile(page)) {
      await page.getByTestId("zoom-in").click();
      await page.getByTestId("zoom-out").click();
      await page.getByTestId("zoom-out").click();
      await page.getByTestId("reset-button").click();
      await expect(page.locator('[data-testid^="marker-"]')).toHaveCount(30);
    } else {
      // 터치 기기에서는 핀치로 조작하므로 버튼을 숨겨 화면을 비웁니다
      await expect(page.getByTestId("zoom-in")).toBeHidden();
    }
  });

  test("터치 대상 크기가 충분하다(최소 40px)", async ({ page }) => {
    await openApp(page);
    for (const id of ["share-button", "locate-button", "reset-button", "lang-en", "chip-cafe"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height, id).toBeGreaterThanOrEqual(40);
      expect(box!.width, id).toBeGreaterThanOrEqual(40);
    }
  });

  test("모션 줄이기 설정을 존중한다", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await openApp(page);
    const dur = await page.getByTestId("share-button").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(dur).toBe("0s");
    await ctx.close();
  });
});

test.describe("안정성", () => {
  test("지도 스타일 로딩 실패 시 안내와 재시도 버튼, 나머지 UI 는 동작", async ({ page }) => {
    await page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: "지도를 불러오지" })).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
    await ensureListVisible(page);
    await expect(page.getByTestId("result-count")).toHaveText("30곳");
  });

  test("오프라인 전환 시 안내가 표시되고 복귀 시 알려 준다", async ({ page, context }) => {
    await openApp(page);
    await context.setOffline(true);
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await expect(page.getByTestId("toast-text")).toContainText("오프라인");
    await context.setOffline(false);
    await expect(page.getByTestId("offline-banner")).toHaveCount(0);
    await expect(page.getByTestId("toast-text")).toContainText("다시 연결");
  });
});
