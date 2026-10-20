import { describe, expect, it } from "vitest";
import { fetchOrsRoute, formatDuration, RoutingError } from "@/lib/routing/ors";

// 네트워크 없이 ORS 응답 형식을 흉내 낸 테스트입니다. (실제 API 호출은 TEST_REPORT 의 미검증 항목)
const sample = {
  features: [
    {
      geometry: { coordinates: [[127.1, 35.8], [127.2, 35.9], [127.3, 36.0]] },
      properties: {
        summary: { distance: 3000, duration: 2400 },
        segments: [
          { distance: 1000, duration: 800 },
          { distance: 2000, duration: 1600 },
        ],
      },
    },
  ],
};
const mockFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("OpenRouteService 클라이언트", () => {
  const coords: [number, number][] = [[127.1, 35.8], [127.2, 35.9], [127.3, 36.0]];

  it("정상 응답 파싱", async () => {
    const r = await fetchOrsRoute(coords, "walking", "k", mockFetch(200, sample));
    expect(r.totalDistanceM).toBe(3000);
    expect(r.segments).toHaveLength(2);
    expect(r.geometry).toHaveLength(3);
  });
  it("프로필·키 헤더 전달", async () => {
    let url = "";
    let auth = "";
    const spy = (async (u: string, init: RequestInit) => {
      url = u;
      auth = (init.headers as Record<string, string>).Authorization;
      return new Response(JSON.stringify(sample), { status: 200 });
    }) as unknown as typeof fetch;
    await fetchOrsRoute(coords, "driving", "secret", spy);
    expect(url).toContain("driving-car");
    expect(auth).toBe("secret");
  });
  it("429 → rate_limited", async () => {
    await expect(fetchOrsRoute(coords, "walking", "k", mockFetch(429, {}))).rejects.toMatchObject({ code: "rate_limited" });
  });
  it("500 → upstream_error", async () => {
    await expect(fetchOrsRoute(coords, "walking", "k", mockFetch(500, {}))).rejects.toBeInstanceOf(RoutingError);
  });
  it("형식이 다른 응답 → bad_response", async () => {
    await expect(fetchOrsRoute(coords, "walking", "k", mockFetch(200, { nope: 1 }))).rejects.toMatchObject({ code: "bad_response" });
  });
  it("네트워크 실패 → upstream_error", async () => {
    const failing = (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    await expect(fetchOrsRoute(coords, "walking", "k", failing)).rejects.toMatchObject({ code: "upstream_error" });
  });
  it("시간 포맷", () => {
    expect(formatDuration(3700)).toEqual({ hours: 1, minutes: 2 });
    expect(formatDuration(10)).toEqual({ hours: 0, minutes: 1 });
  });
});
