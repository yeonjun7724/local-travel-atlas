import { describe, expect, it } from "vitest";
import { ORDER_COLORS, orderColor, segmentFeatures, splitByStops, type LngLat } from "@/lib/data/geojson";
import { nearestNeighborOrder } from "@/lib/geo";
import { moveItem } from "@/lib/my-route";
import { parseOsrm, walkSeconds, WalkError } from "@/lib/routing/osrm";
import { buildShareUrl, parseShareParams } from "@/lib/share";

describe("코스 순서 색", () => {
  it("순서마다 다른 색, 9곳 이후 반복", () => {
    expect(new Set(ORDER_COLORS).size).toBe(ORDER_COLORS.length);
    expect(orderColor(0)).not.toBe(orderColor(1));
    expect(orderColor(ORDER_COLORS.length)).toBe(orderColor(0));
  });

  it("흰 글자와 대비 4.5:1 이상 (번호 배지 가독성)", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const c of ORDER_COLORS) expect(1.05 / (lum(c) + 0.05), c).toBeGreaterThanOrEqual(4.5);
  });

  it("구간 피처에 순서 색이 붙는다", () => {
    const fc = segmentFeatures([
      [[0, 0], [1, 1]],
      [[1, 1], [2, 2]],
    ]);
    expect(fc.features.map((f) => f.properties?.color)).toEqual([orderColor(0), orderColor(1)]);
  });
});

describe("splitByStops — 이어진 경로를 방문지 기준 구간으로", () => {
  const stops: LngLat[] = [[0, 0], [2, 0], [2, 2]];
  const geometry: LngLat[] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]];

  it("방문지 좌표에서 정확히 나뉜다", () => {
    expect(splitByStops(geometry, stops)).toEqual([
      [[0, 0], [1, 0], [2, 0]],
      [[2, 0], [2, 1], [2, 2]],
    ]);
  });

  it("방문지가 1곳 이하면 빈 배열", () => {
    expect(splitByStops(geometry, [[0, 0]])).toEqual([]);
  });

  it("실제 추천 코스 경로를 방문지 수-1 구간으로 나눈다", async () => {
    const fs = await import("node:fs");
    const Papa = (await import("papaparse")).default;
    const csv = Papa.parse<Record<string, string>>(fs.readFileSync("data/places.csv", "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data;
    const byId = new Map(csv.map((r) => [r.id, [Number(r.longitude), Number(r.latitude)] as LngLat]));
    const routes = JSON.parse(fs.readFileSync("data/routes.json", "utf8")) as { routeId: string; placeIds: string[] }[];
    const paths = JSON.parse(fs.readFileSync("data/route-paths.json", "utf8")).routes as Record<string, { geometry: LngLat[] }>;
    for (const r of routes) {
      const segs = splitByStops(paths[r.routeId].geometry, r.placeIds.map((id) => byId.get(id)!));
      expect(segs, r.routeId).toHaveLength(r.placeIds.length - 1);
      expect(segs.every((s) => s.length >= 2), r.routeId).toBe(true);
    }
  });
});

describe("parseOsrm — OSRM 응답 → 구간별 도보 경로", () => {
  const stops: LngLat[] = [[127.1, 35.8], [127.2, 35.8], [127.2, 35.9]];
  const leg = (d: number, coords: number[][]) => ({ distance: d, steps: [{ geometry: { coordinates: coords } }] });

  it("구간 거리·4.5km/h 시간·형상", () => {
    const r = parseOsrm(
      { code: "Ok", routes: [{ distance: 300, legs: [leg(100.4, [[127.1001, 35.8], [127.2, 35.8001]]), leg(199.6, [[127.2, 35.8001], [127.2, 35.9]])] }] },
      stops,
    );
    expect(r.segments.map((s) => s.distanceM)).toEqual([100, 200]);
    expect(r.totalDistanceM).toBe(300);
    expect(r.segments[0].durationS).toBe(walkSeconds(100));
    expect(walkSeconds(4500)).toBe(3600);
    // 각 구간은 방문지에서 시작해 방문지에서 끝남
    expect(r.segments[0].geometry[0]).toEqual(stops[0]);
    expect(r.segments[0].geometry.at(-1)).toEqual(stops[1]);
    expect(r.geometry[0]).toEqual(stops[0]);
    expect(r.geometry.at(-1)).toEqual(stops[2]);
  });

  it("경로 없음 / 형식 오류", () => {
    expect(() => parseOsrm({ code: "NoRoute" }, stops)).toThrow(WalkError);
    expect(() => parseOsrm({ code: "Ok", routes: [{ distance: 1, legs: [] }] }, stops)).toThrow("bad_response");
    expect(() => parseOsrm(null, stops)).toThrow("bad_response");
  });
});

describe("내 코스 편집", () => {
  it("moveItem — 순서 바꾸기, 범위 밖은 그대로", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
    const same = ["a", "b"];
    expect(moveItem(same, 0, 5)).toBe(same);
    expect(moveItem(same, -1, 0)).toBe(same);
  });

  it("nearestNeighborOrder — 첫 장소 고정, 가까운 곳부터", () => {
    const pts: LngLat[] = [[0, 0], [3, 0], [1, 0], [2, 0]];
    expect(nearestNeighborOrder(pts)).toEqual([0, 2, 3, 1]);
    expect(nearestNeighborOrder([[0, 0], [1, 1]])).toEqual([0, 1]);
  });
});

describe("내 코스 공유 링크", () => {
  it("stops 를 순서대로 담고 다시 읽는다", () => {
    const url = buildShareUrl("https://example.com/", { routeId: "my-route", stops: ["b-1", "a-2"] });
    expect(url).toBe("https://example.com/?route=my-route&stops=b-1%2Ca-2");
    const parsed = parseShareParams(new URL(url).search, new Set(["a-2", "b-1"]), new Set(["history-tour"]));
    expect(parsed).toMatchObject({ routeId: "my-route", stops: ["b-1", "a-2"] });
  });

  it("없는 id·잘못된 형식·중복은 버리고, 남은 장소가 없으면 my-route 도 무시", () => {
    const p = parseShareParams("?route=my-route&stops=a,A!,zz,a", new Set(["a"]), new Set());
    expect(p.stops).toEqual(["a"]);
    expect(parseShareParams("?route=my-route&stops=zz", new Set(["a"]), new Set()).routeId).toBeUndefined();
  });

  it("전국 모드(유효 id 집합 없음)는 형식만 검사", () => {
    expect(parseShareParams("?place=semas-x1&stops=semas-a,BAD", null, new Set())).toMatchObject({ placeId: "semas-x1", stops: ["semas-a"] });
  });
});
