import type { Place } from "@/lib/validation/schemas";

export interface PlaceFilter {
  category: string | null; // null = 전체
  query: string;
}

/** 장소명(한/영)·태그·주소로 검색하고 카테고리로 거르는 순수 함수 */
export function filterPlaces(places: Place[], { category, query }: PlaceFilter): Place[] {
  const q = query.trim().toLowerCase();
  return places.filter((p) => {
    if (category && p.category !== category) return false;
    if (!q) return true;
    const haystack = [p.nameKo, p.nameEn, p.address, ...p.tags].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
