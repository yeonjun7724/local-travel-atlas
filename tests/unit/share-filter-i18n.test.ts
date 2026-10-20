import { describe, expect, it } from "vitest";
import { buildShareUrl, isLocalHost, parseShareParams } from "@/lib/share";
import { filterPlaces } from "@/lib/data/filter";
import { ko } from "@/lib/i18n/ko";
import { en } from "@/lib/i18n/en";
import { localizePlace, translate } from "@/lib/i18n";
import { boundsOf } from "@/lib/data/geojson";
import type { Place } from "@/lib/validation/schemas";

const places = new Set(["cafe-ivy", "food-hansang"]);
const routes = new Set(["cafe-alley-walk"]);

describe("공유 URL", () => {
  it("만들고 다시 읽으면 같은 값", () => {
    const url = buildShareUrl("https://example.com/?x=1#h", { routeId: "cafe-alley-walk", placeId: "cafe-ivy" });
    expect(url).toBe("https://example.com/?route=cafe-alley-walk&place=cafe-ivy");
    expect(parseShareParams(new URL(url).search, places, routes)).toEqual({ routeId: "cafe-alley-walk", placeId: "cafe-ivy" });
  });
  it("존재하지 않거나 형식이 틀린 값은 무시", () => {
    expect(parseShareParams("?place=nope&route=<script>", places, routes)).toEqual({ placeId: undefined, routeId: undefined });
    expect(parseShareParams("?place=../../etc", places, routes).placeId).toBeUndefined();
  });
  it("로컬 주소 판별", () => {
    expect(isLocalHost("localhost")).toBe(true);
    expect(isLocalHost("192.168.0.5")).toBe(true);
    expect(isLocalHost("my-map.vercel.app")).toBe(false);
  });
});

const mk = (o: Partial<Place>): Place => ({
  id: "a", nameKo: "카페 가", nameEn: "Cafe A", latitude: 0, longitude: 0, category: "cafe", theme: "t",
  descriptionKo: "설명", descriptionEn: "", address: "주소", imageUrl: "", source: "s", license: "l",
  tags: ["커피"], isSample: false, openingHours: undefined, externalUrl: undefined,
  recommendedDurationMinutes: undefined, updatedAt: undefined, ...o,
});

describe("필터/검색", () => {
  const list = [mk({}), mk({ id: "b", nameKo: "식당", nameEn: "Diner", category: "food", tags: ["국수"] })];
  it("카테고리", () => expect(filterPlaces(list, { category: "food", query: "" }).map((p) => p.id)).toEqual(["b"]));
  it("이름·영문·태그 검색(대소문자 무시)", () => {
    expect(filterPlaces(list, { category: null, query: "diner" })).toHaveLength(1);
    expect(filterPlaces(list, { category: null, query: "국수" })).toHaveLength(1);
    expect(filterPlaces(list, { category: null, query: "  카페 " })).toHaveLength(1);
  });
  it("결과 없음", () => expect(filterPlaces(list, { category: "nature", query: "" })).toEqual([]));
});

describe("다국어", () => {
  it("한국어·영어 사전의 키가 일치", () => expect(Object.keys(en).sort()).toEqual(Object.keys(ko).sort()));
  it("영어 번역이 비면 한국어로 대체하고 표시", () => {
    const r = localizePlace(mk({ nameEn: "" }), "en");
    expect(r.name).toBe("카페 가");
    expect(r.fellBack).toBe(true);
    expect(localizePlace(mk({ descriptionEn: "Nice" }), "en").description).toBe("Nice");
  });
  it("변수 치환", () => expect(translate("en", "results.count", { n: 3 })).toBe("3 places"));
});

describe("bounds", () => {
  it("범위 계산", () => expect(boundsOf([[1, 2], [3, 0]])).toEqual([[1, 0], [3, 2]]));
  it("빈 배열", () => expect(boundsOf([])).toBeNull());
});
