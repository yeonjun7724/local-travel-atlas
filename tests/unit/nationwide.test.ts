import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { parseAtlasData } from "@/lib/data/parse";
import { POI_GROUPS, poiStyle } from "@/lib/data/poi-style";

const dir = path.join(process.cwd(), "data", "nationwide");
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

describe("전국 모드 추천 코스 (data/nationwide)", () => {
  const data = parseAtlasData(read("yangjae-places.csv"), read("routes.json"), fs.readFileSync("data/categories.json", "utf8"), read("route-paths.json"));

  it("검증 통과 + 코스마다 OSMnx 실제 도보 경로", () => {
    expect(data.routes.length).toBeGreaterThanOrEqual(3);
    for (const r of data.routes) {
      const p = data.routePaths!.routes[r.routeId];
      expect(p, r.routeId).toBeDefined();
      expect(p.segments).toHaveLength(r.placeIds.length - 1);
    }
  });

  it("코스 방문지는 OSM 명소만(진흥공단 id 는 갱신 때 바뀔 수 있음)", () => {
    for (const r of data.routes) for (const id of r.placeIds) expect(id, r.routeId).toMatch(/^osm-[nwr]\d+$/);
  });

  it("동네 모드 코스 id 와 겹치지 않음(전국 모드에서 함께 표시)", () => {
    const local = JSON.parse(fs.readFileSync("data/routes.json", "utf8")) as { routeId: string }[];
    const ids = new Set(local.map((r) => r.routeId));
    for (const r of data.routes) expect(ids.has(r.routeId), r.routeId).toBe(false);
  });
});

describe("세부 업종별 핀 색·아이콘", () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it("그룹 색이 서로 다르고 흰 아이콘과 대비 3:1 이상", () => {
    expect(new Set(POI_GROUPS.map((g) => g.color)).size).toBe(POI_GROUPS.length);
    for (const g of POI_GROUPS) expect(1.05 / (lum(g.color) + 0.05), g.id).toBeGreaterThanOrEqual(3);
  });

  it("한 업종이 두 그룹에 들어가지 않음", () => {
    const all = POI_GROUPS.flatMap((g) => g.subtypes);
    expect(new Set(all).size).toBe(all.length);
  });

  it("동네 모드 CSV 의 음식점·카페 세부 업종은 모두 그룹이 있음", () => {
    const rows = Papa.parse<Record<string, string>>(fs.readFileSync("data/places.csv", "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data;
    const missing = [...new Set(rows.filter((r) => (r.category === "food" || r.category === "cafe") && r.subtype).map((r) => r.subtype))].filter(
      (s) => !POI_GROUPS.some((g) => g.subtypes.includes(s)),
    );
    expect(missing).toEqual([]);
  });

  it("그룹이 없으면 카테고리 색·아이콘", () => {
    const cat = { id: "nature", labelKo: "자연", labelEn: "Nature", color: "#15803d", icon: "trees" };
    expect(poiStyle({ category: "nature", subtype: "공원" }, cat)).toEqual({ color: "#15803d", icon: "trees" });
    expect(poiStyle({ category: "food", subtype: "치킨" }, cat).icon).toBe("drumstick");
  });
});
