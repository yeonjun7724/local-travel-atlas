/**
 * 서비스 설정 파일 — 브랜드명·지역명·지도 기본값은 여기서만 바꾸면 됩니다.
 * (수강생 안내: 4~5차시에서 이 파일을 내 동네 정보로 교체합니다.)
 */
export const siteConfig = {
  brand: {
    name: "LOCAL ATLAS",
    taglineKo: "우리 동네 여행 지도",
    taglineEn: "My Neighborhood Travel Map",
  },
  region: {
    nameKo: "전주 한옥마을 일대",
    nameEn: "Jeonju Hanok Village",
    // [경도, 위도] — MapLibre 순서
    center: [127.1515, 35.8152] as [number, number],
    zoom: 15.6,
  },
  /** 전국 모드(DATABASE_URL 설정 시)의 첫 화면 — 대한민국 전체 */
  nationwide: {
    center: [127.8, 36.3] as [number, number],
    zoom: 6.4,
  },
  map: {
    styleUrl:
      process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty",
    // 스타일 제공자의 출처 표시는 지도 스타일이 자동 포함합니다. 아래는 보조 표기입니다.
    attributionNote: "© OpenFreeMap © OpenMapTiles Data from OpenStreetMap",
  },
  features: {
    analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
  },
  defaultLanguage: "ko" as const,
  languages: ["ko", "en"] as const,
  /** 샘플(가상) 데이터를 실제 데이터로 교체했다면 CSV의 isSample 열을 false 로 바꾸세요. */
};

export type Language = (typeof siteConfig.languages)[number];
