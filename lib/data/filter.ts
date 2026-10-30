import type { Place } from "@/lib/validation/schemas";
import { haversineMeters, type LngLat } from "@/lib/geo";

export interface PlaceFilter {
  category: string | null; // null = 전체
  query: string;
  /** 세부 업종(예: "백반/한정식"). null = 전체 */
  subtype?: string | null;
  /** 찜한 곳만 */
  favoriteIds?: Set<string> | null;
}

/** 장소명(한/영)·태그·주소·세부 업종으로 검색하고 카테고리·세부 업종·찜으로 거르는 순수 함수 */
export function filterPlaces(places: Place[], { category, query, subtype = null, favoriteIds = null }: PlaceFilter): Place[] {
  const q = query.trim().toLowerCase();
  return places.filter((p) => {
    if (category && p.category !== category) return false;
    if (subtype && p.subtype !== subtype) return false;
    if (favoriteIds && !favoriteIds.has(p.id)) return false;
    if (!q) return true;
    const haystack = [p.nameKo, p.nameEn, p.address, p.subtype ?? "", ...p.tags].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

/** 세부 업종별 개수(많은 순). 칩 표시용 */
export function subtypeCounts(places: Place[], limit = 10): { subtype: string; count: number }[] {
  const m = new Map<string, number>();
  for (const p of places) if (p.subtype) m.set(p.subtype, (m.get(p.subtype) ?? 0) + 1);
  return [...m.entries()]
    .map(([subtype, count]) => ({ subtype, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type SortKey = "distance" | "name" | "recommended";

/** 정렬: 가까운순(기준점 필요) / 이름순 / 분류순(데이터 순서: 역사·명소·자연 → 카페 → 음식, 각 분류 안은 이름순) */
export function sortPlaces(places: Place[], key: SortKey, origin: LngLat | null, lang: "ko" | "en"): Place[] {
  if (key === "name") {
    const name = (p: Place) => (lang === "en" && p.nameEn ? p.nameEn : p.nameKo);
    return [...places].sort((a, b) => name(a).localeCompare(name(b), lang));
  }
  if (key === "distance" && origin) {
    const d = new Map(places.map((p) => [p.id, haversineMeters(origin, [p.longitude, p.latitude])]));
    return [...places].sort((a, b) => d.get(a.id)! - d.get(b.id)!);
  }
  return places;
}
