/** 공유 URL 생성·검증 (순수 함수 — 브라우저/서버 어디서나 테스트 가능) */

export interface ShareState {
  placeId?: string;
  routeId?: string;
}

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;

export function buildShareUrl(base: string, state: ShareState): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  if (state.routeId) url.searchParams.set("route", state.routeId);
  if (state.placeId) url.searchParams.set("place", state.placeId);
  return url.toString();
}

/** 쿼리 파라미터를 읽되, 형식이 틀리거나 존재하지 않는 id 는 무시합니다. */
export function parseShareParams(search: string, validPlaceIds: Set<string>, validRouteIds: Set<string>): ShareState {
  const params = new URLSearchParams(search);
  const place = params.get("place");
  const route = params.get("route");
  return {
    placeId: place && ID_PATTERN.test(place) && validPlaceIds.has(place) ? place : undefined,
    routeId: route && ID_PATTERN.test(route) && validRouteIds.has(route) ? route : undefined,
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
