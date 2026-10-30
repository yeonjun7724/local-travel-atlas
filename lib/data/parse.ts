import Papa from "papaparse";
import {
  categoriesFileSchema,
  crossValidate,
  placeRowSchema,
  routePathsFileSchema,
  routesFileSchema,
  type AtlasData,
} from "@/lib/validation/schemas";

const REQUIRED_COLUMNS = [
  "id", "nameKo", "nameEn", "latitude", "longitude", "category", "theme",
  "descriptionKo", "descriptionEn", "address", "imageUrl", "source", "license",
];

export class DataValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`데이터 검증 실패 (${issues.length}건)\n - ${issues.join("\n - ")}`);
    this.name = "DataValidationError";
  }
}

/** 순수 함수: 원본 텍스트 3종을 받아 검증된 데이터를 돌려줍니다. (fs 의존 없음 → 테스트 용이) */
export function parseAtlasData(csvText: string, routesJson: string, categoriesJson: string, routePathsJson?: string | null): AtlasData {
  const issues: string[] = [];

  let categoriesRaw: unknown;
  let routesRaw: unknown;
  try {
    categoriesRaw = JSON.parse(categoriesJson);
  } catch (e) {
    throw new DataValidationError([`categories.json JSON 문법 오류: ${(e as Error).message}`]);
  }
  try {
    routesRaw = JSON.parse(routesJson);
  } catch (e) {
    throw new DataValidationError([`routes.json JSON 문법 오류: ${(e as Error).message}`]);
  }

  const cats = categoriesFileSchema.safeParse(categoriesRaw);
  if (!cats.success) issues.push(...cats.error.issues.map((i) => `categories.json ${i.path.join(".")}: ${i.message}`));
  const routes = routesFileSchema.safeParse(routesRaw);
  if (!routes.success) issues.push(...routes.error.issues.map((i) => `routes.json ${i.path.join(".")}: ${i.message}`));

  const text = csvText.replace(/^﻿/, ""); // 엑셀이 붙이는 BOM 제거
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const missing = REQUIRED_COLUMNS.filter((c) => !(parsed.meta.fields ?? []).includes(c));
  if (missing.length) issues.push(`places.csv 에 필수 열이 없습니다: ${missing.join(", ")}`);
  for (const e of parsed.errors) issues.push(`places.csv ${e.row !== undefined ? e.row + 2 : "?"}행: ${e.message}`);

  const places: AtlasData["places"] = [];
  if (!missing.length) {
    parsed.data.forEach((row, idx) => {
      const r = placeRowSchema.safeParse(row);
      if (r.success) places.push(r.data);
      else
        issues.push(
          ...r.error.issues.map((i) => `places.csv ${idx + 2}행 [${row.id ?? "?"}] ${i.path.join(".")}: ${i.message}`),
        );
    });
  }
  if (!parsed.data.length) issues.push("places.csv 에 장소가 없습니다");

  let routePaths: AtlasData["routePaths"] = null;
  if (routePathsJson) {
    try {
      const rp = routePathsFileSchema.safeParse(JSON.parse(routePathsJson));
      if (rp.success) routePaths = rp.data;
      else issues.push(...rp.error.issues.map((i) => `route-paths.json ${i.path.join(".")}: ${i.message}`));
    } catch (e) {
      issues.push(`route-paths.json JSON 문법 오류: ${(e as Error).message}`);
    }
  }

  if (issues.length || !cats.success || !routes.success) throw new DataValidationError(issues);

  const data: AtlasData = {
    places,
    routes: routes.data,
    categories: cats.data.categories,
    themes: cats.data.themes,
    routePaths,
  };
  const cross = crossValidate(data);
  if (cross.length) throw new DataValidationError(cross);
  return data;
}
