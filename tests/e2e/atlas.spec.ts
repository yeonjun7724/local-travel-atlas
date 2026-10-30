import { expect, test } from "@playwright/test";
import { countOf, data, ensureListVisible, GYEONGGIJEON, isMobile, openApp, PUNGNAMMUN, routePaths, routes, shot } from "./helpers";

test.describe("지도·클러스터·실데이터", () => {
  test("지도가 렌더링되고 1,000곳 이상이 클러스터로 표시된다", async ({ page }) => {
    await openApp(page);
    expect(data.total).toBeGreaterThan(1000);
    await expect(page.getByTestId("cluster").first()).toBeVisible();
    const clustered = await page.getByTestId("cluster").allTextContents();
    expect(clustered.reduce((s, x) => s + Number(x), 0)).toBeGreaterThan(50);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible(); // 지도 출처 표시
    await expect(page.getByTestId("brand")).toHaveText("LOCAL ATLAS");
    await expect(page.getByTestId("region-name")).toContainText("전주 한옥마을");
    await expect(page.getByTestId("sample-banner")).toHaveCount(0); // 가상 샘플 아님
  });

  test("클러스터를 누르면 확대되어 더 잘게 나뉜다", async ({ page }) => {
    await openApp(page);
    const cluster = page.getByTestId("cluster").first();
    const n = Number(await cluster.textContent());
    const before = await page.locator('[data-testid="cluster"], [data-testid^="marker-"]').count();
    await cluster.click({ force: true });
    await expect
      .poll(async () => (await page.locator('[data-testid="cluster"], [data-testid^="marker-"]').count()) !== before || n <= 1, { timeout: 10_000 })
      .toBe(true);
  });

  test("목록은 '현재 지도 영역' 기준이고, 지도를 옮기면 '이 지역에서 다시 찾기'가 나타난다", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await expect(page.getByTestId("tag-area")).toBeVisible();
    await expect(page.getByTestId("result-count")).toHaveText(/이 지역 \d+곳/);
    const before = countOf(await page.getByTestId("result-count").textContent());
    expect(before).toBeGreaterThan(0);
    expect(before).toBeLessThan(data.total);
    // 지도를 키보드 방향키로 이동(MapLibre keyboard 핸들러) — 터치 에뮬레이션에서도 동일하게 동작
    await page.locator(".maplibregl-canvas").focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1200); // 관성 이동이 끝나 마지막 moveend 까지 반영된 뒤 누릅니다
    await expect(page.getByTestId("search-area")).toBeVisible();
    await page.getByTestId("search-area").click();
    await expect(page.getByTestId("search-area")).toHaveCount(0);
    await expect(page.getByTestId("result-count")).toHaveText(/이 지역 \d+곳/);
    // 영역 조건 해제 → 전체
    await page.getByTestId("tag-area").click();
    await expect(page.getByTestId("result-count")).toHaveText(`전체 ${data.total}곳`);
  });

  test("같은 건물에 겹친 장소: 끝까지 확대해도 나뉘지 않는 클러스터를 누르면 그 위치의 목록이 열린다", async ({ page }) => {
    const stack = data.largestStack();
    expect(stack.length).toBeGreaterThan(3);
    await openApp(page, `?place=${stack[0]}`);
    await page.getByTestId("detail-back").click();
    // 지도 중심(= 겹친 위치)에 가장 가까운 클러스터를 누릅니다
    await page.waitForTimeout(800);
    const map = (await page.getByTestId("map-container").boundingBox())!;
    const cx = map.x + map.width / 2;
    const cy = map.y + map.height * (isMobile(page) ? 0.3 : 0.5);
    const clusters = page.getByTestId("cluster");
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < (await clusters.count()); i++) {
      const b = await clusters.nth(i).boundingBox();
      if (!b) continue;
      const d = Math.hypot(b.x + b.width / 2 - cx, b.y + b.height / 2 - cy);
      if (d < bestD) [best, bestD] = [i, d];
    }
    expect(best).toBeGreaterThanOrEqual(0);
    // 줌 18 이상에서도 나뉘지 않을 때까지(최대 3번) 클러스터를 누릅니다
    for (let i = 0; i < 3 && !(await page.getByTestId("tag-stack").count()); i++) {
      await clusters.nth(best).click({ force: true });
      await page.waitForTimeout(800);
    }
    await expect(page.getByTestId("tag-stack")).toBeVisible();
    await ensureListVisible(page);
    await expect(page.getByTestId("result-count")).toHaveText(/이 위치의 장소 \d+곳/);
    expect(countOf(await page.getByTestId("result-count").textContent())).toBeGreaterThanOrEqual(stack.length);
    await expect(page.getByTestId(`place-item-${stack[1]}`)).toBeVisible();
    await page.getByTestId("tag-stack").click();
    await expect(page.getByTestId("result-count")).not.toHaveText(/이 위치/);
  });

  test("필터만 바꾸고 지도를 움직이지 않으면 '다시 찾기' 버튼이 나오지 않는다", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByTestId("chip-cafe").click();
    await page.waitForTimeout(1500); // 결과에 맞춰 지도가 이동을 마칠 때까지
    await expect(page.getByTestId("search-area")).toHaveCount(0);
    await page.locator(".maplibregl-canvas").focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1200);
    await expect(page.getByTestId("search-area")).toBeVisible();
  });

  test("테마 필터 → 전체 결과, 세부 종류 칩 → 정확한 개수(CSV 와 일치)", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByTestId("chip-food").click();
    await expect(page.getByTestId("chip-food")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("result-count")).toHaveText(`전체 ${data.count("food")}곳`);
    const sub = page.getByTestId("subtype-chips").getByRole("button").first();
    const label = (await sub.textContent())!.replace(/\s*\d+$/, "").trim();
    await sub.click();
    await expect(page.getByTestId("result-count")).toHaveText(`전체 ${data.subtypeCount("food", label)}곳`);
    await expect(page.getByTestId("tag-subtype")).toContainText(label);
    await page.getByTestId("reset-filters").click();
    await expect(page.getByTestId("result-count")).toHaveText(`전체 ${data.total}곳`);
  });

  test("검색 + 결과 없음 + 초기화", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByLabel("장소 검색").fill("경기전");
    await expect(page.getByTestId("result-count")).toHaveText(`전체 ${data.match("경기전").length}곳`);
    await expect(page.getByTestId(`place-item-${GYEONGGIJEON}`)).toBeVisible();
    await page.getByLabel("장소 검색").fill("zzzz없는장소");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await page.getByTestId("reset-filters").click();
    await expect(page.getByLabel("장소 검색")).toHaveValue("");
  });

  test("목록 카드 → 상세(실사진 + 저작자 표기 + 출처 링크) → 지도 핀 선택 동기화 → 뒤로", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByLabel("장소 검색").fill("경기전");
    await page.getByTestId(`place-item-${GYEONGGIJEON}`).click();
    const detail = page.getByTestId(`place-detail-${GYEONGGIJEON}`);
    await expect(detail).toBeVisible();
    await expect(detail.locator("img")).toHaveAttribute("src", /wikimedia\.org/);
    await expect(page.getByTestId("photo-credit")).toContainText("Wikimedia Commons");
    await expect(page.getByTestId("detail-sources")).toContainText("OpenStreetMap");
    await expect(page.getByTestId("detail-sources").getByRole("link").first()).toHaveAttribute("href", /openstreetmap\.org/);
    await expect(page.getByTestId(`marker-${GYEONGGIJEON}`)).toHaveAttribute("aria-pressed", "true");
    if (!isMobile(page)) await shot(page, "desktop-detail");
    await page.getByTestId("detail-back").click();
    await expect(page.getByTestId(`place-item-${GYEONGGIJEON}`)).toBeFocused();
  });

  test("지도 핀을 눌러도 같은 상세가 열리고 목록 카드와 동기화된다", async ({ page }) => {
    await openApp(page);
    /** 패널·검색바 등에 가리지 않고 실제로 눌리는 요소만 클릭(trial 로 확인) */
    const clickFirstHittable = async (selector: string) => {
      const items = page.locator(selector);
      const n = await items.count();
      for (let i = 0; i < n; i++) {
        const el = items.nth(i);
        try {
          await el.click({ trial: true, timeout: 500 });
          const tid = await el.getAttribute("data-testid");
          await el.click({ timeout: 2000 });
          return tid;
        } catch {
          // 가려진 요소 → 다음 후보
        }
      }
      return null;
    };
    let pinId: string | null = null;
    for (let i = 0; i < 6 && !pinId; i++) {
      pinId = await clickFirstHittable('[data-testid^="marker-"]');
      if (!pinId) {
        await clickFirstHittable('[data-testid="cluster"]');
        await page.waitForTimeout(900);
      }
    }
    expect(pinId).not.toBeNull();
    const id = pinId!.replace("marker-", "");
    await expect(page.getByTestId(`place-detail-${id}`)).toBeVisible();
    await expect(page.getByTestId(`marker-${id}`)).toHaveAttribute("aria-pressed", "true");
    // 목록에 그 장소 카드가 렌더링돼 있다면(현재 페이지 범위) 활성 표시가 동기화돼야 합니다
    if (await page.getByTestId(`place-item-${id}`).count()) await expect(page.getByTestId(`place-item-${id}`)).toHaveAttribute("aria-current", "true");
  });

  test("진흥공단 상가 상세: 출처·업종 표기", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByTestId("chip-cafe").click();
    const first = page.getByTestId("place-list").locator('[data-testid^="place-item-semas-"]').first();
    await first.click();
    await expect(page.getByTestId("detail-sources")).toContainText("소상공인시장진흥공단");
  });

  test("찜: 저장 → 찜한 곳 필터 → 새로고침 후 유지", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    const card = page.getByTestId("place-list").locator('[data-testid^="fav-"]').first();
    const id = (await card.getAttribute("data-testid"))!.replace("fav-", "");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("fav-filter").click();
    await expect(page.getByTestId("result-count")).toHaveText("전체 1곳");
    await expect(page.getByTestId(`place-item-${id}`)).toBeVisible();
    await page.reload();
    await ensureListVisible(page);
    await page.getByTestId("fav-filter").click();
    await expect(page.getByTestId(`place-item-${id}`)).toBeVisible();
    await page.getByTestId(`fav-${id}`).click();
    await expect(page.getByTestId("empty-state")).toBeVisible();
  });

  test("정렬: 가까운순(거리 표시) / 이름순", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    const dists = await page.getByTestId("place-list").getByTestId("card-distance").allTextContents();
    const meters = dists.slice(0, 10).map((d) => (d.endsWith("km") ? parseFloat(d) * 1000 : parseFloat(d)));
    expect(meters).toEqual([...meters].sort((a, b) => a - b));
    await page.getByTestId("sort-select").selectOption("name");
    const names = await page.getByTestId("place-list").locator('[data-testid^="place-item-"] .font-bold').allTextContents();
    expect(names.slice(0, 8)).toEqual([...names.slice(0, 8)].sort((a, b) => a.localeCompare(b, "ko")));
  });

  test("더 보기로 목록을 30곳씩 늘린다", async ({ page }) => {
    await openApp(page);
    await ensureListVisible(page);
    await page.getByTestId("tag-area").click();
    await expect(page.getByTestId("place-list").locator('[data-testid^="place-item-"]')).toHaveCount(30);
    await page.getByTestId("list-more").click();
    await expect(page.getByTestId("place-list").locator('[data-testid^="place-item-"]')).toHaveCount(60);
  });
});

test.describe("추천 코스 · OSMnx 실제 도보 경로", () => {
  test("코스 3종 + 도보 거리 요약", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("tab-routes").click();
    await expect(page.locator('[data-testid^="route-card-"]')).toHaveCount(3);
    for (const r of routes) await expect(page.getByTestId(`route-walk-${r.routeId}`)).toContainText("km");
    if (!isMobile(page)) await shot(page, "desktop-routes");
  });

  test("코스 선택 → 실제 경로선 + 번호 핀 + 구간별 거리·시간", async ({ page }) => {
    const r = routes[0];
    const rp = routePaths.routes[r.routeId];
    await openApp(page, `?route=${r.routeId}`);
    await expect(page.getByTestId("route-title")).toHaveText(r.titleKo);
    await expect(page.getByTestId("map-container")).toHaveAttribute("data-route-line", "real");
    await expect(page.getByTestId("walk-summary")).toContainText(`${(rp.totalDistanceM / 1000).toFixed(1)}km`);
    await expect(page.getByTestId("straight-notice")).toHaveCount(0);
    const numbered = page.locator(".atlas-pin--numbered");
    await expect(numbered).toHaveCount(r.placeIds.length);
    for (let i = 0; i < r.placeIds.length - 1; i++) {
      await expect(page.getByTestId(`segment-${i}`)).toContainText(`${rp.segments[i].distanceM >= 1000 ? (rp.segments[i].distanceM / 1000).toFixed(1) + "km" : Math.round(rp.segments[i].distanceM) + "m"}`);
    }
    if (!isMobile(page)) await shot(page, "desktop-route");
    // 방문지 → 상세(코스 n번째) → 코스로 복귀
    await page.getByTestId("route-stops").locator('[data-testid^="place-item-"]').nth(2).click();
    await expect(page.getByTestId("detail-route-order")).toContainText("3");
    await page.getByTestId("detail-back").click();
    await expect(page.getByTestId("route-title")).toBeVisible();
    await page.getByTestId("route-back").click();
    await expect(page.getByTestId("map-container")).toHaveAttribute("data-route-line", "none");
  });

  test("상세에서 포함된 코스로 이동", async ({ page }) => {
    await openApp(page, `?place=${GYEONGGIJEON}`);
    await expect(page.getByTestId("detail-routes")).toBeVisible();
    await page.getByTestId("detail-route-history-tour").click();
    await expect(page.getByTestId("route-title")).toHaveText(routes.find((x) => x.routeId === "history-tour")!.titleKo);
  });

  test("경로 API 미설정 시 서버가 503 not_configured", async ({ request }) => {
    const res = await request.post("/api/route", { data: { routeId: routes[0].routeId, mode: "walking" } });
    expect(res.status()).toBe(503);
  });
});

test.describe("다국어", () => {
  test("영어 전환·유지·위키데이터 영문 이름", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("lang-en").click();
    await expect(page.getByTestId("tab-places")).toHaveText(/Explore/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.reload();
    await ensureListVisible(page);
    await expect(page.getByTestId("result-count")).toHaveText(/\d+ in this area/);
    await expect(page.getByTestId("region-name")).toContainText("Jeonju Hanok Village");
    await page.getByLabel("Search places").fill("경기전");
    await page.getByTestId(`place-item-${GYEONGGIJEON}`).click();
    await expect(page.getByTestId(`place-detail-${GYEONGGIJEON}`)).toContainText(data.byId(GYEONGGIJEON).nameEn);
    await expect(page.getByTestId("detail-sources")).toContainText("Place data");
    await page.getByTestId("lang-ko").click();
    await expect(page.getByTestId("tab-places")).toHaveText(/장소 탐색/);
  });
});

test.describe("현재 위치", () => {
  test("권한 거부 시 안내만, 지도 유지", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_ok, err) =>
        err?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    });
    await openApp(page);
    await page.getByTestId("locate-button").click();
    await expect(page.getByTestId("toast-text")).toContainText("위치 권한이 거부");
    await expect(page.getByTestId("user-marker")).toHaveCount(0);
    await ctx.close();
  });

  test("권한 허용 → 내 위치 마커 + 내 위치 기준 거리", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, permissions: ["geolocation"], geolocation: { latitude: 35.8155, longitude: 127.1515 } });
    const page = await ctx.newPage();
    await openApp(page);
    await page.getByTestId("locate-button").click();
    await expect(page.getByTestId("user-marker")).toBeVisible();
    await ensureListVisible(page);
    await expect(page.getByText("내 위치 기준")).toBeVisible();
    await ctx.close();
  });

  test("접속만으로는 위치 권한을 요청하지 않는다", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const w = window as unknown as { __geoCalls: number };
      w.__geoCalls = 0;
      navigator.geolocation.getCurrentPosition = () => void w.__geoCalls++;
      navigator.geolocation.watchPosition = () => (w.__geoCalls++, 0);
    });
    await openApp(page);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls)).toBe(0);
    await ctx.close();
  });
});

test.describe("공유 / QR", () => {
  test("공유 대화상자: URL·QR·로컬 안내·범위", async ({ page }) => {
    await openApp(page);
    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-dialog")).toBeVisible();
    await expect(page.getByTestId("share-url")).toHaveValue(/^http:\/\/localhost:3100\/$/);
    await expect(page.getByTestId("qr-image")).toBeVisible();
    await expect(page.getByTestId("local-notice")).toBeVisible();
    expect(await page.getByTestId("qr-download").getAttribute("href")).toMatch(/^data:image\/png;base64,/);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("share-dialog")).toBeHidden();
  });

  test("공유 링크 → 코스+장소 자동 선택, 공유 URL 에 id 포함", async ({ page }) => {
    await openApp(page, `?route=history-tour&place=${PUNGNAMMUN}`);
    await expect(page.getByTestId(`place-detail-${PUNGNAMMUN}`)).toBeVisible();
    await expect(page.getByTestId("detail-route-order")).toContainText("3");
    await page.getByTestId("share-button").click();
    await expect(page.getByTestId("share-url")).toHaveValue(new RegExp(`route=history-tour&place=${PUNGNAMMUN}`));
  });

  test("잘못된 공유 파라미터는 무시", async ({ page }) => {
    await openApp(page, "?place=nope&route=%3Cscript%3E");
    await expect(page.getByTestId("route-detail")).toHaveCount(0);
    await expect(page.locator('[data-testid^="place-detail-"]')).toHaveCount(0);
  });
});

test.describe("반응형 / 바텀시트", () => {
  test("모바일 바텀시트 / 데스크톱 사이드 패널", async ({ page }) => {
    await openApp(page);
    if (isMobile(page)) {
      await expect(page.getByTestId("bottom-sheet")).toHaveAttribute("data-state", "half");
      await expect(page.getByTestId("side-panel")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
    } else {
      await expect(page.getByTestId("side-panel")).toBeVisible();
    }
  });

  test("모바일: 손잡이 탭 순환·드래그 스냅·목록 토글", async ({ page }) => {
    test.skip(!isMobile(page), "모바일 전용");
    await openApp(page);
    const sheet = page.getByTestId("bottom-sheet");
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-state", "full");
    await page.getByTestId("sheet-handle").click();
    await expect(sheet).toHaveAttribute("data-state", "collapsed");
    await page.getByTestId("list-toggle").click();
    await expect(sheet).toHaveAttribute("data-state", "half");
    const drag = async (dy: number) => {
      await page.waitForTimeout(350); // 시트 높이 전환 애니메이션(200ms)이 끝난 위치에서 시작
      const b = (await page.getByTestId("sheet-handle").boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + dy, { steps: 10 });
      await page.mouse.up();
    };
    await drag(-300);
    await expect(sheet).toHaveAttribute("data-state", "full");
    await drag(500);
    await expect(sheet).toHaveAttribute("data-state", "collapsed");
  });

  test("컨트롤이 출처 표시·시트를 가리지 않고 터치 영역이 충분하다", async ({ page }) => {
    await openApp(page);
    await expect(page.locator(".maplibregl-ctrl-attrib")).toBeVisible(); // 출처 컨트롤이 그려진 뒤에 위치를 잽니다
    const attrib = (await page.locator(".maplibregl-ctrl-attrib").boundingBox())!;
    for (const id of ["locate-button", "reset-button", "share-button"]) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.height, id).toBeGreaterThanOrEqual(40);
      const overlap = !(b.x + b.width <= attrib.x || b.x >= attrib.x + attrib.width || b.y + b.height <= attrib.y || b.y >= attrib.y + attrib.height);
      expect(overlap, `${id} overlaps attribution`).toBe(false);
    }
  });

  test("모션 줄이기 설정을 존중", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await openApp(page);
    expect(await page.getByTestId("share-button").evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
    await ctx.close();
  });
});

test.describe("안정성", () => {
  test("지도 스타일 로딩 실패 시 안내 + 목록은 동작", async ({ page }) => {
    await page.route("**/tiles.openfreemap.org/**", (r) => r.abort());
    await page.goto("/");
    await expect(page.getByRole("alert").filter({ hasText: "지도를 불러오지" })).toBeVisible();
    await ensureListVisible(page);
    await expect(page.getByTestId("result-count")).toBeVisible();
  });

  test("오프라인 전환 안내", async ({ page, context }) => {
    await openApp(page);
    await context.setOffline(true);
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  });

  test("콘솔 오류·하이드레이션 오류가 없다", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/tiles\.openfreemap|Failed to load resource/.test(m.text()) && errors.push(m.text()));
    await openApp(page, `?place=${GYEONGGIJEON}`);
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
});
