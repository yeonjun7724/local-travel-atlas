/** 공유 URL 생성·검증 (순수 함수 — 브라우저/서버 어디서나 테스트 가능) */

export interface ShareState {
  placeId?: string;
  routeId?: string;
  /** 내 코스 방문지 id(순서대로) — routeId 가 "my-route" 일 때 */
  stops?: string[];
}

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const MAX_STOPS = 25;

export function buildShareUrl(base: string, state: ShareState): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  if (state.routeId) url.searchParams.set("route", state.routeId);
  if (state.stops?.length) url.searchParams.set("stops", state.stops.slice(0, MAX_STOPS).join(","));
  if (state.placeId) url.searchParams.set("place", state.placeId);
  return url.toString();
}

/**
 * 쿼리 파라미터를 읽되, 형식이 틀리거나 존재하지 않는 id 는 무시합니다.
 * validPlaceIds 가 null 이면(전국 모드: 브라우저가 모든 장소를 갖고 있지 않음) 형식만 검사하고 존재 여부는 서버 조회로 확인합니다.
 */
export function parseShareParams(search: string, validPlaceIds: Set<string> | null, validRouteIds: Set<string>): ShareState {
  const params = new URLSearchParams(search);
  const place = params.get("place");
  const route = params.get("route");
  const okPlace = (id: string) => ID_PATTERN.test(id) && (!validPlaceIds || validPlaceIds.has(id));
  const stops = [...new Set((params.get("stops") ?? "").split(",").filter(okPlace))].slice(0, MAX_STOPS);
  return {
    placeId: place && okPlace(place) ? place : undefined,
    routeId: route && ID_PATTERN.test(route) && (validRouteIds.has(route) || (route === "my-route" && stops.length > 0)) ? route : undefined,
    stops: stops.length ? stops : undefined,
  };
}

export function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    hostname.endsWith(".local")
  );
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
