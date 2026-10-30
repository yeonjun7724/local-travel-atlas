/** OSRM(자체 호스팅 · foot 프로필) 응답 → 구간별 도보 경로. 순수 함수는 단위 테스트합니다. */

export type LngLat = [number, number];

export interface WalkSegment {
  distanceM: number;
  durationS: number;
  geometry: LngLat[];
}

export interface WalkResult {
  totalDistanceM: number;
  totalDurationS: number;
  segments: WalkSegment[];
  geometry: LngLat[];
  source: "osrm";
}

/** 추천 코스(OSMnx)와 같은 기준의 보행 속도 — 소요 시간은 거리 ÷ 속도로 계산한 '추정치' */
export const WALK_KMH = 4.5;
export const walkSeconds = (m: number) => Math.round(m / ((WALK_KMH * 1000) / 3600));

interface OsrmStep {
  geometry?: { coordinates?: number[][] };
}
interface OsrmLeg {
  distance: number;
  steps?: OsrmStep[];
}
interface OsrmBody {
  code?: string;
  routes?: { distance: number; legs: OsrmLeg[] }[];
}

export class WalkError extends Error {
  constructor(public code: "no_route" | "bad_response" | "timeout" | "upstream") {
    super(code);
  }
}

export function parseOsrm(body: unknown, stops: LngLat[]): WalkResult {
  const b = body as OsrmBody;
  if (b?.code === "NoRoute") throw new WalkError("no_route");
  const route = b?.routes?.[0];
  if (b?.code !== "Ok" || !route || !Array.isArray(route.legs) || route.legs.length !== stops.length - 1) throw new WalkError("bad_response");
  const segments: WalkSegment[] = route.legs.map((leg, i) => {
    const pts: LngLat[] = [stops[i]];
    for (const s of leg.steps ?? []) {
      for (const c of s.geometry?.coordinates ?? []) {
        const p: LngLat = [Math.round(c[0] * 1e6) / 1e6, Math.round(c[1] * 1e6) / 1e6];
        const last = pts[pts.length - 1];
        if (last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
      }
    }
    pts.push(stops[i + 1]); // 보행로 → 방문지 입구 연결
    const d = Math.round(leg.distance);
    return { distanceM: d, durationS: walkSeconds(d), geometry: pts };
  });
  const geometry = segments.flatMap((s, i) => (i === 0 ? s.geometry : s.geometry.slice(1)));
  const total = segments.reduce((n, s) => n + s.distanceM, 0);
  return { totalDistanceM: total, totalDurationS: segments.reduce((n, s) => n + s.durationS, 0), segments, geometry, source: "osrm" };
}

export async function fetchOsrmWalk(base: string, stops: LngLat[], timeoutMs = 8000): Promise<WalkResult> {
  const coords = stops.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`).join(";");
  const url = `${base.replace(/\/$/, "")}/route/v1/foot/${coords}?overview=false&steps=true&geometries=geojson`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new WalkError(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "upstream");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok && (body as OsrmBody | null)?.code !== "NoRoute") throw new WalkError("upstream");
  return parseOsrm(body, stops);
}
