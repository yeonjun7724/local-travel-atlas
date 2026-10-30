import type { FeatureCollection, LineString, Point } from "geojson";
import type { Place } from "@/lib/validation/schemas";

export type LngLat = [number, number];

export function toFeatureCollection(places: Place[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: places.map((p) => ({
      type: "Feature",
      id: p.id,
      properties: { id: p.id, nameKo: p.nameKo, category: p.category, theme: p.theme },
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
    })),
  };
}

/**
 * 코스 방문 순서별 색. i 번째 방문지 핀과 i→i+1 구간 선이 같은 색이라 순서를 한눈에 따라갈 수 있습니다.
 * 모두 흰 글자와 대비 4.5:1 이상인 진한 색입니다(9곳 이후 반복).
 */
export const ORDER_COLORS = ["#1b64da", "#d93036", "#0b7a3b", "#c2410c", "#7c3aed", "#0e7490", "#be185d", "#8a5a00", "#475569"];
export const orderColor = (i: number) => ORDER_COLORS[i % ORDER_COLORS.length];

/** 장소 사이를 직선으로 잇는 구간들 (실제 도로 경로가 아님) — 구간마다 순서 색 */
export function straightLine(places: Place[]): FeatureCollection<LineString> {
  return segmentFeatures(places.slice(1).map((p, i) => [[places[i].longitude, places[i].latitude], [p.longitude, p.latitude]]));
}

export function segmentFeatures(segments: LngLat[][]): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: segments
      .filter((s) => s.length > 1)
      .map((coordinates, i) => ({ type: "Feature", properties: { color: orderColor(i), order: i + 1 }, geometry: { type: "LineString", coordinates } })),
  };
}

/**
 * 하나로 이어진 경로 형상을 방문지 기준 구간으로 나눕니다.
 * (OSMnx 경로는 각 구간이 방문지 좌표에서 시작·끝나므로, 순서대로 가장 가까운 점을 찾아 자릅니다.)
 */
export function splitByStops(geometry: LngLat[], stops: LngLat[]): LngLat[][] {
  if (stops.length < 2 || geometry.length < 2) return [];
  const d2 = (a: LngLat, b: LngLat) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const cuts = [0];
  for (let k = 1; k < stops.length - 1; k++) {
    let best = cuts[k - 1];
    for (let i = cuts[k - 1]; i < geometry.length; i++) {
      if (d2(geometry[i], stops[k]) < d2(geometry[best], stops[k])) best = i;
      if (d2(geometry[i], stops[k]) === 0) break; // 정확히 일치하는 첫 점
    }
    cuts.push(best);
  }
  cuts.push(geometry.length - 1);
  return cuts.slice(1).map((end, i) => geometry.slice(cuts[i], end + 1));
}

export function boundsOf(coords: LngLat[]): [LngLat, LngLat] | null {
  if (!coords.length) return null;
  let [minX, minY] = coords[0];
  let [maxX, maxY] = coords[0];
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}
