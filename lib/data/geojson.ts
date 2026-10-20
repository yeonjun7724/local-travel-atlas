import type { Feature, FeatureCollection, LineString, Point } from "geojson";
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

/** 장소 사이를 직선으로 잇는 LineString (실제 도로 경로가 아님) */
export function straightLine(places: Place[]): Feature<LineString> {
  return {
    type: "Feature",
    properties: { kind: "straight" },
    geometry: { type: "LineString", coordinates: places.map((p) => [p.longitude, p.latitude]) },
  };
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
