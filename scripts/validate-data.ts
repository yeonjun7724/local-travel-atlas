/** npm run validate:data — CSV/JSON 을 수정한 뒤 실행하세요. 문제가 있으면 종료 코드 1 */
import fs from "node:fs";
import path from "node:path";
import { parseAtlasData, DataValidationError } from "../lib/data/parse";

const dir = path.join(process.cwd(), "data");
const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

try {
  const d = parseAtlasData(read("places.csv"), read("routes.json"), read("categories.json"));
  const noEn = d.places.filter((p) => !p.nameEn || !p.descriptionEn);
  const samples = d.places.filter((p) => p.isSample).length;
  console.log(`✅ 데이터 검증 통과: 장소 ${d.places.length}곳, 코스 ${d.routes.length}개, 카테고리 ${d.categories.length}개`);
  if (samples) console.log(`ℹ️  가상 샘플 장소 ${samples}곳 (실제 데이터로 교체 후 isSample=false)`);
  if (noEn.length) console.log(`⚠️  영어 번역이 비어 있어 한국어로 표시되는 장소: ${noEn.map((p) => p.id).join(", ")}`);
  if (d.places.length < 30) console.log(`⚠️  장소가 30곳 미만입니다 (${d.places.length}곳)`);
} catch (e) {
  if (e instanceof DataValidationError) {
    console.error("❌ " + e.message);
    process.exit(1);
  }
  throw e;
}
