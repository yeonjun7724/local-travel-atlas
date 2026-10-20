"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { boundsOf, straightLine, type LngLat } from "@/lib/data/geojson";
import type { Category, Place } from "@/lib/validation/schemas";
import { PlaceMarkerContent } from "./PlaceMarker";

export type MapCommand = { type: "zoomIn" | "zoomOut"; seq: number } | null;

export interface MapViewProps {
  /** 지도에 표시할 장소(필터 결과 또는 코스 정류장) */
  places: Place[];
  categories: Category[];
  /** 코스가 선택되면 방문 순서대로 정렬된 장소들 — 번호 마커와 연결선이 표시됩니다 */
  routeStops: Place[] | null;
  /** 실제 경로 API 결과. 없으면 점선 직선 연결선을 그립니다 */
  routeGeometry: LngLat[] | null;
  selectedId: string | null;
  userLocation: { lng: number; lat: number } | null;
  /** 값이 바뀔 때마다 선택된 장소로 지도를 이동합니다 */
  focusSeq: number;
  /** 값이 바뀔 때마다 현재 표시 중인 장소 전체가 보이도록 맞춥니다 */
  fitSeq: number;
  command: MapCommand;
  /** 모바일 바텀시트가 가리는 지도 아래쪽 비율(0~1) */
  bottomInsetRatio: number;
  styleUrl: string;
  initialCenter: LngLat;
  initialZoom: number;
  labels: {
    loadFailed: string;
    retry: string;
    me: string;
    loading: string;
    categoryOf: (id: string) => string;
    nameOf: (p: Place) => string;
  };
  onSelectPlace: (id: string) => void;
}

const ROUTE_COLOR = "#c4532d";

// 워커는 public/maplibre/ 에서 직접 제공합니다 (scripts/copy-maplibre-worker.mjs 가 복사)
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/** 모션 줄이기 설정이면 지도 이동 애니메이션을 끕니다. */
function motion(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

interface MarkerEntry {
  marker: maplibregl.Marker;
  el: HTMLButtonElement;
}

export default function MapView(props: MapViewProps) {
  const {
    places, categories, routeStops, routeGeometry, selectedId, userLocation, focusSeq, fitSeq, command,
    bottomInsetRatio, styleUrl, initialCenter, initialZoom, labels, onSelectPlace,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelectPlace);
  const lastFitSeqRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // React Portal 로 마커 내용을 그리기 위한 목록
  const [markerSlots, setMarkerSlots] = useState<{ id: string; el: HTMLElement; order?: number; icon?: string }[]>([]);

  useEffect(() => {
    onSelectRef.current = onSelectPlace;
  }, [onSelectPlace]);

  const padding = useCallback(() => {
    const h = containerRef.current?.clientHeight ?? 600;
    return { top: 110, left: 48, right: 72, bottom: 48 + Math.round(h * bottomInsetRatio) };
  }, [bottomInsetRatio]);

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
        // 접근성: 키보드(방향키·+/-)로도 지도 조작 가능
        keyboard: true,
      });
    } catch {
      // WebGL 미지원 등 초기화 실패 — 화면 전체가 깨지지 않도록 안내 메시지를 보여 줍니다.
      const id = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(id);
    }
    mapRef.current = map;

    // 스타일(JSON)이 준비되면 경로선 레이어를 추가합니다. 타일이 로딩 중이어도 동작하도록 'load' 대신 'style.load'.
    let styleReady = false;
    map.on("style.load", () => {
      if (styleReady) return;
      styleReady = true;
      map.addSource("route-straight", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("route-real", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-straight-casing", type: "line", source: "route-straight",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 6.5, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "route-straight-line", type: "line", source: "route-straight",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_COLOR, "line-width": 3.5, "line-dasharray": [2, 2] },
      });
      map.addLayer({
        id: "route-real-casing", type: "line", source: "route-real",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.85 },
      });
      map.addLayer({
        id: "route-real-line", type: "line", source: "route-real",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ROUTE_COLOR, "line-width": 5 },
      });
      setReady(true);
    });
    map.on("error", (e) => {
      // 지도 스타일 자체를 받지 못한 경우만 치명적입니다. 타일·글꼴 하나가 실패하는 것은 무시합니다.
      const url = (e.error as { url?: string } | undefined)?.url;
      if (!styleReady && url && url === styleUrl) setFailed(true);
    });
    // 스타일이 끝내 준비되지 않으면(네트워크 단절 등) 안내를 보여 줍니다.
    const timeout = window.setTimeout(() => {
      if (!styleReady) setFailed(true);
    }, 20000);

    return () => {
      window.clearTimeout(timeout);
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      popupRef.current?.remove();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
      setMarkerSlots([]);
    };
    // 지도는 최초 1회(또는 재시도 시)만 만듭니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ── 마커 동기화 ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const store = markersRef.current;
    store.forEach(({ marker }) => marker.remove());
    store.clear();
    const catById = new Map(categories.map((c) => [c.id, c]));
    const orderOf = new Map((routeStops ?? []).map((p, i) => [p.id, i + 1]));
    const slots: { id: string; el: HTMLElement; order?: number; icon?: string }[] = [];

    for (const p of places) {
      const cat = catById.get(p.category);
      const el = document.createElement("button");
      el.type = "button";
      el.className = "atlas-marker";
      el.dataset.testid = `marker-${p.id}`;
      el.setAttribute("aria-label", labels.nameOf(p));
      el.setAttribute("aria-pressed", "false");
      el.style.setProperty("--marker-color", cat?.color ?? "#444");
      const order = orderOf.get(p.id);
      if (order) el.classList.add("atlas-marker--numbered");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(p.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.longitude, p.latitude]).addTo(map);
      store.set(p.id, { marker, el });
      slots.push({ id: p.id, el, order, icon: cat?.icon });
    }
    // 마커 안의 아이콘/번호는 React 가 Portal 로 그립니다 (마커 요소는 지도가 소유).
    setMarkerSlots(slots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, routeStops, categories, labels.nameOf, ready, attempt]);

  // ── 선택 강조 + 팝업 ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach(({ el }, id) => {
      const on = id === selectedId;
      el.classList.toggle("atlas-marker--selected", on);
      el.setAttribute("aria-pressed", String(on));
    });
    popupRef.current?.remove();
    popupRef.current = null;
    if (!map || !selectedId) return;
    const place = places.find((p) => p.id === selectedId);
    if (!place) return;
    // 팝업 내용은 textContent 로만 채워 XSS 를 방지합니다.
    const box = document.createElement("div");
    box.className = "atlas-popup";
    const title = document.createElement("strong");
    title.textContent = labels.nameOf(place);
    const sub = document.createElement("span");
    sub.textContent = labels.categoryOf(place.category);
    box.append(title, sub);
    popupRef.current = new maplibregl.Popup({ offset: 26, closeButton: false, closeOnClick: false, maxWidth: "240px" })
      .setLngLat([place.longitude, place.latitude])
      .setDOMContent(box)
      .addTo(map);
  }, [selectedId, places, labels, ready, markerSlots]);

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
    if (state === "real" && routeGeometry) {
      straight.setData(empty);
      real.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeGeometry } });
    } else if (state === "straight" && routeStops) {
      real.setData(empty);
      straight.setData(straightLine(routeStops));
    } else {
      straight.setData(empty);
      real.setData(empty);
    }
  }, [routeStops, routeGeometry, ready]);

  // ── 이동/맞춤 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusSeq || !selectedId) return;
    const p = places.find((x) => x.id === selectedId);
    if (!p) return;
    map.easeTo({ center: [p.longitude, p.latitude], zoom: Math.max(map.getZoom(), 16), padding: padding(), duration: motion(600) });
    // focusSeq 가 바뀔 때만 이동합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSeq]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const fitRequested = fitSeq !== lastFitSeqRef.current;
    lastFitSeqRef.current = fitSeq;
    // 공유 링크로 장소가 미리 선택된 채 지도가 준비된 경우에는 전체 맞춤 대신 그 장소로 이동합니다.
    const sel = !fitRequested ? places.find((x) => x.id === selectedId) : undefined;
    if (sel) {
      map.jumpTo({ center: [sel.longitude, sel.latitude], zoom: 16, padding: padding() });
      return;
    }
    const coords: LngLat[] = routeGeometry && routeGeometry.length > 1 ? routeGeometry : places.map((p) => [p.longitude, p.latitude] as LngLat);
    const b = boundsOf(coords);
    if (!b) return;
    if (coords.length === 1) {
      // 점 하나는 영역이 없어 fitBounds 가 부정확하므로 중심 이동으로 처리합니다.
      map.easeTo({ center: coords[0], zoom: 15.5, bearing: 0, pitch: 0, padding: padding(), duration: motion(600) });
      return;
    }
    map.fitBounds(b, { padding: padding(), maxZoom: 16, bearing: 0, pitch: 0, duration: motion(700) });
    // fitSeq 와 지도 준비 시점에만 맞춥니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSeq, ready]);

  // ── 확대/축소 명령 ────────────────────────────────────────────────────────
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
    map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 15.5), padding: padding(), duration: motion(600) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, labels.me, ready]);

  return (
    <div className="atlas-map relative h-full w-full bg-[var(--color-sand)]">
      <div ref={containerRef} className="h-full w-full" data-testid="map-container" />
      {markerSlots.map((s) => createPortal(<PlaceMarkerContent order={s.order} icon={s.icon} />, s.el, s.id))}

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
