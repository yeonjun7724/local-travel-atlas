"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Info } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/components/common/I18nProvider";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { SearchBar } from "@/components/common/SearchBar";
import { ShareDialog, type ShareScope } from "@/components/common/ShareDialog";
import { Toast, type ToastMessage } from "@/components/common/Toast";
import { MobileBottomSheet, sheetSnaps, type SheetState } from "@/components/layout/MobileBottomSheet";
import { SiteHeader, TabNav, type Tab } from "@/components/layout/SiteHeader";
import { ListToggle, MapControls } from "@/components/map/MapControls";
import type { MapCommand } from "@/components/map/MapView";
import { CategoryFilters } from "@/components/places/CategoryFilters";
import { PlaceDetailPanel } from "@/components/places/PlaceDetailPanel";
import { PlaceList } from "@/components/places/PlaceList";
import { RouteExplorer, type RouteLoadState } from "@/components/routes/RouteExplorer";
import { filterPlaces } from "@/lib/data/filter";
import { useIsDesktop, useIsWide } from "@/lib/hooks";
import { localizeLabel, localizePlace, localizeRoute } from "@/lib/i18n";
import type { RouteResult, TransportMode } from "@/lib/routing/ors";
import { buildShareUrl, parseShareParams } from "@/lib/share";
import type { AtlasData } from "@/lib/validation/schemas";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--color-sand)]" aria-hidden="true" />,
});

type GeoStatus = "idle" | "loading";

function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export default function AtlasApp({ data, routingEnabled }: { data: AtlasData; routingEnabled: boolean }) {
  const { t, lang } = useI18n();
  const isDesktop = useIsDesktop();
  const isWide = useIsWide();
  const online = useOnline();

  const [tab, setTab] = useState<Tab>("places");
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const [fitSeq, setFitSeq] = useState(0);
  const [command, setCommand] = useState<MapCommand>(null);
  const [sheet, setSheet] = useState<SheetState>("half");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [mainHeight, setMainHeight] = useState(600);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareScope, setShareScope] = useState<ShareScope>("map");
  const [mode, setMode] = useState<TransportMode>("walking");
  const [loadState, setLoadState] = useState<RouteLoadState>({ status: "idle" });
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const requestRef = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  const placesById = useMemo(() => new Map(data.places.map((p) => [p.id, p])), [data.places]);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const activeRoute = useMemo(() => data.routes.find((r) => r.routeId === routeId) ?? null, [data.routes, routeId]);
  const routeStops = useMemo(
    () => (activeRoute ? activeRoute.placeIds.map((id) => placesById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) : null),
    [activeRoute, placesById],
  );
  const filtered = useMemo(() => filterPlaces(data.places, { category, query }), [data.places, category, query]);
  // 코스가 선택되면 코스 장소만, 장소 탭이면 필터 결과, 코스 탭(목록)이면 전체 장소를 지도에 표시
  const mapPlaces = routeStops ?? (tab === "places" ? filtered : data.places);
  const effectiveSelectedId = selectedId && mapPlaces.some((p) => p.id === selectedId) ? selectedId : null;
  const selectedPlace = effectiveSelectedId ? (placesById.get(effectiveSelectedId) ?? null) : null;
  const hasSamples = data.places.some((p) => p.isSample);
  const hasFilter = category !== null || query.trim() !== "";

  const bumpFit = useCallback(() => setFitSeq((n) => n + 1), []);
  const bumpFocus = useCallback(() => setFocusSeq((n) => n + 1), []);
  const showToast = useCallback((kind: ToastMessage["kind"], text: string) => setToast({ id: Date.now(), kind, text }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  // ── 지도 영역 높이 측정 → 바텀시트 단계 높이 계산 ───────────────────────────
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMainHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop]);

  const snaps = sheetSnaps(mainHeight);
  const sheetHeight = dragHeight ?? snaps[sheet];
  // 시트가 지도를 가리는 높이(전체 단계에서는 절반까지만 계산해 지도 중심이 극단적으로 밀리지 않게)
  const sheetInset = isDesktop ? 0 : Math.min(sheetHeight, snaps.half);

  // ── 온라인/오프라인 전환 안내 ───────────────────────────────────────────────
  const onlineRef = useRef(online);
  useEffect(() => {
    if (onlineRef.current === online) return;
    onlineRef.current = online;
    // 외부 상태(네트워크) 변화에 대한 일회성 알림
    showToast(online ? "success" : "error", t(online ? "net.online" : "net.offline"));
  }, [online, showToast, t]);

  // ── 공유 링크로 들어왔을 때 코스/장소 자동 선택 (잘못된 값은 무시) ────────────
  useEffect(() => {
    const parsed = parseShareParams(window.location.search, new Set(data.places.map((p) => p.id)), new Set(data.routes.map((r) => r.routeId)));
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 URL 은 마운트 후에만 읽을 수 있습니다 */
    if (parsed.routeId) {
      const r = data.routes.find((x) => x.routeId === parsed.routeId);
      setTab("routes");
      setRouteId(parsed.routeId);
      if (r) setMode(r.transportMode);
    }
    if (parsed.placeId) {
      setSelectedId(parsed.placeId);
      setFocusSeq(1);
    }
    setUrlReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data.places, data.routes]);

  // 선택 상태를 주소창에 반영(새로고침·복사해도 같은 화면)
  useEffect(() => {
    if (!urlReady) return;
    const next = buildShareUrl(window.location.href, { routeId: routeId ?? undefined, placeId: effectiveSelectedId ?? undefined });
    const u = new URL(next);
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [urlReady, routeId, effectiveSelectedId]);

  // 새 장소를 열면 패널 스크롤을 맨 위로
  useEffect(() => {
    if (effectiveSelectedId) document.getElementById("panel-content")?.scrollTo({ top: 0 });
  }, [effectiveSelectedId]);

  // ── 핸들러 ────────────────────────────────────────────────────────────────
  const openSheetIfCollapsed = useCallback(() => setSheet((s) => (s === "collapsed" ? "half" : s)), []);

  const selectPlace = useCallback(
    (id: string) => {
      setSelectedId(id);
      bumpFocus();
      openSheetIfCollapsed();
    },
    [bumpFocus, openSheetIfCollapsed],
  );

  const closeDetail = useCallback(() => {
    const id = effectiveSelectedId;
    setSelectedId(null);
    // 목록으로 돌아오면 방금 보던 카드로 포커스·스크롤을 복원합니다.
    if (id) {
      window.requestAnimationFrame(() => {
        const card = document.getElementById(`place-card-${id}`);
        card?.scrollIntoView({ block: "center" });
        card?.focus({ preventScroll: true });
      });
    }
  }, [effectiveSelectedId]);

  // Esc 로 상세 닫기 (입력창·대화상자에서는 제외)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || shareOpen || !selectedPlace) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen, selectedPlace, closeDetail]);

  const changeTab = (next: Tab) => {
    setTab(next);
    if (next === "places") setRouteId(null);
    setSelectedId(null);
    setLoadState({ status: "idle" });
    bumpFit();
  };
  const selectRoute = (id: string) => {
    const r = data.routes.find((x) => x.routeId === id);
    setTab("routes");
    setRouteId(id);
    setSelectedId(null);
    setLoadState({ status: "idle" });
    if (r) setMode(r.transportMode);
    openSheetIfCollapsed();
    bumpFit();
  };
  const backToRoutes = () => {
    setRouteId(null);
    setSelectedId(null);
    setLoadState({ status: "idle" });
    bumpFit();
  };
  /** 검색·필터는 항상 "장소 탐색" 흐름에서 동작합니다. 코스/상세를 보던 중이면 장소 탐색으로 돌아옵니다. */
  const enterPlacesBrowse = () => {
    if (tab !== "places" || routeId || selectedId) {
      setTab("places");
      setRouteId(null);
      setSelectedId(null);
      setLoadState({ status: "idle" });
    }
    openSheetIfCollapsed();
    bumpFit();
  };
  const changeCategory = (id: string | null) => {
    setCategory(id);
    enterPlacesBrowse();
  };
  const changeQuery = (q: string) => {
    setQuery(q);
    enterPlacesBrowse();
  };
  const resetFilters = () => {
    setCategory(null);
    setQuery("");
    bumpFit();
  };

  const openShare = (scope?: ShareScope) => {
    setShareScope(scope ?? (effectiveSelectedId ? "place" : routeId ? "route" : "map"));
    setShareOpen(true);
  };

  const changeMode = (m: TransportMode) => {
    requestRef.current += 1;
    setMode(m);
    setLoadState({ status: "idle" });
  };

  const loadTimes = async () => {
    if (!routeId) return;
    const myRequest = ++requestRef.current;
    setLoadState({ status: "loading" });
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, mode }),
        signal: AbortSignal.timeout(20000),
      });
      if (myRequest !== requestRef.current) return; // 그 사이 코스/이동수단이 바뀐 응답은 버립니다
      if (res.status === 503) return setLoadState({ status: "error", code: "not_configured" });
      if (res.status === 429) return setLoadState({ status: "error", code: "rate_limited" });
      if (!res.ok) return setLoadState({ status: "error", code: "failed" });
      const body = (await res.json()) as RouteResult;
      if (myRequest !== requestRef.current) return;
      setLoadState({ status: "ok", data: body });
      bumpFit();
    } catch {
      if (myRequest === requestRef.current) setLoadState({ status: "error", code: "failed" });
    }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return showToast("error", t("geo.unsupported"));
    setGeo("loading");
    // 사용자가 버튼을 눌렀을 때만 권한을 요청하며, 좌표는 서버로 보내거나 저장하지 않습니다.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setGeo("idle");
        showToast("success", t("geo.success"));
      },
      (err) => {
        setGeo("idle");
        const key = err.code === err.PERMISSION_DENIED ? "geo.denied" : err.code === err.TIMEOUT ? "geo.timeout" : "geo.unavailable";
        showToast("error", t(key));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const zoom = (type: "zoomIn" | "zoomOut") => setCommand((c) => ({ type, seq: (c?.seq ?? 0) + 1 }));

  // ── 지도 라벨(안정적인 참조로 불필요한 마커 재생성 방지) ───────────────────────
  const nameOf = useCallback((p: AtlasData["places"][number]) => localizePlace(p, lang).name, [lang]);
  const mapLabels = useMemo(
    () => ({
      loadFailed: t("map.loadFailed"),
      retry: t("map.retry"),
      me: t("geo.me"),
      loading: t("map.loading"),
      nameOf,
      categoryOf: (id: string) => {
        const c = catById.get(id);
        return c ? localizeLabel(c, lang) : id;
      },
    }),
    [t, nameOf, catById, lang],
  );

  const routeGeometry = loadState.status === "ok" && loadState.data.mode === mode ? loadState.data.geometry : null;
  const shareTitles = {
    route: activeRoute ? localizeRoute(activeRoute, lang).title : undefined,
    place: selectedPlace ? localizePlace(selectedPlace, lang).name : undefined,
  };

  // ── 패널 내용 (데스크톱 사이드 패널과 모바일 바텀시트가 공유) ─────────────────
  const placeRoutes = selectedPlace ? data.routes.filter((r) => r.placeIds.includes(selectedPlace.id)) : [];
  const detail = selectedPlace && (
    <PlaceDetailPanel
      place={selectedPlace}
      category={catById.get(selectedPlace.category)}
      routes={placeRoutes}
      activeRoute={activeRoute}
      orderInActiveRoute={activeRoute ? activeRoute.placeIds.indexOf(selectedPlace.id) + 1 || undefined : undefined}
      onBack={closeDetail}
      onShare={() => openShare("place")}
      onFocusMap={() => {
        if (!isDesktop) setSheet("collapsed"); // 모바일: 시트를 내려 지도에서 위치를 보여 줍니다
        bumpFocus();
      }}
      onOpenRoute={selectRoute}
    />
  );

  const placesBrowse = (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
        <p role="status" aria-live="polite" data-testid="result-count" className="font-medium">
          {t("results.count", { n: filtered.length })}
        </p>
        {hasFilter && (
          <button type="button" onClick={resetFilters} data-testid="reset-filters" className="btn btn-ghost !min-h-9 !px-3 text-[var(--color-accent-strong)]">
            {t("filter.reset")}
          </button>
        )}
      </div>
      {hasSamples && (
        <p className="flex gap-2 rounded-xl bg-[var(--color-accent-soft)] px-3 py-2.5 text-xs leading-relaxed" data-testid="sample-banner">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-accent-strong)]" />
          {t("sample.banner")}
        </p>
      )}
      {filtered.length === 0 ? (
        <EmptyState
          title={t("results.empty")}
          hint={t("results.emptyHint")}
          action={
            <button type="button" onClick={resetFilters} className="btn btn-outline">
              {t("filter.reset")}
            </button>
          }
        />
      ) : (
        <PlaceList places={filtered} categories={data.categories} selectedId={effectiveSelectedId} onSelect={selectPlace} />
      )}
    </div>
  );

  const routesBrowse = (
    <RouteExplorer
      routes={data.routes}
      themes={data.themes}
      categories={data.categories}
      placesById={placesById}
      activeRouteId={routeId}
      selectedPlaceId={effectiveSelectedId}
      routingEnabled={routingEnabled}
      mode={mode}
      loadState={loadState}
      onSelectRoute={selectRoute}
      onBack={backToRoutes}
      onSelectPlace={selectPlace}
      onShare={() => openShare("route")}
      onMode={changeMode}
      onLoadTimes={loadTimes}
    />
  );

  // 상세가 열려도 목록은 숨기기만 해서(상태·스크롤 유지) 돌아왔을 때 이어서 탐색할 수 있습니다.
  const panelBody = (
    <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {detail}
      <div hidden={Boolean(selectedPlace)}>{tab === "places" ? placesBrowse : routesBrowse}</div>
    </div>
  );

  const mapNode = (
    <ErrorBoundary
      fallback={(reset) => (
        <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-[var(--color-muted)]">{t("map.loadFailed")}</p>
          <button type="button" onClick={reset} className="btn btn-accent">
            {t("map.retry")}
          </button>
        </div>
      )}
    >
      <MapView
        places={mapPlaces}
        categories={data.categories}
        routeStops={routeStops}
        routeGeometry={routeGeometry}
        selectedId={effectiveSelectedId}
        userLocation={userLocation}
        focusSeq={focusSeq}
        fitSeq={fitSeq}
        command={command}
        bottomInsetRatio={isDesktop ? 0 : sheetInset / Math.max(mainHeight, 1)}
        styleUrl={siteConfig.map.styleUrl}
        initialCenter={siteConfig.region.center}
        initialZoom={siteConfig.region.zoom}
        labels={mapLabels}
        onSelectPlace={selectPlace}
      />
    </ErrorBoundary>
  );

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader tab={tab} desktop={isDesktop} wide={isWide} query={query} onQuery={changeQuery} onTab={changeTab} onShare={() => openShare()} />

      <div className="relative flex min-h-0 flex-1">
        {isDesktop && (
          <aside
            aria-label={t("app.region")}
            data-testid="side-panel"
            className="z-10 flex w-[22rem] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-paper)] lg:w-[26rem] 2xl:w-[30rem]"
          >
            {tab === "places" && !selectedPlace && (
              <div className="shrink-0 space-y-2 px-4 pb-1 pt-3">
                {!isWide && <SearchBar value={query} onChange={changeQuery} />}
                <CategoryFilters categories={data.categories} value={category} onChange={changeCategory} />
              </div>
            )}
            <div id="panel-content" className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
              {panelBody}
            </div>
          </aside>
        )}

        <main
          id="main-content"
          ref={mainRef}
          aria-label={t("map.label")}
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{ ["--sheet-inset" as string]: `${sheetInset}px` }}
        >
          {mapNode}

          {/* 모바일: 지도 위 검색 바 + 테마 칩 */}
          {!isDesktop && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-1 p-3">
              <SearchBar value={query} onChange={changeQuery} enableShortcut={false} className="pointer-events-auto" />
              {tab === "places" && <CategoryFilters categories={data.categories} value={category} onChange={changeCategory} floating className="pointer-events-auto -mx-3 px-3" />}
            </div>
          )}

          {/* 지도 컨트롤: 모바일에서는 바텀시트 위로 따라 올라갑니다 */}
          <div
            className="absolute right-3 z-10 transition-[bottom] duration-200"
            style={{ bottom: isDesktop ? "2.5rem" : `calc(${sheetInset}px + 2.5rem)` }}
            data-testid="map-controls"
          >
            <MapControls
              locating={geo === "loading"}
              onLocate={locate}
              onZoomIn={() => zoom("zoomIn")}
              onZoomOut={() => zoom("zoomOut")}
              onReset={bumpFit}
            />
          </div>

          {!isDesktop && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 flex justify-center transition-[bottom] duration-200"
              style={{ bottom: `calc(${sheetInset}px + 2.5rem)` }}
            >
              <ListToggle showingList={sheet !== "collapsed"} onToggle={() => setSheet((s) => (s === "collapsed" ? "half" : "collapsed"))} />
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 top-[7.5rem] z-30 flex justify-center px-3 md:top-4">
            <Toast toast={toast} onDismiss={dismissToast} />
          </div>

          {!online && (
            <p role="status" data-testid="offline-banner" className="absolute left-1/2 top-[7.5rem] z-20 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-white md:top-4">
              {t("net.offline")}
            </p>
          )}

          {!isDesktop && (
            <MobileBottomSheet
              state={sheet}
              onState={setSheet}
              containerHeight={mainHeight}
              dragHeight={dragHeight}
              onDragHeight={setDragHeight}
              label={t("app.region")}
              tabs={<TabNav tab={tab} onTab={changeTab} className="justify-center" />}
            >
              {panelBody}
            </MobileBottomSheet>
          )}
        </main>
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        routeId={routeId}
        placeId={effectiveSelectedId}
        scope={shareScope}
        onScope={setShareScope}
        brand={siteConfig.brand.name}
        titles={shareTitles}
      />
    </div>
  );
}
