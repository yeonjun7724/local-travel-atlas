/** npm run validate:data — CSV/JSON 을 수정한 뒤 실행하세요. 문제가 있으면 종료 코드 1 */
import fs from "node:fs";
import path from "node:path";
import { parseAtlasData, DataValidationError } from "../lib/data/parse";

const dir = path.join(process.cwd(), "data");
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

try {
  const pathsFile = path.join(dir, "route-paths.json");
  const d = parseAtlasData(read("places.csv"), read("routes.json"), read("categories.json"), fs.existsSync(pathsFile) ? fs.readFileSync(pathsFile, "utf8") : null);
  const noEn = d.places.filter((p) => !p.nameEn || !p.descriptionEn);
  const samples = d.places.filter((p) => p.isSample).length;
  console.log(`✅ 데이터 검증 통과: 장소 ${d.places.length}곳, 코스 ${d.routes.length}개, 카테고리 ${d.categories.length}개`);
  if (samples) console.log(`ℹ️  가상 샘플 장소 ${samples}곳 (실제 데이터로 교체 후 isSample=false)`);
  if (noEn.length)
    console.log(`⚠️  영어 번역이 비어 있어 한국어로 표시되는 장소 ${noEn.length}곳 (예: ${noEn.slice(0, 5).map((p) => p.nameKo).join(", ")}${noEn.length > 5 ? " …" : ""})`);
  const bySource = d.places.reduce<Record<string, number>>((m, p) => ((m[p.source] = (m[p.source] ?? 0) + 1), m), {});
  console.log(`📚 출처별: ${Object.entries(bySource).map(([k, v]) => `${k} ${v}곳`).join(", ")} · 사진 ${d.places.filter((p) => p.imageUrl).length}곳`);
  console.log(d.routePaths ? `🧭 실제 도보 경로: ${Object.keys(d.routePaths.routes).length}개 코스 (${d.routePaths.source}, ${d.routePaths.generatedAt})` : "ℹ️  route-paths.json 없음 → 코스는 직선 연결선으로 표시");
  if (d.places.length < 30) console.log(`⚠️  장소가 30곳 미만입니다 (${d.places.length}곳)`);
} catch (e) {
  if (e instanceof DataValidationError) {
    console.error("❌ " + e.message);
    process.exit(1);
  }
  throw e;
}
