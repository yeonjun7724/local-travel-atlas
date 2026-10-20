import { z } from "zod";

export type TransportMode = "walking" | "driving";

const PROFILE: Record<TransportMode, string> = {
  walking: "foot-walking",
  driving: "driving-car",
};

export interface RouteResult {
  mode: TransportMode;
  totalDistanceM: number;
  totalDurationS: number;
  segments: { distanceM: number; durationS: number }[];
  /** 전체 경로 형상 [lng, lat][] */
  geometry: [number, number][];
}

export class RoutingError extends Error {
  constructor(
    public readonly code: "rate_limited" | "upstream_error" | "timeout" | "bad_response",
    message: string,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}

const orsResponse = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({ coordinates: z.array(z.array(z.number()).min(2)) }),
        properties: z.object({
          segments: z.array(z.object({ distance: z.number(), duration: z.number() })),
          summary: z.object({ distance: z.number(), duration: z.number() }),
        }),
      }),
    )
    .min(1),
});

/**
 * OpenRouteService Directions(GeoJSON) 호출. API 키는 서버에서만 사용합니다.
 * fetchImpl 을 주입할 수 있어 테스트에서 네트워크 없이 검증할 수 있습니다.
 */
export async function fetchOrsRoute(
  coords: [number, number][],
  mode: TransportMode,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<RouteResult> {
  let res: Response;
  try {
    res = await fetchImpl(`https://api.openrouteservice.org/v2/directions/${PROFILE[mode]}/geojson`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/geo+json" },
      body: JSON.stringify({ coordinates: coords }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new RoutingError("timeout", "경로 API 응답 시간 초과");
    throw new RoutingError("upstream_error", "경로 API 연결 실패");
  }
  if (res.status === 429) throw new RoutingError("rate_limited", "경로 API 호출 한도 초과");
  if (!res.ok) throw new RoutingError("upstream_error", `경로 API 오류 (HTTP ${res.status})`);

  const parsed = orsResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new RoutingError("bad_response", "경로 API 응답 형식이 올바르지 않습니다");
  const f = parsed.data.features[0];
  return {
    mode,
    totalDistanceM: f.properties.summary.distance,
    totalDurationS: f.properties.summary.duration,
    segments: f.properties.segments.map((s) => ({ distanceM: s.distance, durationS: s.duration })),
    geometry: f.geometry.coordinates.map((c) => [c[0], c[1]] as [number, number]),
  };
}

export function formatDuration(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(1, Math.round(seconds / 60));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
