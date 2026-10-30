"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpDown, Heart, RefreshCw, Share2, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/components/common/I18nProvider";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { SearchBar } from "@/components/common/SearchBar";
import { ShareDialog, type ShareScope } from "@/components/common/ShareDialog";
import { Toast, type ToastMessage } from "@/components/common/Toast";
import { MobileBottomSheet, sheetSnaps, type SheetState } from "@/components/layout/MobileBottomSheet";
import { BrandMark, TabNav, type Tab } from "@/components/layout/SiteHeader";
import { ListToggle, MapControls } from "@/components/map/MapControls";
import type { MapCommand } from "@/components/map/MapView";
import { CategoryFilters } from "@/components/places/CategoryFilters";
import { PlaceDetailPanel } from "@/components/places/PlaceDetailPanel";
import { PlaceList } from "@/components/places/PlaceList";
import { MyRoutePanel, type WalkState } from "@/components/routes/MyRoutePanel";
import { RouteExplorer, type RouteLoadState } from "@/components/routes/RouteExplorer";
import { filterPlaces, sortPlaces, subtypeCounts, type SortKey } from "@/lib/data/filter";
import { fetchPlacesByIds, fetchSearchExtent, useRemoteView, type RemoteQuery } from "@/lib/data/remote-client";
import { useFavorites } from "@/lib/favorites";
import { bboxCenter, bboxChanged, haversineMeters, inBBox, nearestNeighborOrder, type BBox, type LngLat } from "@/lib/geo";
import { useIsDesktop } from "@/lib/hooks";
import { localizePlace, localizeRoute } from "@/lib/i18n";
import { MY_ROUTE_ID, MY_ROUTE_MAX, useMyRoute } from "@/lib/my-route";
import type { WalkResult } from "@/lib/routing/osrm";
import type { RouteResult, TransportMode } from "@/lib/routing/ors";
import { buildShareUrl, parseShareParams } from "@/lib/share";
import type { AtlasData, Place } from "@/lib/validation/schemas";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--color-sand)]" aria-hidden="true" />,
});

const PAGE_SIZE = 30;

/** 적용 중인 조건 태그 (누르면 해제) */
function FilterTag({ label, onRemove, testId }: { label: string; onRemove: () => void; testId: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onRemove}
      data-testid={testId}
      aria-label={t("filter.remove", { name: label })}
      className="inline-flex h-8 items-center gap-1 rounded-full bg-[var(--color-ink)] pl-3 pr-2 text-xs font-semibold text-white transition-colors hover:bg-black"
    >
      {label}
      <X aria-hidden="true" className="size-3.5" />
    </button>
  );
}

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

/** 전국 모드에서 '전체 보기' 버튼이 맞출 대한민국 범위 */
const KOREA_BBOX: BBox = [125.9, 33.1, 129.6, 38.6];

export default function AtlasApp({ data, routingEnabled, remote = false }: { data: AtlasData; routingEnabled: boolean; remote?: boolean }) {
  const { t, lang } = useI18n();
  const isDesktop = useIsDesktop();
  const online = useOnline();
  const { favorites, isFavorite, toggle: toggleFavorite } = useFavorites();
  const myRoute = useMyRoute();

  const [tab, setTab] = useState<Tab>("places");
  const [category, setCategory] = useState<string | null>(null);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("distance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [focusSeq, setFocusSeq] = useState(0);
  const [fitSeq, setFitSeq] = useState(0);
  const [command, setCommand] = useState<MapCommand>(null);
  const [sheet, setSheet] = useState<SheetState>("half");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [mainHeight, setMainHeight] = useState(700);
  const [viewBounds, setViewBounds] = useState<BBox | null>(null);
  /** 지도가 처음 준비됐을 때의 화면 영역 → "현재 지도에서 찾은 장소"의 기본 기준 */
  const [initialArea, setInitialArea] = useState<BBox | null>(null);
  /** 사용자가 정한 목록 영역. undefined = 아직 안 정함(처음 영역 사용), null = 전체 결과 */
  const [customArea, setCustomArea] = useState<BBox | null | undefined>(undefined);
  const [page, setPage] = useState({ key: "", n: PAGE_SIZE });
  /** 검색·필터 결과에 지도를 맞춘 직후의 화면(영역 조건이 없을 때 '다시 찾기' 버튼 기준) */
  const [fittedView, setFittedView] = useState<BBox | null>(null);
  const fitPendingRef = useRef(false);
  /** 같은 좌표에 겹친 장소들(클러스터를 끝까지 확대해도 나뉘지 않을 때) — 목록을 이 장소들로 한정 */
  const [stackIds, setStackIds] = useState<string[] | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareScope, setShareScope] = useState<ShareScope>("map");
  const [mode, setMode] = useState<TransportMode>("walking");
  const [loadState, setLoadState] = useState<RouteLoadState>({ status: "idle" });
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const [viewZoom, setViewZoom] = useState(siteConfig.region.zoom);
  /** 범위 맞춤 대상 — 동네 모드 null(장소 목록 기준), 전국 모드 false(이동 안 함) 또는 검색 결과 범위 */
  const [fitTarget, setFitTarget] = useState<BBox | false | null>(remote ? false : null);
  /** 브라우저가 지금까지 받은 장소(전국 모드는 서버에서 조금씩 받아 옵니다) */
  const [fetched, setFetched] = useState<Map<string, Place>>(() => new Map());
  const [walk, setWalk] = useState<{ key: string; state: WalkState }>({ key: "", state: { status: "idle" } });
  const requestRef = useRef(0);
  const mainRef = useRef<HTMLElement>(null);

  // ── 파생 데이터 ────────────────────────────────────────────────────────────
  const isMyRoute = routeId === MY_ROUTE_ID;
  const areaBounds: BBox | null = remote ? null : customArea === undefined ? initialArea : customArea;
  const placesById = useMemo(() => {
    const m = new Map(data.places.map((p) => [p.id, p]));
    fetched.forEach((p, id) => m.set(id, p));
    return m;
  }, [data.places, fetched]);
  const remember = useCallback((ps: Place[]) => {
    setFetched((cur) => {
      if (ps.every((p) => cur.has(p.id))) return cur;
      const next = new Map(cur);
      for (const p of ps) next.set(p.id, p);
      return next;
    });
  }, []);
  const catById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const activeRoute = useMemo(() => data.routes.find((r) => r.routeId === routeId) ?? null, [data.routes, routeId]);
  const myStopPlaces = useMemo(() => myRoute.stops.map((id) => placesById.get(id)).filter((p): p is Place => Boolean(p)), [myRoute.stops, placesById]);
  const routeStops = useMemo(
    () =>
      isMyRoute
        ? myStopPlaces
        : activeRoute
          ? activeRoute.placeIds.map((id) => placesById.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))
          : null,
    [isMyRoute, myStopPlaces, activeRoute, placesById],
  );
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  // 전국 모드: 지도 화면 범위를 서버에 물어봅니다(찜 보기·추천 코스 보기 중에는 요청하지 않음)
  const remoteQuery: RemoteQuery | null =
    remote && viewBounds && !favOnly && (tab === "places" || isMyRoute)
      ? { bbox: viewBounds, zoom: viewZoom, center: bboxCenter(viewBounds), category, subtype, q: query, limit: 100 }
      : null;
  // 받은 장소는 기억해 두어, 지도를 옮겨도 열어 둔 상세·내 코스가 유지되게 합니다
  const remoteView = useRemoteView(remoteQuery, (v) => remember([...(v.points ?? []), ...v.list]));
  const rv = remoteView.data;
  // 찜·내 코스·공유 링크로 들어온 장소 중 아직 모르는 것은 id 로 받아 옵니다
  const missingIds = useMemo(
    () => (remote ? [...new Set([...myRoute.stops, ...(favOnly ? favorites : []), ...(selectedId ? [selectedId] : [])])].filter((id) => !placesById.has(id)) : []),
    [remote, myRoute.stops, favOnly, favorites, selectedId, placesById],
  );
  useEffect(() => {
    if (!missingIds.length) return;
    let alive = true;
    fetchPlacesByIds(missingIds.slice(0, 200)).then((ps) => alive && remember(ps));
    return () => {
      alive = false;
    };
  }, [missingIds, remember]);

  const filtered = useMemo(() => {
    if (!remote) return filterPlaces(data.places, { category, query, subtype, favoriteIds: favOnly ? favoriteSet : null });
    if (favOnly) return filterPlaces(favorites.map((id) => placesById.get(id)).filter((p): p is Place => Boolean(p)), { category, query, subtype });
    return rv?.points ?? [];
  }, [remote, data.places, category, query, subtype, favOnly, favoriteSet, favorites, placesById, rv]);
  const serverClusters = remote && !favOnly ? (rv?.clusters ?? null) : null;
  const subtypes = useMemo(
    () => (remote ? (rv?.subtypes ?? []) : category ? subtypeCounts(data.places.filter((p) => p.category === category), 8) : []),
    [remote, rv, data.places, category],
  );
  const mapPlaces = routeStops && !isMyRoute ? routeStops : tab === "places" || isMyRoute ? filtered : data.places;
  // 선택은 지도에 실제로 그려지는(또는 목록에 있는) 장소 안에서만 유효(추천 코스 보기 중이면 그 코스의 방문지)
  const effectiveSelectedId =
    selectedId && (routeStops && !isMyRoute ? routeStops.some((p) => p.id === selectedId) : remote || isMyRoute ? placesById.has(selectedId) : mapPlaces.some((p) => p.id === selectedId))
      ? selectedId
      : null;
  const selectedPlace = effectiveSelectedId ? (placesById.get(effectiveSelectedId) ?? null) : null;
  // 지도에 넘길 장소: 선택한 장소가 화면 목록에 없으면(전국 모드 클러스터 상태 등) 덧붙여 항상 보이게
  const mapPoints = useMemo(() => {
    const base = tab === "places" || isMyRoute ? filtered : data.places;
    return selectedPlace && !base.some((p) => p.id === selectedPlace.id) ? [...base, selectedPlace] : base;
  }, [tab, isMyRoute, filtered, data.places, selectedPlace]);

  // 거리 기준점: 내 위치 → 목록 영역 중심 → 현재 지도 중심 → 설정의 기본 중심
  const origin: LngLat = useMemo(
    () =>
      userLocation
        ? [userLocation.lng, userLocation.lat]
        : areaBounds
          ? bboxCenter(areaBounds)
          : viewBounds
            ? bboxCenter(viewBounds)
            : siteConfig.region.center,
    [userLocation, areaBounds, viewBounds],
  );
  const inArea = useMemo(() => {
    if (stackIds) {
      const set = new Set(stackIds);
      return filtered.filter((p) => set.has(p.id));
    }
    // 전국 모드: 서버가 화면 중심에서 가까운 순으로 보낸 목록
    if (remote && !favOnly) return rv?.list ?? [];
    return areaBounds ? filtered.filter((p) => inBBox([p.longitude, p.latitude], areaBounds)) : filtered;
  }, [filtered, areaBounds, stackIds, remote, favOnly, rv]);
  const listed = useMemo(() => sortPlaces(inArea, sortKey, origin, lang), [inArea, sortKey, origin, lang]);
  /** 결과 개수: 전국 모드는 화면 안 전체 개수(목록은 그중 가까운 100곳) */
  const resultTotal = remote && !favOnly && !stackIds ? (rv?.total ?? 0) : listed.length;
  const listKey = `${category}|${subtype}|${favOnly}|${query}|${sortKey}|${areaBounds?.join(",")}|${stackIds?.join(",")}`;
  const shownN = page.key === listKey ? page.n : PAGE_SIZE;
  const hasFilter = category !== null || subtype !== null || favOnly || query.trim() !== "";
  const showAreaButton =
    !remote &&
    tab === "places" &&
    !routeId &&
    !stackIds &&
    viewBounds !== null &&
    bboxChanged(areaBounds ?? fittedView ?? viewBounds, viewBounds);

  /** 지도 범위 맞춤. 전국 모드는 target(검색 결과 범위 등)이 없으면 화면을 그대로 둡니다. */
  const bumpFit = useCallback(
    (target?: BBox) => {
      fitPendingRef.current = true; // 다음 지도 이동 완료 화면을 '맞춘 화면'으로 기록
      setFitTarget(remote ? (target ?? false) : null);
      setFitSeq((n) => n + 1);
    },
    [remote],
  );
  const bumpFocus = useCallback(() => setFocusSeq((n) => n + 1), []);
  const showToast = useCallback((kind: ToastMessage["kind"], text: string) => setToast({ id: Date.now(), kind, text }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  // ── 레이아웃 측정 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setMainHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDesktop]);
  const snaps = sheetSnaps(mainHeight);
  const sheetHeight = dragHeight ?? snaps[sheet];
  const sheetInset = isDesktop ? 0 : Math.min(sheetHeight, snaps.half);

  // ── 네트워크 상태 알림 ──────────────────────────────────────────────────────
  const onlineRef = useRef(online);
  useEffect(() => {
    if (onlineRef.current === online) return;
    onlineRef.current = online;
    showToast(online ? "success" : "error", t(online ? "net.online" : "net.offline"));
  }, [online, showToast, t]);

  // ── 공유 링크 복원 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const parsed = parseShareParams(window.location.search, remote ? null : new Set(data.places.map((p) => p.id)), new Set(data.routes.map((r) => r.routeId)));
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 URL 은 마운트 후에만 읽을 수 있습니다 */
    if (parsed.routeId === MY_ROUTE_ID && parsed.stops) {
      // 공유받은 내 코스로 교체 (링크를 연 의도가 그 코스를 보는 것이므로 기존 내 코스를 덮어씀)
      myRoute.replace(parsed.stops);
      setTab("routes");
      setRouteId(MY_ROUTE_ID);
    } else if (parsed.routeId) {
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
    // 첫 진입 시 1회만 읽습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.places, data.routes]);

  useEffect(() => {
    if (!urlReady) return;
    const u = new URL(
      buildShareUrl(window.location.href, {
        routeId: routeId ?? undefined,
        placeId: effectiveSelectedId ?? undefined,
        stops: isMyRoute ? myRoute.stops : undefined,
      }),
    );
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [urlReady, routeId, effectiveSelectedId, isMyRoute, myRoute.stops]);

  // ── 내 코스: 방문지가 바뀌면 실제 도보 경로(OSRM)를 다시 계산 ─────────────────
  const walkKey = isMyRoute && myRoute.stops.length > 1 ? myRoute.stops.join(",") : "";
  useEffect(() => {
    if (!walkKey) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/walk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeIds: walkKey.split(",") }),
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => null);
        if (res.ok) return setWalk({ key: walkKey, state: { status: "ok", data: body as WalkResult } });
        const code = res.status === 503 ? "not_configured" : res.status === 422 ? "no_route" : "failed";
        setWalk({ key: walkKey, state: { status: "error", code } });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setWalk({ key: walkKey, state: { status: "error", code: "failed" } });
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [walkKey]);
  const walkState: WalkState = walk.key === walkKey ? walk.state : walkKey ? { status: "loading" } : { status: "idle" };
  const myWalk = walkState.status === "ok" ? walkState.data : null;

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
    if (id) {
      window.requestAnimationFrame(() => {
        const card = document.getElementById(`place-card-${id}`);
        card?.scrollIntoView({ block: "center" });
        card?.focus({ preventScroll: true });
      });
    }
  }, [effectiveSelectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || shareOpen || !selectedPlace) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen, selectedPlace, closeDetail]);

  const onStackPick = useCallback(
    (ids: string[]) => {
      setStackIds(ids);
      setSelectedId(null);
      setTab("places");
      setSheet((s) => (s === "collapsed" ? "half" : s));
      document.getElementById("panel-content")?.scrollTo({ top: 0 });
    },
    [],
  );

  const onViewChange = useCallback((b: BBox, z: number) => {
    setViewBounds(b);
    setViewZoom(z);
    if (fitPendingRef.current) {
      fitPendingRef.current = false;
      setFittedView(b);
    }
    setInitialArea((cur) => cur ?? b);
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    setStackIds(null);
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
  const openMyRoute = () => {
    setTab("routes");
    setRouteId(MY_ROUTE_ID);
    setSelectedId(null);
    setStackIds(null);
    setLoadState({ status: "idle" });
    openSheetIfCollapsed();
    if (myRoute.stops.length) bumpFit();
  };
  const toggleMyRoute = (id: string) => {
    if (myRoute.has(id)) return myRoute.remove(id);
    if (myRoute.stops.length >= MY_ROUTE_MAX) return showToast("error", t("my.full", { n: MY_ROUTE_MAX }));
    myRoute.add(id);
    showToast("success", t("my.added", { n: myRoute.stops.length + 1 }));
  };
  const optimizeMyRoute = () => {
    const order = nearestNeighborOrder(myStopPlaces.map((p) => [p.longitude, p.latitude] as LngLat));
    myRoute.replace(order.map((i) => myStopPlaces[i].id));
  };
  const backToRoutes = () => {
    setRouteId(null);
    setSelectedId(null);
    setLoadState({ status: "idle" });
    bumpFit();
  };
  /** 검색·필터는 항상 "장소 탐색" 흐름에서 전체 지역을 대상으로 동작하고, 결과에 지도를 맞춥니다. */
  const applyFilterChange = () => {
    if (tab !== "places" || routeId || selectedId) {
      setTab("places");
      setRouteId(null);
      setSelectedId(null);
      setLoadState({ status: "idle" });
    }
    setCustomArea(null);
    setStackIds(null);
    openSheetIfCollapsed();
    bumpFit();
  };
  const changeCategory = (id: string | null) => {
    setCategory(id);
    setSubtype(null);
    applyFilterChange();
  };
  const changeSubtype = (s: string | null) => {
    setSubtype(s);
    applyFilterChange();
  };
  const changeQuery = (q: string) => {
    setQuery(q);
    applyFilterChange();
  };
  // 전국 모드 검색: 입력이 멈추면 전국에서 일치하는 장소의 범위로 지도를 옮깁니다(이후 목록은 화면 기준)
  useEffect(() => {
    const q = query.trim();
    if (!remote || !q) return;
    let alive = true;
    const timer = window.setTimeout(async () => {
      const r = await fetchSearchExtent(q, category, subtype);
      if (!alive || !r) return;
      if (r.total === 0) showToast("error", t("results.empty"));
      else if (r.bbox) bumpFit(r.bbox);
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // 검색어가 바뀔 때만 이동합니다(카테고리 변경으로 지도가 튀지 않도록).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, query]);
  const toggleFavOnly = () => {
    setFavOnly((v) => !v);
    applyFilterChange();
  };
  const resetFilters = () => {
    setCategory(null);
    setSubtype(null);
    setFavOnly(false);
    setQuery("");
    setCustomArea(null);
    setStackIds(null);
    bumpFit();
  };
  const searchThisArea = () => {
    if (!viewBounds) return;
    setCustomArea(viewBounds);
    setStackIds(null);
    setSelectedId(null);
    openSheetIfCollapsed();
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
      if (myRequest !== requestRef.current) return;
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
    setLocating(true);
    // 사용자가 버튼을 눌렀을 때만 권한을 요청하며, 좌표는 서버로 보내거나 저장하지 않습니다.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude });
        setLocating(false);
        setSortKey("distance");
        showToast("success", t("geo.success"));
      },
      (err) => {
        setLocating(false);
        showToast("error", t(err.code === err.PERMISSION_DENIED ? "geo.denied" : err.code === err.TIMEOUT ? "geo.timeout" : "geo.unavailable"));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const zoom = (type: "zoomIn" | "zoomOut") => setCommand((c) => ({ type, seq: (c?.seq ?? 0) + 1 }));

  const nameOf = useCallback((p: AtlasData["places"][number]) => localizePlace(p, lang).name, [lang]);
  const mapLabels = useMemo(
    () => ({
      loadFailed: t("map.loadFailed"),
      retry: t("map.retry"),
      me: t("geo.me"),
      loading: t("map.loading"),
      cluster: (n: number) => t("map.cluster", { n }),
      nameOf,
    }),
    [t, nameOf],
  );

  const walkPath = routeId ? (data.routePaths?.routes[routeId] ?? null) : null;
  const routeGeometry = isMyRoute
    ? (myWalk?.geometry ?? null)
    : loadState.status === "ok" && loadState.data.mode === mode
      ? loadState.data.geometry
      : ((walkPath?.geometry as LngLat[] | undefined) ?? null);
  const routeSegments = isMyRoute && myWalk ? myWalk.segments.map((s) => s.geometry) : null;
  const shareTitles = {
    route: isMyRoute ? t("my.title") : activeRoute ? localizeRoute(activeRoute, lang).title : undefined,
    place: selectedPlace ? localizePlace(selectedPlace, lang).name : undefined,
  };

  // ── 패널 조각 ──────────────────────────────────────────────────────────────
  const placeRoutes = selectedPlace ? data.routes.filter((r) => r.placeIds.includes(selectedPlace.id)) : [];
  const detail = selectedPlace && (
    <PlaceDetailPanel
      place={selectedPlace}
      category={catById.get(selectedPlace.category)}
      routes={placeRoutes}
      activeRoute={activeRoute}
      orderInActiveRoute={activeRoute ? activeRoute.placeIds.indexOf(selectedPlace.id) + 1 || undefined : undefined}
      distanceM={userLocation ? haversineMeters([userLocation.lng, userLocation.lat], [selectedPlace.longitude, selectedPlace.latitude]) : null}
      favorite={isFavorite(selectedPlace.id)}
      onToggleFavorite={() => toggleFavorite(selectedPlace.id)}
      onBack={closeDetail}
      onShare={() => openShare("place")}
      onFocusMap={() => {
        if (!isDesktop) setSheet("collapsed");
        bumpFocus();
      }}
      onOpenRoute={selectRoute}
      myRouteOrder={myRoute.stops.indexOf(selectedPlace.id) + 1}
      onToggleMyRoute={() => toggleMyRoute(selectedPlace.id)}
    />
  );

  const browseControls = (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleFavOnly}
          aria-pressed={favOnly}
          data-testid="fav-filter"
          className={`btn !min-h-10 !px-3 border ${favOnly ? "border-[#e5484d] bg-[#fff1f1] text-[#c4292e]" : "btn-outline"}`}
        >
          <Heart aria-hidden="true" className={`size-4 ${favOnly ? "fill-[#e5484d] text-[#e5484d]" : ""}`} />
          {t("fav.filter")} {favorites.length > 0 && <span className="text-xs">{favorites.length}</span>}
        </button>
        <label className="relative ml-auto inline-flex items-center">
          <span className="sr-only">{t("sort.label")}</span>
          <ArrowUpDown aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-[var(--color-muted)]" />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            data-testid="sort-select"
            className="h-10 appearance-none rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] pl-9 pr-4 text-sm font-semibold"
          >
            <option value="distance">{t("sort.distance")}</option>
            <option value="name">{t("sort.name")}</option>
            <option value="recommended">{t("sort.recommended")}</option>
          </select>
        </label>
      </div>
      {category && subtypes.length > 1 && (
        <div role="group" aria-label={t("filter.subtype")} className="scrollbar-none -mx-px flex gap-1.5 overflow-x-auto px-px" data-testid="subtype-chips">
          {subtypes.map((s) => (
            <button
              key={s.subtype}
              type="button"
              aria-pressed={subtype === s.subtype}
              onClick={() => changeSubtype(subtype === s.subtype ? null : s.subtype)}
              className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors ${
                subtype === s.subtype ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]" : "border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-sand)]"
              }`}
            >
              {s.subtype} <span className="text-[var(--color-muted)]">{s.count}</span>
            </button>
          ))}
        </div>
      )}
      {(areaBounds || stackIds || subtype || favOnly || query) && (
        <div className="flex flex-wrap gap-1.5" data-testid="active-filters">
          {stackIds && <FilterTag label={t("stack.tag")} onRemove={() => setStackIds(null)} testId="tag-stack" />}
          {areaBounds && !stackIds && <FilterTag label={t("area.tag")} onRemove={() => setCustomArea(null)} testId="tag-area" />}
          {subtype && <FilterTag label={subtype} onRemove={() => changeSubtype(null)} testId="tag-subtype" />}
          {favOnly && <FilterTag label={t("fav.filter")} onRemove={toggleFavOnly} testId="tag-fav" />}
          {query && <FilterTag label={`“${query}”`} onRemove={() => changeQuery("")} testId="tag-query" />}
        </div>
      )}
    </div>
  );

  const placesBrowse = (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <p role="status" aria-live="polite" data-testid="result-count" className="text-sm font-bold">
          {remoteView.loading && !rv ? t("common.loading") : t(stackIds ? "results.stack" : remote && !favOnly ? "results.inView" : areaBounds ? "results.inArea" : "results.all", { n: remote ? resultTotal.toLocaleString() : resultTotal })}
        </p>
        <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          {sortKey === "distance" && <span>{t(userLocation ? "sort.fromMe" : "sort.fromCenter")}</span>}
          {(hasFilter || areaBounds) && (
            <button type="button" onClick={resetFilters} data-testid="reset-filters" className="font-semibold text-[var(--color-accent)] hover:underline">
              {t("filter.reset")}
            </button>
          )}
        </div>
      </div>
      {listed.length === 0 ? (
        <EmptyState
          title={favOnly && favorites.length === 0 ? t("fav.empty") : t("results.empty")}
          hint={t("results.emptyHint")}
          action={
            <button type="button" onClick={resetFilters} className="btn btn-outline">
              {t("filter.reset")}
            </button>
          }
        />
      ) : (
        <>
          <PlaceList
            places={listed.slice(0, shownN)}
            categories={data.categories}
            selectedId={effectiveSelectedId}
            origin={sortKey === "distance" || userLocation ? origin : null}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
            onSelect={selectPlace}
          />
          {listed.length > shownN && (
            <button type="button" onClick={() => setPage({ key: listKey, n: shownN + PAGE_SIZE })} data-testid="list-more" className="btn btn-outline w-full">
              {t("list.more", { n: Math.min(PAGE_SIZE, listed.length - shownN) })}
            </button>
          )}
        </>
      )}
      {remote && !favOnly && !stackIds && resultTotal > listed.length && (
        <p className="text-xs text-[var(--color-muted)]" data-testid="list-nearest">
          {t("results.nearest", { n: listed.length })} · {t("results.zoomHint")}
        </p>
      )}
      <p className="pt-2 text-[0.6875rem] leading-relaxed text-[var(--color-muted)]" data-testid="data-footer">
        {t(remote ? "data.footerNationwide" : "data.footer")}
      </p>
    </div>
  );

  const routesBrowse = isMyRoute ? (
    <MyRoutePanel
      stops={myStopPlaces}
      categories={data.categories}
      walk={walkState}
      selectedId={effectiveSelectedId}
      onSelectPlace={selectPlace}
      onMove={myRoute.move}
      onRemove={myRoute.remove}
      onOptimize={optimizeMyRoute}
      onClear={myRoute.clear}
      onBack={backToRoutes}
      onShare={() => openShare("route")}
    />
  ) : (
    <RouteExplorer
      myRouteCount={myRoute.stops.length}
      onOpenMyRoute={openMyRoute}
      routes={data.routes}
      themes={data.themes}
      categories={data.categories}
      placesById={placesById}
      activeRouteId={routeId}
      selectedPlaceId={effectiveSelectedId}
      routingEnabled={routingEnabled}
      mode={mode}
      loadState={loadState}
      routePaths={data.routePaths?.routes ?? null}
      walkingSpeedKmh={data.routePaths?.walkingSpeedKmh ?? null}
      onSelectRoute={selectRoute}
      onBack={backToRoutes}
      onSelectPlace={selectPlace}
      onShare={() => openShare("route")}
      onMode={changeMode}
      onLoadTimes={loadTimes}
    />
  );

  const panelBody = (
    <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {detail}
      <div hidden={Boolean(selectedPlace)}>
        {tab === "places" ? (
          <div className="space-y-4">
            {!isDesktop && browseControls}
            {placesBrowse}
          </div>
        ) : (
          routesBrowse
        )}
      </div>
    </div>
  );

  const areaButton = showAreaButton && (
    <button type="button" onClick={searchThisArea} data-testid="search-area" className="btn btn-primary pointer-events-auto !min-h-10 shadow-[var(--shadow-float)]">
      <RefreshCw aria-hidden="true" className="size-4" /> {t("area.searchHere")}
    </button>
  );

  return (
    <div className="flex h-dvh bg-[var(--color-paper)]">
      <a href="#main-content" className="sr-only rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50">
        {t("nav.skip")}
      </a>

      {isDesktop && (
        <aside
          aria-label={t("app.region")}
          data-testid="side-panel"
          className="z-10 flex w-[23rem] shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] lg:w-[26rem] 2xl:w-[28rem]"
        >
          <div className="shrink-0 px-4 pt-4">
            <div className="flex items-center justify-between gap-3">
              <BrandMark nationwide={remote} />
              <LanguageSwitcher />
            </div>
            <TabNav tab={tab} onTab={changeTab} variant="underline" className="mt-3" />
          </div>
          {tab === "places" && !selectedPlace && (
            <div className="shrink-0 space-y-2.5 border-b border-[var(--color-line)] px-4 pb-3 pt-3">
              <SearchBar value={query} onChange={changeQuery} />
              <CategoryFilters categories={data.categories} value={category} onChange={changeCategory} />
              {browseControls}
            </div>
          )}
          <div id="panel-content" className="sheet-scroll min-h-0 flex-1 overflow-y-auto bg-[var(--color-paper)] px-4 pb-6 pt-3">
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
            places={mapPoints}
            categories={data.categories}
            routeStops={routeStops}
            routeGeometry={routeGeometry}
            routeSegments={routeSegments}
            showPlacesWithRoute={isMyRoute}
            serverClusters={tab === "places" || isMyRoute ? serverClusters : null}
            fitTarget={fitTarget}
            selectedId={effectiveSelectedId}
            userLocation={userLocation}
            focusSeq={focusSeq}
            fitSeq={fitSeq}
            command={command}
            bottomInsetRatio={isDesktop ? 0 : sheetInset / Math.max(mainHeight, 1)}
            styleUrl={siteConfig.map.styleUrl}
            initialCenter={remote ? siteConfig.nationwide.center : siteConfig.region.center}
            initialZoom={remote ? siteConfig.nationwide.zoom : siteConfig.region.zoom}
            labels={mapLabels}
            onSelectPlace={selectPlace}
            onViewChange={onViewChange}
            onStackPick={onStackPick}
          />
        </ErrorBoundary>

        {/* 데스크톱: 지도 위 상단 — 이 지역 다시 찾기 + 공유 */}
        {isDesktop && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center">{areaButton}</div>
            <div className="absolute right-4 top-4 z-10">
              <button type="button" onClick={() => openShare()} data-testid="share-button" aria-label={t("header.share")} className="btn btn-accent shadow-[var(--shadow-float)]">
                <Share2 aria-hidden="true" className="size-4" />
                <span>{t("header.share")}</span>
              </button>
            </div>
          </>
        )}

        {/* 모바일: 떠 있는 헤더 카드 + 검색 + 칩 */}
        {!isDesktop && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="pointer-events-auto flex items-center gap-2 rounded-[var(--radius-card)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-float)]">
              <div className="min-w-0 flex-1">
                <BrandMark nationwide={remote} />
              </div>
              <LanguageSwitcher />
              <button type="button" onClick={() => openShare()} data-testid="share-button" aria-label={t("header.share")} className="btn btn-accent !px-3">
                <Share2 aria-hidden="true" className="size-4" />
              </button>
            </div>
            <SearchBar value={query} onChange={changeQuery} enableShortcut={false} className="pointer-events-auto" />
            {tab === "places" && <CategoryFilters categories={data.categories} value={category} onChange={changeCategory} floating className="pointer-events-auto -mx-3 px-3" />}
          </div>
        )}

        <div className="absolute right-3 z-10 transition-[bottom] duration-200" style={{ bottom: isDesktop ? "2.5rem" : `calc(${sheetInset}px + 2.5rem)` }} data-testid="map-controls">
          <MapControls locating={locating} onLocate={locate} onZoomIn={() => zoom("zoomIn")} onZoomOut={() => zoom("zoomOut")} onReset={() => bumpFit(remote && !routeStops?.length ? KOREA_BBOX : undefined)} />
        </div>

        {!isDesktop && (
          <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center gap-2 transition-[bottom] duration-200" style={{ bottom: `calc(${sheetInset}px + 2.5rem)` }}>
            {sheet === "collapsed" ? <ListToggle showingList={false} onToggle={() => setSheet("half")} /> : areaButton || <ListToggle showingList onToggle={() => setSheet("collapsed")} />}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-[12rem] z-30 flex justify-center px-3 md:top-16">
          <Toast toast={toast} onDismiss={dismissToast} />
        </div>

        {!online && (
          <p role="status" data-testid="offline-banner" className="absolute left-1/2 top-[12rem] z-20 -translate-x-1/2 rounded-full bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-white md:top-16">
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

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        routeId={routeId}
        placeId={effectiveSelectedId}
        scope={shareScope}
        onScope={setShareScope}
        brand={siteConfig.brand.name}
        titles={shareTitles}
        stops={isMyRoute ? myRoute.stops : undefined}
      />
    </div>
  );
}
