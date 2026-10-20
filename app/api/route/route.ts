import { NextResponse } from "next/server";
import { z } from "zod";
import { loadAtlasData } from "@/lib/data/load";
import { fetchOrsRoute, RoutingError, type RouteResult } from "@/lib/routing/ors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  routeId: z.string().regex(/^[a-z0-9-]{1,64}$/),
  mode: z.enum(["walking", "driving"]),
});

// 간단한 서버 메모리 캐시(인스턴스 단위) + 분당 호출 제한. 무료 API 한도를 보호하기 위한 장치입니다.
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: RouteResult }>();
const WINDOW_MS = 60_000;
const MAX_UPSTREAM_PER_WINDOW = 20;
let windowStart = 0;
let windowCount = 0;

function allowUpstreamCall(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= MAX_UPSTREAM_PER_WINDOW;
}

export async function POST(req: Request) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { routeId, mode } = parsed.data;

  // 클라이언트가 임의 좌표를 보내지 못하도록, 좌표는 서버가 데이터에서 직접 조회합니다.
  const data = loadAtlasData();
  const route = data.routes.find((r) => r.routeId === routeId);
  if (!route) return NextResponse.json({ error: "route_not_found" }, { status: 404 });
  const byId = new Map(data.places.map((p) => [p.id, p]));
  const coords = route.placeIds.map((id) => {
    const p = byId.get(id)!;
    return [p.longitude, p.latitude] as [number, number];
  });

  const key = `${routeId}|${mode}|${coords.map((c) => c.join(",")).join(";")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return NextResponse.json({ ...hit.value, cached: true });

  if (!allowUpstreamCall()) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    const value = await fetchOrsRoute(coords, mode, apiKey);
    cache.set(key, { at: Date.now(), value });
    return NextResponse.json({ ...value, cached: false });
  } catch (e) {
    if (e instanceof RoutingError) {
      const status = e.code === "rate_limited" ? 429 : e.code === "timeout" ? 504 : 502;
      return NextResponse.json({ error: e.code }, { status });
    }
    return NextResponse.json({ error: "upstream_error" }, { status: 502 });
  }
}
