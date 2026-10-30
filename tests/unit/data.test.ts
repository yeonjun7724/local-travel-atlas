import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DataValidationError, parseAtlasData } from "@/lib/data/parse";
import { haversineMeters } from "@/lib/geo";

const dir = path.join(process.cwd(), "data");
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const csv = read("places.csv");
const routes = read("routes.json");
const cats = read("categories.json");
const paths = read("route-paths.json");

describe("실데이터 (data/)", () => {
  const data = parseAtlasData(csv, routes, cats, paths);

  it("장소 30곳 이상, 코스 3종(각 5~8곳)", () => {
    expect(data.places.length).toBeGreaterThanOrEqual(30);
    expect(data.routes).toHaveLength(3);
    for (const r of data.routes) {
      expect(r.placeIds.length).toBeGreaterThanOrEqual(5);
      expect(r.placeIds.length).toBeLessThanOrEqual(8);
    }
  });

  it("가상 샘플이 남아 있지 않다", () => {
    expect(data.places.filter((p) => p.isSample)).toEqual([]);
  });

  it("모든 장소에 출처·라이선스가 있고, 출처는 OSM 또는 소상공인시장진흥공단이다", () => {
    for (const p of data.places) {
      expect(p.source).toMatch(/OpenStreetMap|소상공인시장진흥공단/);
      expect(p.license.length).toBeGreaterThan(0);
      if (p.source.includes("OpenStreetMap")) expect(p.sourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\/\d+$/);
    }
  });

  it("사진은 Wikimedia Commons 이고 저작자·라이선스 표기가 함께 있다", () => {
    const withImg = data.places.filter((p) => p.imageUrl);
    expect(withImg.length).toBeGreaterThan(0);
    for (const p of withImg) {
      expect(p.imageUrl).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
      expect(p.imageCredit).toMatch(/Wikimedia Commons/);
      expect(p.imageSourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("좌표가 모두 전주 한옥마을 일대 범위 안에 있다(좌표 오입력 탐지)", () => {
    for (const p of data.places) {
      expect(p.latitude).toBeGreaterThan(35.8);
      expect(p.latitude).toBeLessThan(35.83);
      expect(p.longitude).toBeGreaterThan(127.13);
      expect(p.longitude).toBeLessThan(127.17);
    }
  });

  it("코스는 상업 시설이 아닌 OSM 명소로만 구성된다(진흥공단 갱신 시 id 가 깨지지 않도록)", () => {
    for (const r of data.routes) for (const id of r.placeIds) expect(id).toMatch(/^osm-/);
  });

  it("실제 도보 경로: 구간 수 = 방문지 수-1, 경로 양 끝이 첫/마지막 방문지와 일치, 길이 ≥ 직선거리", () => {
    expect(data.routePaths).not.toBeNull();
    const byId = new Map(data.places.map((p) => [p.id, p]));
    for (const r of data.routes) {
      const rp = data.routePaths!.routes[r.routeId];
      expect(rp, r.routeId).toBeDefined();
      expect(rp.segments).toHaveLength(r.placeIds.length - 1);
      const first = byId.get(r.placeIds[0])!;
      const last = byId.get(r.placeIds.at(-1)!)!;
      expect(haversineMeters(rp.geometry[0], [first.longitude, first.latitude])).toBeLessThan(1);
      expect(haversineMeters(rp.geometry.at(-1)!, [last.longitude, last.latitude])).toBeLessThan(1);
      const straight = r.placeIds.slice(1).reduce((s, id, i) => {
        const a = byId.get(r.placeIds[i])!;
        const b = byId.get(id)!;
        return s + haversineMeters([a.longitude, a.latitude], [b.longitude, b.latitude]);
      }, 0);
      expect(rp.totalDistanceM).toBeGreaterThanOrEqual(Math.floor(straight));
      expect(rp.totalDistanceM).toBe(rp.segments.reduce((s, x) => s + x.distanceM, 0));
    }
  });
});

describe("강의용 샘플 (data/samples/)", () => {
  it("가상 샘플 30곳·코스 3종이 여전히 검증을 통과한다(3~7차시 실습용)", () => {
    const d = parseAtlasData(read("samples/places.sample.csv"), read("samples/routes.sample.json"), cats);
    expect(d.places).toHaveLength(30);
    expect(d.places.every((p) => p.isSample)).toBe(true);
    expect(d.routes).toHaveLength(3);
  });
});

// ── 검증 규칙: 고정 fixture 로 실데이터와 독립적으로 확인 ────────────────────
const H =
  "id,nameKo,nameEn,latitude,longitude,category,theme,descriptionKo,descriptionEn,address,imageUrl,source,license,openingHours,tags,externalUrl,recommendedDurationMinutes,updatedAt,isSample";
const row = (o: Partial<Record<string, string>> = {}) => {
  const base: Record<string, string> = {
    id: "p-a", nameKo: "장소가", nameEn: "Place A", latitude: "35.815", longitude: "127.15", category: "cafe", theme: "cafe-alley",
    descriptionKo: "설명", descriptionEn: "desc", address: "주소", imageUrl: "", source: "직접 답사", license: "직접 작성",
    openingHours: "", tags: "커피|조용한", externalUrl: "", recommendedDurationMinutes: "", updatedAt: "2026-10-30", isSample: "false",
  };
  return H.split(",").map((k) => (o[k] ?? base[k]) as string).join(",");
};
const row2 = row({ id: "p-b", nameKo: "장소나" });
const fxRoutes = JSON.stringify([
  { routeId: "r1", titleKo: "코스", titleEn: "", descriptionKo: "설명", descriptionEn: "", theme: "history", placeIds: ["p-a", "p-b"], transportMode: "walking" },
]);
const fxCsv = (...rows: string[]) => [H, ...rows].join("\n");

function issuesOf(c: string, r = fxRoutes, k = cats, p: string | null = null): string[] {
  try {
    parseAtlasData(c, r, k, p);
  } catch (e) {
    if (e instanceof DataValidationError) return e.issues;
    throw e;
  }
  return [];
}

describe("검증 규칙(잘못된 데이터를 잡아내는가)", () => {
  it("정상 fixture 는 통과하고 태그는 | 로 분리된다", () => {
    expect(issuesOf(fxCsv(row(), row2))).toEqual([]);
    expect(parseAtlasData(fxCsv(row(), row2), fxRoutes, cats).places[0].tags).toEqual(["커피", "조용한"]);
  });
  it("id 중복", () => expect(issuesOf(fxCsv(row(), row())).join("\n")).toMatch(/중복/));
  it("위도 범위 초과", () => expect(issuesOf(fxCsv(row({ latitude: "135.8" }), row2)).join("\n")).toMatch(/latitude/));
  it("존재하지 않는 category", () => expect(issuesOf(fxCsv(row({ category: "pizza" }), row2)).join("\n")).toMatch(/category: pizza/));
  it("필수 값 누락(nameKo)", () => expect(issuesOf(fxCsv(row({ nameKo: "" }), row2)).join("\n")).toMatch(/nameKo/));
  it("javascript: 같은 위험한 URL 거부", () =>
    expect(issuesOf(fxCsv(row({ externalUrl: "javascript:alert(1)" }), row2)).join("\n")).toMatch(/externalUrl/));
  it("깨진 문자(U+FFFD)", () => expect(issuesOf(fxCsv(row({ nameKo: "장�소" }), row2)).join("\n")).toMatch(/깨진 문자/));
  it("필수 열 누락", () => expect(issuesOf(fxCsv(row(), row2).replace("license", "lic")).join("\n")).toMatch(/필수 열/));
  it("코스가 없는 장소 id 참조", () => expect(issuesOf(fxCsv(row(), row2), fxRoutes.replace('"p-b"', '"nope"')).join("\n")).toMatch(/nope/));
  it("코스 내 같은 장소 중복", () => expect(issuesOf(fxCsv(row(), row2), fxRoutes.replace('"p-b"', '"p-a"')).join("\n")).toMatch(/중복/));
  it("JSON 문법 오류", () => expect(issuesOf(fxCsv(row(), row2), "[{").join("\n")).toMatch(/JSON/));
  it("엑셀 BOM 이 붙어도 읽힌다", () => expect(issuesOf("﻿" + fxCsv(row(), row2))).toEqual([]));
  it("route-paths 의 구간 수가 코스와 다르면 오류", () => {
    const bad = JSON.stringify({
      generatedAt: "2026-10-30", source: "x", license: "ODbL", walkingSpeedKmh: 4.5,
      routes: { r1: { totalDistanceM: 10, totalDurationS: 8, segments: [], geometry: [[127.15, 35.815], [127.16, 35.816]] } },
    });
    expect(issuesOf(fxCsv(row(), row2), fxRoutes, cats, bad).join("\n")).toMatch(/구간 수/);
  });
  it("route-paths 에 없는 코스가 있으면 오류", () => {
    const bad = JSON.stringify({
      generatedAt: "2026-10-30", source: "x", license: "ODbL", walkingSpeedKmh: 4.5,
      routes: { zz: { totalDistanceM: 10, totalDurationS: 8, segments: [{ distanceM: 10, durationS: 8 }], geometry: [[127.15, 35.815], [127.16, 35.816]] } },
    });
    expect(issuesOf(fxCsv(row(), row2), fxRoutes, cats, bad).join("\n")).toMatch(/zz/);
  });
  it("선택 출처 열: wikidata 형식·URL 검증", () => {
    const H2 = H + ",sourceUrl,wikidata";
    const ok = [H2, row() + ",https://www.openstreetmap.org/node/1,Q42", row2 + ",,"].join("\n");
    expect(issuesOf(ok)).toEqual([]);
    const bad = [H2, row() + ",ftp://x,42", row2 + ",,"].join("\n");
    expect(issuesOf(bad).join("\n")).toMatch(/sourceUrl[\s\S]*wikidata|wikidata[\s\S]*sourceUrl/);
  });
});
