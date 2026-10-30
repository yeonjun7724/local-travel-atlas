/** 지도와 무관한 순수 지리 계산 함수 (단위 테스트 가능) */

export type LngLat = [number, number];
/** [서, 남, 동, 북] */
export type BBox = [number, number, number, number];

export function haversineMeters(a: LngLat, b: LngLat): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function inBBox([lng, lat]: LngLat, [w, s, e, n]: BBox): boolean {
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

export function bboxCenter([w, s, e, n]: BBox): LngLat {
  return [(w + e) / 2, (s + n) / 2];
}

/** 두 영역이 충분히 달라졌는지(이동·확대 비율 기준). "이 지역에서 다시 찾기" 버튼 표시에 사용 */
export function bboxChanged(a: BBox, b: BBox, threshold = 0.2): boolean {
  const wA = a[2] - a[0];
  const hA = a[3] - a[1];
  const [cA, cB] = [bboxCenter(a), bboxCenter(b)];
  const moved = Math.abs(cA[0] - cB[0]) / wA + Math.abs(cA[1] - cB[1]) / hA;
  const scaled = Math.abs(Math.log((b[2] - b[0]) / wA));
  return moved > threshold || scaled > threshold;
}

/** 1.2km / 350m 형태 */
export function formatDistance(m: number, units: { km: string; m: string }): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}${units.km}`;
  return `${Math.round(m / 10) * 10}${units.m}`;
}
