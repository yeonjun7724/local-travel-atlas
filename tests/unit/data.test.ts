import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DataValidationError, parseAtlasData } from "@/lib/data/parse";

const dir = path.join(process.cwd(), "data");
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
const csv = read("places.csv");
const routes = read("routes.json");
const cats = read("categories.json");

function issuesOf(c: string, r = routes, k = cats): string[] {
  try {
    parseAtlasData(c, r, k);
  } catch (e) {
    if (e instanceof DataValidationError) return e.issues;
    throw e;
  }
  return [];
}

describe("실제 데이터", () => {
  const data = parseAtlasData(csv, routes, cats);
  it("장소 30곳 이상, 코스 3종", () => {
    expect(data.places.length).toBeGreaterThanOrEqual(30);
    expect(data.routes).toHaveLength(3);
  });
  it("모든 코스는 5~8곳이며 참조가 유효하다", () => {
    const ids = new Set(data.places.map((p) => p.id));
    for (const r of data.routes) {
      expect(r.placeIds.length).toBeGreaterThanOrEqual(5);
      expect(r.placeIds.length).toBeLessThanOrEqual(8);
      r.placeIds.forEach((id) => expect(ids.has(id)).toBe(true));
    }
  });
  it("좌표가 모두 지도 중심 5km 안에 있다(좌표 오입력 탐지)", () => {
    for (const p of data.places) {
      expect(Math.abs(p.latitude - 35.815)).toBeLessThan(0.05);
      expect(Math.abs(p.longitude - 127.153)).toBeLessThan(0.05);
    }
  });
  it("태그는 | 로 분리되어 배열이 된다", () => {
    expect(data.places[0].tags).toEqual(["커피", "로스터리", "조용한"]);
  });
  it("CSV 의 한글이 깨지지 않았다", () => {
    expect(data.places.some((p) => p.nameKo === "담쟁이 로스터리")).toBe(true);
  });
});

describe("검증 규칙(잘못된 데이터를 잡아내는가)", () => {
  const lines = csv.trimEnd().split(/\r?\n/);
  const header = lines[0];
  const first = lines[1];

  it("id 중복", () => {
    expect(issuesOf(csv + "\n" + first).join("\n")).toMatch(/중복/);
  });
  it("위도 범위 초과", () => {
    const bad = first.replace("35.8192", "135.8192");
    expect(issuesOf([header, bad, ...lines.slice(2)].join("\n")).join("\n")).toMatch(/latitude/);
  });
  it("존재하지 않는 category", () => {
    const bad = first.replace(",cafe,", ",pizza,");
    expect(issuesOf([header, bad, ...lines.slice(2)].join("\n")).join("\n")).toMatch(/category: pizza/);
  });
  it("필수 값 누락(nameKo)", () => {
    const bad = first.replace("담쟁이 로스터리", "");
    expect(issuesOf([header, bad, ...lines.slice(2)].join("\n")).join("\n")).toMatch(/nameKo/);
  });
  it("javascript: 같은 위험한 URL 거부", () => {
    const bad = first.replace(/,45,2026-10-08,true$/, ",45,2026-10-08,true").replace(",,45,", ",javascript:alert(1),45,");
    expect(issuesOf([header, bad, ...lines.slice(2)].join("\n")).join("\n")).toMatch(/externalUrl/);
  });
  it("깨진 문자(U+FFFD)", () => {
    const bad = first.replace("담쟁이", "담�이");
    expect(issuesOf([header, bad, ...lines.slice(2)].join("\n")).join("\n")).toMatch(/깨진 문자/);
  });
  it("필수 열 누락", () => {
    expect(issuesOf(csv.replace("license", "lic")).join("\n")).toMatch(/필수 열/);
  });
  it("코스가 없는 장소 id 참조", () => {
    const bad = routes.replace("cafe-ivy", "no-such-place");
    expect(issuesOf(csv, bad).join("\n")).toMatch(/no-such-place/);
  });
  it("코스 내 같은 장소 중복", () => {
    const bad = routes.replace('"cafe-lantern"', '"cafe-ivy"');
    expect(issuesOf(csv, bad).join("\n")).toMatch(/중복/);
  });
  it("JSON 문법 오류", () => {
    expect(issuesOf(csv, "[{").join("\n")).toMatch(/JSON/);
  });
  it("엑셀 BOM 이 붙어도 읽힌다", () => {
    expect(issuesOf("﻿" + csv)).toEqual([]);
  });
});
