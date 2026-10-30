"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Supercluster from "supercluster";
import type { FeatureCollection } from "geojson";
import { boundsOf, orderColor, segmentFeatures, splitByStops, straightLine, type LngLat } from "@/lib/data/geojson";
import { poiStyle } from "@/lib/data/poi-style";
import type { BBox } from "@/lib/geo";
import type { Category, Place } from "@/lib/validation/schemas";
import { PlaceMarkerContent } from "./PlaceMarker";

export type MapCommand = { type: "zoomIn" | "zoomOut"; seq: number } | null;

export interface MapViewProps {
  /** 지도에 표시할 장소(필터 결과). 코스가 선택되면 무시하고 routeStops 를 표시 */
  places: Place[];
  categories: Category[];
  /** 코스 방문지(순서대로) — 번호 마커로 표시, 클러스터링하지 않음 */
  routeStops: Place[] | null;
  /** 코스 경로 형상(실제 도보 경로 등). 없으면 직선 연결선 */
  routeGeometry: LngLat[] | null;
  /** 구간별 형상(있으면 그대로 사용, 없으면 routeGeometry 를 방문지 기준으로 나눔) — 구간마다 순서 색 */
  routeSegments?: LngLat[][] | null;
  /** true 면 코스 번호 핀과 함께 일반 장소도 표시(내 코스 편집 중: 지도에서 눌러 추가) */
  showPlacesWithRoute?: boolean;
  /** 전국 모드: 서버가 묶어 보낸 클러스터. 있으면 브라우저 클러스터링 대신 이것을 그립니다 */
  serverClusters?: { key: string; lng: number; lat: number; count: number }[] | null;
  /** 범위 맞춤 요청 시 이 범위로 이동(검색 결과 전체 범위 등). false 면 장소 목록으로 맞추지 않음 */
  fitTarget?: BBox | false | null;
  selectedId: string | null;
  userLocation: { lng: number; lat: number } | null;
  focusSeq: number;
  fitSeq: number;
  command: MapCommand;
  bottomInsetRatio: number;
  styleUrl: string;
  initialCenter: LngLat;
  initialZoom: number;
  labels: {
    loadFailed: string;
    retry: string;
    me: string;
    loading: string;
    cluster: (n: number) => string;
    nameOf: (p: Place) => string;
  };
  onSelectPlace: (id: string) => void;
  /** 지도 이동이 끝날 때마다 현재 보이는 영역 [서,남,동,북] */
  onViewChange?: (bbox: BBox, zoom: number) => void;
  /** 끝까지 확대해도 나뉘지 않는 클러스터(같은 건물·좌표의 여러 장소)를 눌렀을 때 그 장소 id 들 */
  onStackPick?: (ids: string[]) => void;
}

const ROUTE_COLOR = "#1b64da";
/** 이 줌 이상이면 장소 이름 라벨을 표시 */
const LABEL_ZOOM = 18;
/** 클러스터를 끝까지 풀어 주는 줌 */
const CLUSTER_MAX_ZOOM = 18;

// 워커는 public/maplibre/ 에서 직접 제공합니다 (scripts/copy-maplibre-worker.mjs 가 복사)
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/** 클러스터 테두리 링: 묶인 장소의 핀 색 비율대로 칠한 conic-gradient (많은 색부터) */
function mixRing(mix: Record<string, number>): string {
  const entries = Object.entries(mix).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
  let acc = 0;
  const stops = entries.map(([c, n]) => {
    const from = (acc / total) * 360;
    acc += n;
    return `${c} ${from.toFixed(1)}deg ${((acc / total) * 360).toFixed(1)}deg`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function motion(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

type Slot =
  | { key: string; kind: "pin"; el: HTMLElement; icon?: string; label: string; order?: number }
  | { key: string; kind: "cluster"; el: HTMLElement };

interface MarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLButtonElement;
  placeId?: string;
}

export default function MapView(props: MapViewProps) {
  const {
    places, categories, routeStops, routeGeometry, routeSegments, showPlacesWithRoute = false, serverClusters = null, fitTarget = null,
    selectedId, userLocation, focusSeq, fitSeq, command,
    bottomInsetRatio, styleUrl, initialCenter, initialZoom, labels, onSelectPlace, onViewChange, onStackPick,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastFitSeqRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);

  // 콜백·최신 값은 ref 로 들고 있어 지도 이벤트 핸들러가 항상 최신 상태를 봅니다.
  const latest = useRef({ places, routeStops, selectedId, categories, labels, onSelectPlace, onViewChange, onStackPick, showPlacesWithRoute, serverClusters });
  useEffect(() => {
    latest.current = { places, routeStops, selectedId, categories, labels, onSelectPlace, onViewChange, onStackPick, showPlacesWithRoute, serverClusters };
  });

  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  // 클러스터 인덱스: 장소 목록이 바뀔 때만 다시 만듭니다.
  // 각 클러스터는 묶인 장소의 핀 색별 개수(mix)를 함께 모아, 테두리 링을 업종 비율대로 칠합니다.
  const index = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const sc = new Supercluster<{ id: string; c: string }, { mix: Record<string, number> }>({
      radius: 72,
      maxZoom: CLUSTER_MAX_ZOOM,
      map: (p) => ({ mix: { [p.c]: 1 } }),
      reduce: (acc, p) => {
        for (const [k, n] of Object.entries(p.mix)) acc.mix[k] = (acc.mix[k] ?? 0) + n;
      },
    });
    sc.load(
      places.map((p) => ({
        type: "Feature",
        properties: { id: p.id, c: poiStyle(p, catById.get(p.category)).color },
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
      })),
    );
    return sc;
  }, [places, categories]);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const padding = useCallback(() => {
    const h = containerRef.current?.clientHeight ?? 600;
    return { top: 120, left: 48, right: 72, bottom: 56 + Math.round(h * bottomInsetRatio) };
  }, [bottomInsetRatio]);

  /** 현재 줌·영역에 맞춰 마커(클러스터/핀)를 다시 그립니다. 기존 요소는 재사용합니다. */
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { places: ps, routeStops: stops, selectedId: sel, categories: cats, labels: lb, showPlacesWithRoute: withPlaces, serverClusters: sClusters } = latest.current;
    const catById = new Map(cats.map((c) => [c.id, c]));
    const byId = new Map(ps.map((p) => [p.id, p]));
    const zoom = map.getZoom();
    if (wrapRef.current) wrapRef.current.dataset.labels = zoom >= LABEL_ZOOM ? "on" : "off";

    type Want = { key: string; lngLat: LngLat; place?: Place; order?: number; clusterId?: number; serverZoom?: number; count?: number; mix?: Record<string, number> };
    const want: Want[] = [];
    const stopIds = new Set(stops?.map((p) => p.id));
    stops?.forEach((p, i) => want.push({ key: `r-${p.id}`, lngLat: [p.longitude, p.latitude], place: p, order: i + 1 }));
    if (!stops || withPlaces) {
      if (sClusters) {
        // 전국 모드: 서버가 격자로 묶은 클러스터 (누르면 2단계 확대)
        for (const c of sClusters) want.push({ key: `s-${c.key}-${c.count}`, lngLat: [c.lng, c.lat], count: c.count, serverZoom: Math.min(Math.floor(zoom) + 2, CLUSTER_MAX_ZOOM) });
      } else {
        const b = map.getBounds();
        const bbox: BBox = [b.getWest() - 0.002, b.getSouth() - 0.002, b.getEast() + 0.002, b.getNorth() + 0.002];
        for (const f of indexRef.current.getClusters(bbox, Math.min(Math.floor(zoom), CLUSTER_MAX_ZOOM))) {
          const [lng, lat] = f.geometry.coordinates as LngLat;
          const prop = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string; mix?: Record<string, number> };
          // 키에 개수를 넣어, 장소 목록이 바뀌어 같은 id 가 다른 묶음이 되면 새로 그립니다
          if (prop.cluster) want.push({ key: `c-${prop.cluster_id}-${prop.point_count}`, lngLat: [lng, lat], clusterId: prop.cluster_id, count: prop.point_count, mix: prop.mix });
          else if (prop.id && byId.has(prop.id) && !stopIds.has(prop.id)) want.push({ key: `p-${prop.id}`, lngLat: [lng, lat], place: byId.get(prop.id) });
        }
      }
      // 선택한 장소가 클러스터에 묶여 있어도 항상 보이게 합니다.
      if (sel && byId.has(sel) && !want.some((w) => w.place?.id === sel)) {
        const p = byId.get(sel)!;
        want.push({ key: `p-${p.id}`, lngLat: [p.longitude, p.latitude], place: p });
      }
    }

    const store = markersRef.current;
    const keep = new Set(want.map((w) => w.key));
    store.forEach((entry, key) => {
      if (!keep.has(key)) {
        entry.marker.remove();
        store.delete(key);
      }
    });

    const nextSlots: Slot[] = [];
    for (const w of want) {
      let entry = store.get(w.key);
      if (!entry) {
        const el = document.createElement("button");
        el.type = "button";
        if (w.place) {
          const p = w.place;
          el.className = `atlas-pin${w.order ? " atlas-pin--numbered" : ""}`;
          el.dataset.testid = `marker-${p.id}`;
          el.setAttribute("aria-label", lb.nameOf(p));
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            latest.current.onSelectPlace(p.id);
          });
        } else {
          const n = w.count ?? 0;
          el.className = `atlas-cluster${n >= 50 ? " atlas-cluster--lg" : n < 10 ? " atlas-cluster--sm" : ""}${w.mix ? " atlas-cluster--mix" : ""}`;
          if (w.mix) el.style.setProperty("--ring", mixRing(w.mix));
          el.dataset.testid = "cluster";
          el.textContent = String(w.count);
          el.setAttribute("aria-label", lb.cluster(w.count ?? 0));
          const cid = w.clusterId;
          const serverZoom = w.serverZoom;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (cid === undefined) {
              map.easeTo({ center: w.lngLat, zoom: serverZoom ?? map.getZoom() + 2, duration: motion(400) });
              return;
            }
            const expansion = indexRef.current.getClusterExpansionZoom(cid);
            if (expansion > CLUSTER_MAX_ZOOM) {
              // 확대해도 나뉘지 않음(같은 좌표) → 지도 대신 목록으로 보여 줍니다
              const ids = indexRef.current.getLeaves(cid, Infinity).map((f) => (f.properties as { id: string }).id);
              latest.current.onStackPick?.(ids);
              map.easeTo({ center: w.lngLat, zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM), duration: motion(400) });
            } else {
              map.easeTo({ center: w.lngLat, zoom: expansion, duration: motion(400) });
            }
          });
        }
        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(w.lngLat).addTo(map);
        entry = { marker, el, placeId: w.place?.id };
        store.set(w.key, entry);
      } else if (!w.place) {
        entry.marker.setLngLat(w.lngLat);
      }
      if (w.place) {
        // 코스 번호 핀은 순서 색(구간 선과 같은 색), 일반 핀은 카테고리 색
        // 세부 업종 그룹별 색·아이콘(음식점·카페), 그 외는 카테고리 색 — 코스 번호 핀은 순서 색
        const style = poiStyle(w.place, catById.get(w.place.category));
        entry.el.style.setProperty("--marker-color", w.order ? orderColor(w.order - 1) : style.color);
        const on = w.place.id === sel;
        entry.el.classList.toggle("atlas-pin--selected", on);
        entry.el.setAttribute("aria-pressed", String(on));
        nextSlots.push({ key: w.key, kind: "pin", el: entry.el, icon: style.icon, label: lb.nameOf(w.place), order: w.order });
      } else {
        nextSlots.push({ key: w.key, kind: "cluster", el: entry.el });
      }
    }
    setSlots(nextSlots);
  }, []);

  // ── 지도 초기화 (브라우저에서만 실행되므로 SSR 오류 없음) ──────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: maplibregl.Map;
    const markers = markersRef.current;
    try {
      map = new maplibregl.Map({
        container,
        style: styleUrl,
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: { compact: true },
        keyboard: true,
      });
    } catch {
      const id = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(id);
    }
    mapRef.current = map;

    let styleReady = false;
    map.on("style.load", () => {
      if (styleReady) return;
      styleReady = true;
      map.addSource("route-straight", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("route-real", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-straight-casing", type: "line", source: "route-straight", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 6.5, "line-opacity": 0.85 } });
      map.addLayer({ id: "route-straight-line", type: "line", source: "route-straight", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["coalesce", ["get", "color"], ROUTE_COLOR], "line-width": 3.5, "line-dasharray": [2, 2] } });
      map.addLayer({ id: "route-real-casing", type: "line", source: "route-real", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 } });
      map.addLayer({ id: "route-real-line", type: "line", source: "route-real", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["coalesce", ["get", "color"], ROUTE_COLOR], "line-width": 5 } });
      setReady(true);
    });
    map.on("error", (e) => {
      const url = (e.error as { url?: string } | undefined)?.url;
      if (!styleReady && url && url === styleUrl) setFailed(true);
    });
    const onMoveEnd = () => {
      renderMarkers();
      const b = map.getBounds();
      latest.current.onViewChange?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom());
    };
    map.on("moveend", onMoveEnd);
    map.once("load", onMoveEnd);
    const timeout = window.setTimeout(() => {
      if (!styleReady) setFailed(true);
    }, 20000);

    return () => {
      window.clearTimeout(timeout);
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
      setSlots([]);
    };
    // 지도는 최초 1회(또는 재시도 시)만 만듭니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 데이터·선택·언어가 바뀌면 마커를 다시 그립니다.
  useEffect(() => {
    renderMarkers();
  }, [index, routeStops, selectedId, labels, categories, renderMarkers, attempt, serverClusters, showPlacesWithRoute]);

  // ── 코스 연결선 ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const straight = map.getSource("route-straight") as maplibregl.GeoJSONSource | undefined;
    const real = map.getSource("route-real") as maplibregl.GeoJSONSource | undefined;
    if (!straight || !real) return;
    const empty: FeatureCollection = { type: "FeatureCollection", features: [] };
    const state = !routeStops || routeStops.length < 2 ? "none" : routeGeometry && routeGeometry.length > 1 ? "real" : "straight";
    if (containerRef.current) containerRef.current.dataset.routeLine = state; // 테스트·디버깅용 상태 표시
    if (state === "real" && routeGeometry && routeStops) {
      straight.setData(empty);
      const segs = routeSegments?.length ? routeSegments : splitByStops(routeGeometry, routeStops.map((p) => [p.longitude, p.latitude] as LngLat));
      real.setData(segmentFeatures(segs.length ? segs : [routeGeometry]));
    } else if (state === "straight" && routeStops) {
      real.setData(empty);
      straight.setData(straightLine(routeStops));
    } else {
      straight.setData(empty);
      real.setData(empty);
    }
  }, [routeStops, routeGeometry, routeSegments, ready]);

  // ── 선택 장소로 이동 ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusSeq || !selectedId) return;
    const p = placesById.get(selectedId) ?? routeStops?.find((x) => x.id === selectedId);
    if (!p) return;
    map.easeTo({ center: [p.longitude, p.latitude], zoom: Math.max(map.getZoom(), 17), padding: padding(), duration: motion(600) });
    // focusSeq 가 바뀔 때만 이동합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq]);

  // ── 범위 맞춤 (명시적 요청 또는 첫 준비 시 공유 링크 대상) ──────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const fitRequested = fitSeq !== lastFitSeqRef.current;
    lastFitSeqRef.current = fitSeq;
    if (!fitRequested) {
      // 첫 로딩: 공유 링크로 장소/코스가 지정된 경우만 이동, 아니면 설정의 기본 위치 유지
      const sel = selectedId ? (placesById.get(selectedId) ?? routeStops?.find((x) => x.id === selectedId)) : undefined;
      if (sel) {
        map.jumpTo({ center: [sel.longitude, sel.latitude], zoom: 17, padding: padding() });
        return;
      }
      if (!routeStops) return;
    }
    if (!routeStops?.length || showPlacesWithRoute) {
      // 전국 모드: 검색 결과 범위로 맞추거나(fitTarget), 화면 안 장소로는 맞추지 않음(false)
      if (fitTarget === false && !routeStops?.length) return;
      if (fitTarget && !routeStops?.length) {
        map.fitBounds([[fitTarget[0], fitTarget[1]], [fitTarget[2], fitTarget[3]]], { padding: padding(), maxZoom: 17, bearing: 0, pitch: 0, duration: motion(700) });
        return;
      }
    }
    const coords: LngLat[] =
      routeGeometry && routeGeometry.length > 1
        ? routeGeometry
        : (routeStops ?? places).map((p) => [p.longitude, p.latitude] as LngLat);
    const b = boundsOf(coords);
    if (!b) return;
    if (coords.length === 1) {
      map.easeTo({ center: coords[0], zoom: 17, bearing: 0, pitch: 0, padding: padding(), duration: motion(600) });
      return;
    }
    map.fitBounds(b, { padding: padding(), maxZoom: 17, bearing: 0, pitch: 0, duration: motion(700) });
    // fitSeq 와 지도 준비 시점에만 맞춥니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSeq, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !command) return;
    if (command.type === "zoomIn") map.zoomIn({ duration: motion(250) });
    else map.zoomOut({ duration: motion(250) });
  }, [command]);

  // ── 내 위치 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;
    const el = document.createElement("div");
    el.className = "atlas-user";
    el.dataset.testid = "user-marker";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", labels.me);
    userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
    map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 16), padding: padding(), duration: motion(600) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, labels.me, ready]);

  return (
    <div ref={wrapRef} className="atlas-map relative h-full w-full bg-[var(--color-sand)]" data-labels="off">
      <div ref={containerRef} className="h-full w-full" data-testid="map-container" />
      {slots.map((s) =>
        s.kind === "pin" ? createPortal(<PlaceMarkerContent order={s.order} icon={s.icon} label={s.label} />, s.el, s.key) : null,
      )}

      {!ready && !failed && (
        <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center bg-[var(--color-sand)]" data-testid="map-loading" role="status">
          <div className="flex flex-col items-center gap-3 text-sm text-[var(--color-muted)]">
            <span className="skeleton h-3 w-40" />
            <span className="skeleton h-3 w-28" />
            <span>{labels.loading}</span>
          </div>
        </div>
      )}

      {failed && (
        <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[var(--color-paper)] p-6 text-center">
          <p className="max-w-sm text-sm text-[var(--color-muted)]">{labels.loadFailed}</p>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            {labels.retry}
          </button>
        </div>
      )}
    </div>
  );
}
