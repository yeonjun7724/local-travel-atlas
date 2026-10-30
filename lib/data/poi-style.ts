import type { Category, Place } from "@/lib/validation/schemas";

/**
 * 지도 핀의 색·아이콘을 세부 업종(진흥공단 소분류 등) 그룹별로 다르게 합니다.
 * 음식점이 전체의 대부분이라 카테고리 색 하나로는 지도가 단조로워지기 때문입니다.
 * 그룹에 없는 업종·카테고리(자연·역사·명소)는 categories.json 의 색·아이콘을 그대로 씁니다.
 * 색은 모두 흰 아이콘과 대비 3:1 이상(비텍스트 그래픽 기준, 단위 테스트로 확인).
 */
export interface PoiGroup {
  id: string;
  labelKo: string;
  labelEn: string;
  color: string;
  icon: string;
  subtypes: string[];
}

export const POI_GROUPS: PoiGroup[] = [
  { id: "korean", labelKo: "한식", labelEn: "Korean", color: "#c2410c", icon: "soup", subtypes: ["백반/한정식", "국/탕/찌개류", "기타 한식 음식점", "전/부침개", "떡/한과", "구내식당", "뷔페"] },
  { id: "noodle", labelKo: "면 요리", labelEn: "Noodles", color: "#a16207", icon: "cooking-pot", subtypes: ["국수/칼국수", "냉면/밀면"] },
  { id: "meat", labelKo: "고기·구이", labelEn: "BBQ & Meat", color: "#7f1d1d", icon: "beef", subtypes: ["돼지고기 구이/찜", "소고기 구이/찜", "닭/오리고기 구이/찜", "곱창 전골/구이", "족발/보쌈"] },
  { id: "snack", labelKo: "분식·간편식", labelEn: "Snacks", color: "#db2777", icon: "sandwich", subtypes: ["김밥/만두/분식", "토스트/샌드위치/샐러드", "그 외 기타 간이 음식점"] },
  { id: "chicken", labelKo: "치킨·버거", labelEn: "Chicken & Burgers", color: "#d97706", icon: "drumstick", subtypes: ["치킨", "버거"] },
  { id: "western", labelKo: "양식·피자", labelEn: "Western & Pizza", color: "#a21caf", icon: "pizza", subtypes: ["피자", "경양식", "파스타/스테이크", "기타 서양식 음식점", "패밀리레스토랑"] },
  { id: "chinese", labelKo: "중식", labelEn: "Chinese", color: "#dc2626", icon: "utensils-crossed", subtypes: ["중국집", "마라탕/훠궈"] },
  { id: "japanese", labelKo: "일식", labelEn: "Japanese", color: "#4338ca", icon: "utensils-crossed", subtypes: ["일식 회/초밥", "일식 카레/돈가스/덮밥", "일식 면 요리", "기타 일식 음식점"] },
  { id: "seafood", labelKo: "해산물·회", labelEn: "Seafood", color: "#0284c7", icon: "fish", subtypes: ["횟집", "해산물 구이/찜", "복 요리 전문"] },
  { id: "asian", labelKo: "아시안·세계", labelEn: "Asian & World", color: "#0f766e", icon: "salad", subtypes: ["베트남식 전문", "기타 동남아식 전문", "분류 안된 외국식 음식점"] },
  { id: "pub", labelKo: "주점", labelEn: "Pubs", color: "#334155", icon: "beer", subtypes: ["요리 주점", "생맥주 전문"] },
  { id: "coffee", labelKo: "카페", labelEn: "Café", color: "#78350f", icon: "coffee", subtypes: ["카페"] },
  { id: "bakery", labelKo: "빵·도넛", labelEn: "Bakery", color: "#b45309", icon: "croissant", subtypes: ["빵/도넛"] },
  { id: "dessert", labelKo: "아이스크림·빙수", labelEn: "Ice cream", color: "#0891b2", icon: "ice-cream", subtypes: ["아이스크림/빙수"] },
];

const BY_SUBTYPE = new Map(POI_GROUPS.flatMap((g) => g.subtypes.map((s) => [s, g] as const)));

/** 장소의 핀 색·아이콘. 음식점·카페만 세부 업종 그룹을 적용합니다(자연·역사·명소는 카테고리 그대로). */
export function poiStyle(place: Pick<Place, "category" | "subtype">, category?: Category): { color: string; icon?: string } {
  const g = (place.category === "food" || place.category === "cafe") && place.subtype ? BY_SUBTYPE.get(place.subtype) : undefined;
  return g ? { color: g.color, icon: g.icon } : { color: category?.color ?? "#444", icon: category?.icon };
}
