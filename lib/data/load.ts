import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseAtlasData } from "./parse";
import type { AtlasData } from "@/lib/validation/schemas";

const dataDir = path.join(process.cwd(), "data");

/** 서버 전용: data/ 폴더의 CSV·JSON을 읽어 검증합니다. (나중에 CMS/DB로 바꿀 때 이 파일만 교체) */
export function loadAtlasData(): AtlasData {
  const read = (f: string) => fs.readFileSync(path.join(dataDir, f), "utf8");
  return parseAtlasData(read("places.csv"), read("routes.json"), read("categories.json"));
}
