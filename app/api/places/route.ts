import { NextResponse } from "next/server";
import { z } from "zod";
import { placesByIds, queryView, remoteEnabled, searchExtent } from "@/lib/server/places-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const num = z.coerce.number().finite();
const id = z.string().regex(/^[a-z0-9-]{1,64}$/);
const text = z.string().trim().max(60).optional().nullable();

const viewSchema = z.object({
  bbox: z
    .string()
    .transform((s) => s.split(",").map(Number))
    .refine((a) => a.length === 4 && a.every(Number.isFinite) && a[0] < a[2] && a[1] < a[3] && a[0] >= -180 && a[2] <= 180 && a[1] >= -90 && a[3] <= 90),
  z: num.min(0).max(22),
  cx: num.min(-180).max(180),
  cy: num.min(-90).max(90),
  cat: z.string().regex(/^[a-z0-9-]{1,32}$/).optional().nullable(),
  sub: text,
  q: text,
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

/**
 * 전국 모드 장소 조회 (PostGIS)
 *  GET /api/places?bbox=w,s,e,n&z=&cx=&cy=[&cat=&sub=&q=&limit=]   → 화면 범위의 클러스터/장소 + 가까운 순 목록
 *  GET /api/places?ids=a,b,c                                       → id 로 장소 조회(공유 링크·찜·내 코스)
 *  GET /api/places?extent=1&q=...[&cat=&sub=]                      → 검색 결과 전체 범위(지도 맞춤용)
 */
export async function GET(req: Request) {
  if (!remoteEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  try {
    if (sp.has("ids")) {
      const ids = z.array(id).max(200).safeParse((sp.get("ids") ?? "").split(",").filter(Boolean));
      if (!ids.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      return NextResponse.json({ places: await placesByIds(ids.data) });
    }
    if (sp.has("extent")) {
      const q = text.safeParse(sp.get("q"));
      const cat = z.string().regex(/^[a-z0-9-]{1,32}$/).nullable().safeParse(sp.get("cat"));
      if (!q.success || !q.data || !cat.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
      return NextResponse.json(await searchExtent({ q: q.data, category: cat.data, subtype: sp.get("sub") }));
    }
    const parsed = viewSchema.safeParse(Object.fromEntries(sp));
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const v = parsed.data;
    const result = await queryView({
      bbox: v.bbox as [number, number, number, number],
      zoom: v.z,
      center: [v.cx, v.cy],
      category: v.cat,
      subtype: v.sub,
      q: v.q,
      limit: v.limit,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    console.error("[api/places]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "db_error" }, { status: 502 });
  }
}
