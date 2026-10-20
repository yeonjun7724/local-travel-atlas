// MapLibre 워커 파일을 public/maplibre/ 로 복사합니다. (번들러가 워커 경로를 깨뜨리는 문제 방지)
import fs from "node:fs";
const src = "node_modules/maplibre-gl/dist";
fs.mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) fs.copyFileSync(`${src}/${f}`, `public/maplibre/${f}`);
console.log("maplibre worker files copied");
