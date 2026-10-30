import "server-only";
import { Pool } from "pg";
import type { Place } from "@/lib/validation/schemas";

/**
 * 전국 모드 데이터 접근 (PostGIS · scripts/data-pipeline/load_postgres.py 가 적재한 places 테이블)
 * DATABASE_URL 이 없으면 전국 모드를 쓰지 않습니다(동네 모드 = data/places.csv).
 */
export function remoteEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const globalForPg = globalThis as unknown as { atlasPool?: Pool };
function pool(): Pool {
  if (!globalForPg.atlasPool) {
    const url = process.env.DATABASE_URL!;
    globalForPg.atlasPool = new Pool({
      connectionString: url,
      max: 8,
      idleTimeoutMillis: 30_000,
      statement_timeout: 8_000,
      // Railway 외부 프록시는 TLS, 내부망(*.railway.internal)은 평문
      ssl: /\.railway\.internal|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false },
    });
  }
  return globalForPg.atlasPool;
}

const SEMAS_URL = "https://www.data.go.kr/data/15083033/fileData.do";
const THEME_OF: Record<string, string> = { food: "local-food", cafe: "cafe-alley", history: "history", landmark: "landmark", nature: "nature-rest" };

interface Row {
  id: string;
  name: string;
  category: string;
  subtype: string | null;
  address: string;
  lon: number;
  lat: number;
  doc: Place | null;
}

/** DB 한 행 → 앱의 Place. 진흥공단 행은 동네 모드 CSV(fetch_places.py)와 같은 규칙으로 구성합니다. */
export function rowToPlace(r: Row): Place {
  if (r.doc) return r.doc;
  const label = r.subtype ?? "";
  return {
    id: r.id,
    nameKo: r.name,
    nameEn: "",
    latitude: r.lat,
    longitude: r.lon,
    category: r.category,
    theme: THEME_OF[r.category] ?? r.category,
    descriptionKo: `상권업종 '${label}'(으)로 등록된 ${r.category === "cafe" ? "카페·디저트" : "음식점"}입니다.`,
    descriptionEn: "",
    address: r.address,
    imageUrl: "",
    source: "소상공인시장진흥공단",
    license: "공공데이터 (이용허락범위 제한 없음)",
    tags: label ? [label] : [],
    isSample: false,
    sourceUrl: SEMAS_URL,
    descriptionSource: "소상공인시장진흥공단 상가(상권)정보 업종 분류",
    descriptionSourceUrl: SEMAS_URL,
    subtype: r.subtype ?? undefined,
    openingHours: undefined,
    externalUrl: undefined,
    recommendedDurationMinutes: undefined,
    updatedAt: undefined,
    imageCredit: undefined,
    imageSourceUrl: undefined,
    wikidata: undefined,
  };
}

const COLS = "id, name, category, subtype, address, lon, lat, doc";

export type BBox = [number, number, number, number];

export interface ViewQuery {
  bbox: BBox;
  zoom: number;
  center: [number, number];
  category?: string | null;
  subtype?: string | null;
  q?: string | null;
  /** 목록 개수(가까운 순) */
  limit: number;
}

export interface ServerCluster {
  key: string;
  lng: number;
  lat: number;
  count: number;
}

export interface ViewResult {
  total: number;
  /** 화면 안 결과가 많으면 격자 클러스터, 적으면 개별 장소(points) */
  clusters: ServerCluster[] | null;
  points: Place[] | null;
  list: Place[];
  subtypes: { subtype: string; count: number }[];
}

/** 이 개수 이하이면 개별 점으로 보내고 브라우저(supercluster)가 묶습니다 */
export const POINT_LIMIT = 1500;
/** 클러스터 격자 한 칸의 화면 크기(px) */
const CELL_PX = 88;

function filters(v: { category?: string | null; subtype?: string | null; q?: string | null }, params: unknown[]): string {
  const where: string[] = [];
  if (v.category) {
    params.push(v.category);
    where.push(`category = $${params.length}`);
  }
  if (v.subtype) {
    params.push(v.subtype);
    where.push(`subtype = $${params.length}`);
  }
  if (v.q && v.q.trim()) {
    params.push(`%${v.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    where.push(`(name ILIKE $${params.length} OR address ILIKE $${params.length} OR subtype ILIKE $${params.length})`);
  }
  return where.length ? ` AND ${where.join(" AND ")}` : "";
}

// 같은 화면·조건 요청이 반복되므로 짧게 캐시합니다(인스턴스 메모리).
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 5 * 60_000;
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return value;
}

export async function queryView(v: ViewQuery): Promise<ViewResult> {
  const z = Math.max(3, Math.min(20, v.zoom));
  const cell = (360 / 2 ** z) * (CELL_PX / 512);
  // 격자에 맞춰 범위를 넓혀 두면 지도를 조금 움직여도 같은 클러스터가 유지되고 캐시도 잘 맞습니다
  const snap = (x: number, f: (n: number) => number) => f(x / cell) * cell;
  const bbox: BBox = [snap(v.bbox[0], Math.floor), snap(v.bbox[1], Math.floor), snap(v.bbox[2], Math.ceil), snap(v.bbox[3], Math.ceil)];
  const fkey = `${v.category ?? ""}|${v.subtype ?? ""}|${v.q ?? ""}`;
  const db = pool();

  const mapPart = cached(`map|${Math.floor(z)}|${bbox.map((n) => n.toFixed(5)).join(",")}|${fkey}`, async () => {
    const params: unknown[] = [...bbox];
    const where = `geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)${filters(v, params)}`;
    const { rows } = await db.query<{ n: string }>(`SELECT count(*) AS n FROM places WHERE ${where}`, params);
    const total = Number(rows[0].n);
    if (total <= POINT_LIMIT) {
      const pts = await db.query<Row>(`SELECT ${COLS} FROM places WHERE ${where}`, params);
      return { total, clusters: null, points: pts.rows.map(rowToPlace) };
    }
    params.push(cell);
    const c = params.length;
    const res = await db.query<{ gx: number; gy: number; n: string; lng: number; lat: number }>(
      `SELECT floor(lon / $${c})::int AS gx, floor(lat / $${c})::int AS gy, count(*) AS n, avg(lon) AS lng, avg(lat) AS lat
         FROM places WHERE ${where} GROUP BY 1, 2`,
      params,
    );
    const clusters = res.rows.map((r) => ({ key: `${Math.floor(z)}:${r.gx}:${r.gy}`, lng: r.lng, lat: r.lat, count: Number(r.n) }));
    return { total, clusters, points: null };
  });

  const listPart = (async () => {
    const params: unknown[] = [...v.bbox, v.center[0], v.center[1], v.limit];
    const where = `geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)${filters(v, params)}`;
    const { rows } = await db.query<Row>(
      `SELECT ${COLS} FROM places WHERE ${where} ORDER BY geom <-> ST_SetSRID(ST_MakePoint($5, $6), 4326) LIMIT $7`,
      params,
    );
    return rows.map(rowToPlace);
  })();

  const subPart = v.category
    ? cached(`sub|${Math.floor(z)}|${bbox.map((n) => n.toFixed(5)).join(",")}|${v.category}|${v.q ?? ""}`, async () => {
        const params: unknown[] = [...bbox];
        const where = `geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)${filters({ category: v.category, q: v.q }, params)}`;
        const { rows } = await db.query<{ subtype: string; n: string }>(
          `SELECT subtype, count(*) AS n FROM places WHERE ${where} AND subtype IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
          params,
        );
        return rows.map((r) => ({ subtype: r.subtype, count: Number(r.n) }));
      })
    : Promise.resolve([]);

  const [m, list, subtypes] = await Promise.all([mapPart, listPart, subPart]);
  return { ...m, list, subtypes };
}

/** 검색어와 일치하는 장소 전체(전국)의 범위 — 검색 시 지도를 결과에 맞추는 데 사용 */
export async function searchExtent(v: { category?: string | null; subtype?: string | null; q: string }): Promise<{ total: number; bbox: BBox | null }> {
  const params: unknown[] = [];
  const where = `TRUE${filters(v, params)}`;
  const { rows } = await pool().query<{ n: string; w: number; s: number; e: number; nn: number }>(
    `SELECT count(*) AS n, min(lon) AS w, min(lat) AS s, max(lon) AS e, max(lat) AS nn FROM places WHERE ${where}`,
    params,
  );
  const r = rows[0];
  const total = Number(r.n);
  return { total, bbox: total ? [r.w, r.s, r.e, r.nn] : null };
}

export async function placesByIds(ids: string[]): Promise<Place[]> {
  if (!ids.length) return [];
  const { rows } = await pool().query<Row>(`SELECT ${COLS} FROM places WHERE id = ANY($1)`, [ids]);
  const byId = new Map(rows.map((r) => [r.id, rowToPlace(r)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Place => Boolean(p));
}

export async function datasetMeta(): Promise<Record<string, string>> {
  return cached("meta", async () => {
    const { rows } = await pool().query<{ key: string; value: string }>("SELECT key, value FROM atlas_meta");
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
}
