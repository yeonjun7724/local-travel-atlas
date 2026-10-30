import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { expect, type Page } from "@playwright/test";

/** 기대값은 하드코딩하지 않고 실제 data/places.csv 에서 계산합니다(데이터를 갱신해도 테스트가 유효). */
type Row = Record<string, string>;
const rows: Row[] = Papa.parse<Row>(fs.readFileSync(path.join(process.cwd(), "data", "places.csv"), "utf8").replace(/^﻿/, ""), {
  header: true,
  skipEmptyLines: true,
}).data;
export const routes: { routeId: string; titleKo: string; placeIds: string[] }[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "routes.json"), "utf8"),
);
export const routePaths = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "route-paths.json"), "utf8"));

export const data = {
  total: rows.length,
  count: (category: string) => rows.filter((r) => r.category === category).length,
  subtypeCount: (category: string, subtype: string) => rows.filter((r) => r.category === category && r.subtype === subtype).length,
  byId: (id: string) => rows.find((r) => r.id === id)!,
  /** 같은 좌표에 가장 많이 겹친 장소 묶음 (같은 건물의 여러 점포) */
  largestStack: () => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const k = `${r.latitude},${r.longitude}`;
      m.set(k, [...(m.get(k) ?? []), r.id]);
    }
    return [...m.values()].sort((a, b) => b.length - a.length)[0];
  },
  match: (q: string) => rows.filter((r) => [r.nameKo, r.nameEn, r.address, r.subtype, r.tags.replaceAll("|", " ")].join(" ").toLowerCase().includes(q.toLowerCase())),
};

/** 고정 OSM 장소 (진흥공단 갱신과 무관하게 안정적인 id) */
export const GYEONGGIJEON = "osm-w36524723"; // 경기전 — Commons 사진·위키백과 설명 있음
export const PUNGNAMMUN = "osm-w157646770"; // 풍남문

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 768;

export async function openApp(page: Page, search = "") {
  await page.goto("/" + search);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByTestId("map-loading")).toHaveCount(0);
  // 클러스터 또는 핀 중 하나는 반드시 그려져야 합니다.
  await expect(page.locator('[data-testid="cluster"], [data-testid^="marker-"]').first()).toBeVisible();
}

export async function ensureListVisible(page: Page) {
  if (isMobile(page) && (await page.getByTestId("bottom-sheet").getAttribute("data-state")) === "collapsed") {
    await page.getByTestId("list-toggle").click();
  }
}

export function countOf(text: string | null): number {
  return Number((text ?? "").match(/\d+/)?.[0] ?? NaN);
}

export function shot(page: Page, name: string) {
  fs.mkdirSync("docs/screenshots", { recursive: true });
  return page.screenshot({ path: `docs/screenshots/${name}.png` });
}
