"use client";

import { useEffect, useRef, useState } from "react";
import type { BBox } from "@/lib/geo";
import type { Place } from "@/lib/validation/schemas";

/** 전국 모드(/api/places) 응답 */
export interface RemoteView {
  total: number;
  clusters: { key: string; lng: number; lat: number; count: number }[] | null;
  points: Place[] | null;
  list: Place[];
  subtypes: { subtype: string; count: number }[];
}

export interface RemoteQuery {
  bbox: BBox;
  zoom: number;
  center: [number, number];
  category: string | null;
  subtype: string | null;
  q: string;
  limit: number;
}

const r6 = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * 지도 화면이 바뀔 때마다(디바운스) 서버에서 클러스터·장소·목록을 받아 옵니다.
 * query 가 null 이면 요청하지 않습니다(동네 모드·코스 보기 등).
 */
export function useRemoteView(query: RemoteQuery | null, onData?: (v: RemoteView) => void): { data: RemoteView | null; loading: boolean; error: boolean } {
  const onDataRef = useRef(onData);
  useEffect(() => {
    onDataRef.current = onData;
  });
  const [state, setState] = useState<{ key: string; data: RemoteView | null; error: boolean }>({ key: "", data: null, error: false });
  const key = query
    ? [query.bbox.map(r6).join(","), query.zoom.toFixed(1), query.center.map(r6).join(","), query.category ?? "", query.subtype ?? "", query.q.trim(), query.limit].join("|")
    : "";

  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      const sp = new URLSearchParams({
        bbox: query.bbox.map(r6).join(","),
        z: query.zoom.toFixed(2),
        cx: String(r6(query.center[0])),
        cy: String(r6(query.center[1])),
        limit: String(query.limit),
      });
      if (query.category) sp.set("cat", query.category);
      if (query.subtype) sp.set("sub", query.subtype);
      if (query.q.trim()) sp.set("q", query.q.trim());
      try {
        const res = await fetch(`/api/places?${sp}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as RemoteView;
        onDataRef.current?.(data);
        setState({ key, data, error: false });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState((s) => ({ key, data: s.data, error: true }));
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
    // key 가 query 의 모든 값을 담고 있습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data: query ? state.data : null, loading: Boolean(query) && state.key !== key, error: state.error && state.key === key };
}

export async function fetchPlacesByIds(ids: string[]): Promise<Place[]> {
  if (!ids.length) return [];
  const res = await fetch(`/api/places?ids=${encodeURIComponent(ids.join(","))}`);
  if (!res.ok) return [];
  return ((await res.json()) as { places: Place[] }).places;
}

export async function fetchSearchExtent(q: string, category: string | null, subtype: string | null): Promise<{ total: number; bbox: BBox | null } | null> {
  const sp = new URLSearchParams({ extent: "1", q });
  if (category) sp.set("cat", category);
  if (subtype) sp.set("sub", subtype);
  const res = await fetch(`/api/places?${sp}`).catch(() => null);
  return res?.ok ? ((await res.json()) as { total: number; bbox: BBox | null }) : null;
}
