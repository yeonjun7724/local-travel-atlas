import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseAtlasData } from "./parse";
import type { AtlasData } from "@/lib/validation/schemas";

const dataDir = path.join(process.cwd(), "data");

/** 서버 전용: data/ 폴더의 CSV·JSON을 읽어 검증합니다. (나중에 CMS/DB로 바꿀 때 이 파일만 교체) */
export function loadAtlasData(): AtlasData {
  const read = (f: string) => fs.readFileSync(path.join(dataDir, f), "utf8");
  const pathsFile = path.join(dataDir, "route-paths.json");
  const routePaths = fs.existsSync(pathsFile) ? fs.readFileSync(pathsFile, "utf8") : null;
  return parseAtlasData(read("places.csv"), read("routes.json"), read("categories.json"), routePaths);
}

/**
 * 전국 모드 추천 코스(data/nationwide/) — 코스 방문지(OSM 명소)·코스·OSMnx 경로를 같은 규칙으로 검증합니다.
 * 방문지 장소는 load_postgres.py 가 DB 에도 함께 적재합니다.
 */
export function loadNationwideRoutes(): AtlasData {
  const dir = path.join(dataDir, "nationwide");
  const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
  const pathsFile = path.join(dir, "route-paths.json");
  const csv = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("-places.csv"))
    .map((f, i) => (i === 0 ? read(f) : read(f).split(/\r?\n/).slice(1).join("\n")))
    .join("\n");
  return parseAtlasData(csv, read("routes.json"), fs.readFileSync(path.join(dataDir, "categories.json"), "utf8"), fs.existsSync(pathsFile) ? read("route-paths.json") : null);
}
