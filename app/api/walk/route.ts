import { NextResponse } from "next/server";
import { z } from "zod";
import { loadAtlasData } from "@/lib/data/load";
import { fetchOsrmWalk, WalkError, type LngLat, type WalkResult } from "@/lib/routing/osrm";
import { placesByIds, remoteEnabled } from "@/lib/server/places-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 내 코스: 장소 id 2~25개(방문 순서) */
const bodySchema = z.object({
  placeIds: z.array(z.string().regex(/^[a-z0-9-]{1,64}$/)).min(2).max(25),
});

const cache = new Map<string, { at: number; value: WalkResult }>();
const TTL = 60 * 60_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
let windowStart = 0;
let windowCount = 0;

/** GET: 경로 엔진 사용 가능 여부 (화면이 안내 문구를 고르는 데 사용) */
export function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.OSRM_URL) });
}

export async function POST(req: Request) {
  const base = process.env.OSRM_URL;
  if (!base) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { placeIds } = parsed.data;

  // 좌표는 클라이언트가 아니라 서버가 데이터에서 조회합니다.
  let places;
  try {
    places = remoteEnabled() ? await placesByIds(placeIds) : loadAtlasData().places.filter((p) => placeIds.includes(p.id));
  } catch {
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
  const byId = new Map(places.map((p) => [p.id, p]));
  if (placeIds.some((id) => !byId.has(id))) return NextResponse.json({ error: "place_not_found" }, { status: 404 });
  const stops = placeIds.map((id) => [byId.get(id)!.longitude, byId.get(id)!.latitude] as LngLat);

  const key = placeIds.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.value);

  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > MAX_PER_WINDOW) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    const value = await fetchOsrmWalk(base, stops);
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return NextResponse.json(value);
  } catch (e) {
    const code = e instanceof WalkError ? e.code : "upstream";
    return NextResponse.json({ error: code }, { status: code === "no_route" ? 422 : code === "timeout" ? 504 : 502 });
  }
}
