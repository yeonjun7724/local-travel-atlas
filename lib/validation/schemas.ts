import { z } from "zod";

const httpUrl = z.string().refine((v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}, "http(s) URL 형식이 아닙니다");

/** 빈 문자열 / 상대 경로(/images/..) / http(s) URL 허용 */
const imageUrl = z.string().refine((v) => v === "" || v.startsWith("/") || httpUrl.safeParse(v).success, {
  message: "imageUrl 은 비워 두거나 /images/... 또는 http(s) URL 이어야 합니다",
});

const noBrokenEncoding = (s: string) => !s.includes("�");

export const categorySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  labelKo: z.string().min(1),
  labelEn: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().optional(),
});

export const themeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  labelKo: z.string().min(1),
  labelEn: z.string().min(1),
});

export const categoriesFileSchema = z.object({
  categories: z.array(categorySchema).min(1),
  themes: z.array(themeSchema).min(1),
});

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

/** CSV 한 행(모두 문자열)을 검증·변환하는 스키마 */
export const placeRowSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id 는 영문 소문자·숫자·하이픈만 사용할 수 있습니다"),
  nameKo: z.string().trim().min(1, "nameKo 가 비어 있습니다"),
  nameEn: z.string().trim(), // 비어 있으면 한국어로 대체(폴백)됩니다
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  category: z.string().min(1),
  theme: z.string().min(1),
  descriptionKo: z.string().trim().min(1, "descriptionKo 가 비어 있습니다"),
  descriptionEn: z.string().trim(),
  address: z.string().trim().min(1, "address 가 비어 있습니다"),
  imageUrl,
  source: z.string().trim().min(1, "source(출처)가 비어 있습니다"),
  license: z.string().trim().min(1, "license(이용조건)가 비어 있습니다"),
  openingHours: optionalText,
  tags: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split("|")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    ),
  externalUrl: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined))
    .refine((v) => v === undefined || httpUrl.safeParse(v).success, "externalUrl 은 http(s) URL 이어야 합니다"),
  recommendedDurationMinutes: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v) : undefined))
    .refine(
      (v) => v === undefined || (Number.isInteger(v) && v > 0 && v <= 1440),
      "recommendedDurationMinutes 는 1~1440 사이 정수여야 합니다",
    ),
  updatedAt: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined))
    .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "updatedAt 은 YYYY-MM-DD 형식이어야 합니다"),
  isSample: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().toLowerCase() === "true"),
});

export type Place = z.infer<typeof placeRowSchema>;

export const routeSchema = z.object({
  routeId: z.string().regex(/^[a-z0-9-]+$/),
  titleKo: z.string().min(1),
  titleEn: z.string(),
  descriptionKo: z.string().min(1),
  descriptionEn: z.string(),
  theme: z.string().min(1),
  placeIds: z.array(z.string()).min(2, "코스에는 장소가 2곳 이상 필요합니다"),
  transportMode: z.enum(["walking", "driving"]),
});
export const routesFileSchema = z.array(routeSchema).min(1);
export type Route = z.infer<typeof routeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Theme = z.infer<typeof themeSchema>;

export interface AtlasData {
  places: Place[];
  routes: Route[];
  categories: Category[];
  themes: Theme[];
}

/** 파싱된 모든 데이터의 교차 검증. 문제 목록을 반환합니다(빈 배열이면 정상). */
export function crossValidate(data: AtlasData): string[] {
  const errors: string[] = [];
  const catIds = new Set(data.categories.map((c) => c.id));
  const themeIds = new Set(data.themes.map((t) => t.id));
  const seen = new Set<string>();
  for (const p of data.places) {
    if (seen.has(p.id)) errors.push(`장소 id 중복: ${p.id}`);
    seen.add(p.id);
    if (!catIds.has(p.category)) errors.push(`[${p.id}] 존재하지 않는 category: ${p.category}`);
    if (!themeIds.has(p.theme)) errors.push(`[${p.id}] 존재하지 않는 theme: ${p.theme}`);
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === "string" && !noBrokenEncoding(v))
        errors.push(`[${p.id}] ${k} 에 깨진 문자(�)가 있습니다 — CSV를 UTF-8로 저장하세요`);
    }
  }
  const routeIds = new Set<string>();
  for (const r of data.routes) {
    if (routeIds.has(r.routeId)) errors.push(`코스 routeId 중복: ${r.routeId}`);
    routeIds.add(r.routeId);
    if (!themeIds.has(r.theme)) errors.push(`[${r.routeId}] 존재하지 않는 theme: ${r.theme}`);
    const inRoute = new Set<string>();
    for (const pid of r.placeIds) {
      if (!seen.has(pid)) errors.push(`[${r.routeId}] 코스가 참조하는 장소 id 가 없습니다: ${pid}`);
      if (inRoute.has(pid)) errors.push(`[${r.routeId}] 같은 장소가 코스에 중복되었습니다: ${pid}`);
      inRoute.add(pid);
    }
  }
  return errors;
}
