import { describe, expect, it } from "vitest";
import { bboxCenter, bboxChanged, formatDistance, haversineMeters, inBBox, type BBox } from "@/lib/geo";
import { filterPlaces, sortPlaces, subtypeCounts } from "@/lib/data/filter";
import type { Place } from "@/lib/validation/schemas";

const mk = (o: Partial<Place>): Place =>
  ({
    id: "a", nameKo: "가", nameEn: "", latitude: 35.815, longitude: 127.15, category: "food", theme: "local-food",
    descriptionKo: "d", descriptionEn: "", address: "주소", imageUrl: "", source: "s", license: "l", tags: [], isSample: false,
    ...o,
  }) as Place;

describe("geo", () => {
  it("하버사인 거리(위도 0.001도 ≈ 111m)", () => expect(haversineMeters([127.15, 35.815], [127.15, 35.816])).toBeCloseTo(111.2, 0));
  it("영역 포함 판정", () => {
    const b: BBox = [127.14, 35.81, 127.16, 35.82];
    expect(inBBox([127.15, 35.815], b)).toBe(true);
    expect(inBBox([127.17, 35.815], b)).toBe(false);
    expect(bboxCenter(b)).toEqual([127.15, 35.815]);
  });
  it("영역 변화 감지(이동·확대)", () => {
    const a: BBox = [127.14, 35.81, 127.16, 35.82];
    expect(bboxChanged(a, a)).toBe(false);
    expect(bboxChanged(a, [127.141, 35.81, 127.161, 35.82])).toBe(false); // 5% 이동
    expect(bboxChanged(a, [127.15, 35.81, 127.17, 35.82])).toBe(true); // 반 화면 이동
    expect(bboxChanged(a, [127.145, 35.8125, 127.155, 35.8175])).toBe(true); // 2배 확대
  });
  it("거리 표기", () => {
    expect(formatDistance(64, { km: "km", m: "m" })).toBe("60m");
    expect(formatDistance(1234, { km: "km", m: "m" })).toBe("1.2km");
  });
});

describe("정렬·세부 종류·찜 필터", () => {
  const list = [
    mk({ id: "far", nameKo: "다", longitude: 127.16, subtype: "카페", category: "cafe" }),
    mk({ id: "near", nameKo: "나", longitude: 127.1501, subtype: "백반/한정식" }),
    mk({ id: "mid", nameKo: "가", longitude: 127.155, subtype: "백반/한정식" }),
  ];
  it("가까운순", () => expect(sortPlaces(list, "distance", [127.15, 35.815], "ko").map((p) => p.id)).toEqual(["near", "mid", "far"]));
  it("이름순", () => expect(sortPlaces(list, "name", null, "ko").map((p) => p.nameKo)).toEqual(["가", "나", "다"]));
  it("추천순은 데이터 순서 유지", () => expect(sortPlaces(list, "recommended", null, "ko")).toBe(list));
  it("기준점 없으면 가까운순은 원래 순서", () => expect(sortPlaces(list, "distance", null, "ko")).toBe(list));
  it("세부 종류 개수(많은 순)", () => expect(subtypeCounts(list)).toEqual([{ subtype: "백반/한정식", count: 2 }, { subtype: "카페", count: 1 }]));
  it("세부 종류 필터·검색", () => {
    expect(filterPlaces(list, { category: null, query: "", subtype: "카페" }).map((p) => p.id)).toEqual(["far"]);
    expect(filterPlaces(list, { category: null, query: "한정식" })).toHaveLength(2);
  });
  it("찜 필터", () => expect(filterPlaces(list, { category: null, query: "", favoriteIds: new Set(["mid"]) }).map((p) => p.id)).toEqual(["mid"]));
});
