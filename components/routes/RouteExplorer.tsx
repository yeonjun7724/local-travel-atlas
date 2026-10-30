"use client";

import { ArrowLeft, Car, Clock, Footprints, Loader2, Plus, Route as RouteIcon, Share2 } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { PlaceCard } from "@/components/places/PlaceCard";
import { orderColor } from "@/lib/data/geojson";
import { formatDuration, type RouteResult, type TransportMode } from "@/lib/routing/ors";
import { localizeLabel, localizeRoute } from "@/lib/i18n";
import type { Category, Place, Route, RoutePath, Theme } from "@/lib/validation/schemas";

export type RouteLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: RouteResult }
  | { status: "error"; code: "not_configured" | "rate_limited" | "failed" };

interface Props {
  routes: Route[];
  themes: Theme[];
  categories: Category[];
  placesById: Map<string, Place>;
  activeRouteId: string | null;
  selectedPlaceId: string | null;
  routingEnabled: boolean;
  mode: TransportMode;
  loadState: RouteLoadState;
  /** OSMnx 로 미리 계산한 실제 도보 경로 (routeId → 경로) */
  routePaths: Record<string, RoutePath> | null;
  walkingSpeedKmh: number | null;
  onSelectRoute: (id: string) => void;
  onBack: () => void;
  onSelectPlace: (id: string) => void;
  onShare: () => void;
  onMode: (m: TransportMode) => void;
  onLoadTimes: () => void;
  /** 내 코스(사용자가 고른 장소) 개수와 열기 */
  myRouteCount: number;
  onOpenMyRoute: () => void;
}

function Duration({ seconds }: { seconds: number }) {
  const { t } = useI18n();
  const { hours, minutes } = formatDuration(seconds);
  return (
    <>
      {hours > 0 ? `${hours}${t("unit.hour")} ` : ""}
      {minutes}
      {t("unit.min")}
    </>
  );
}

function Distance({ meters }: { meters: number }) {
  const { t } = useI18n();
  return meters >= 1000 ? (
    <>
      {(meters / 1000).toFixed(1)}
      {t("unit.km")}
    </>
  ) : (
    <>
      {Math.round(meters)}
      {t("unit.m")}
    </>
  );
}

/** 코스에 포함된 장소들의 추천 체류시간 합(모든 장소에 값이 있을 때만; 이동시간 아님) */
function stayMinutes(route: Route, byId: Map<string, Place>): number | null {
  let total = 0;
  for (const id of route.placeIds) {
    const m = byId.get(id)?.recommendedDurationMinutes;
    if (!m) return null;
    total += m;
  }
  return total;
}

export function RouteExplorer(p: Props) {
  const { t, lang } = useI18n();
  const themeById = new Map(p.themes.map((x) => [x.id, x]));
  const catById = new Map(p.categories.map((c) => [c.id, c]));
  const active = p.routes.find((r) => r.routeId === p.activeRouteId) ?? null;

  if (!active) {
    return (
      <section aria-label={t("route.list")} className="space-y-3">
        <button
          type="button"
          onClick={p.onOpenMyRoute}
          data-testid="my-route-card"
          className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-4 text-left transition-colors hover:bg-[var(--color-surface)]"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-white">
            <Plus aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold">{t("my.title")}</span>
            <span className="block text-xs text-[var(--color-muted)]">{p.myRouteCount ? t("my.cardCount", { n: p.myRouteCount }) : t("my.cardEmpty")}</span>
          </span>
          <span className="text-sm font-semibold text-[var(--color-accent-strong)]">{t("route.open")}</span>
        </button>
        <ul className="space-y-3" data-testid="route-list">
          {p.routes.map((r, i) => {
            const { title, description } = localizeRoute(r, lang);
            const theme = themeById.get(r.theme);
            const stay = stayMinutes(r, p.placesById);
            const stops = r.placeIds.map((id) => p.placesById.get(id)).filter((x): x is Place => Boolean(x));
            return (
              <li key={r.routeId}>
                <button
                  type="button"
                  data-testid={`route-card-${r.routeId}`}
                  onClick={() => p.onSelectRoute(r.routeId)}
                  className="group w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow] hover:border-[var(--color-primary)] active:scale-[0.99]"
                >
                  {/* 방문 순서 미리보기: 카테고리 색 점들이 순서대로 이어짐 (실제 경로 아님) */}
                  <span className="flex items-center gap-1 bg-[var(--color-primary-soft)] px-4 py-3" role="img" aria-label={t("route.preview")}>
                    {stops.map((s, idx) => (
                      <span key={s.id} className="flex items-center gap-1">
                        <span className="size-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: catById.get(s.category)?.color ?? "#566260" }} />
                        {idx < stops.length - 1 && <span className="h-px w-3 bg-[var(--color-primary)] opacity-40" />}
                      </span>
                    ))}
                  </span>
                  <span className="block p-4">
                    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-accent-strong)]">
                      <span className="grid size-6 place-items-center rounded-full bg-[var(--color-accent-soft)]">{i + 1}</span>
                      {theme ? localizeLabel(theme, lang) : r.theme}
                    </span>
                    <span className="mt-2 block text-xl font-bold leading-snug">{title}</span>
                    <span className="mt-1.5 line-clamp-2 block text-sm leading-relaxed text-[var(--color-muted)]">{description}</span>
                    <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <RouteIcon aria-hidden="true" className="size-3.5" /> {t("route.stopCount", { n: r.placeIds.length })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {r.transportMode === "walking" ? <Footprints aria-hidden="true" className="size-3.5" /> : <Car aria-hidden="true" className="size-3.5" />}
                        {t(r.transportMode === "walking" ? "route.walking" : "route.driving")}
                      </span>
                      {p.routePaths?.[r.routeId] && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-accent)]" data-testid={`route-walk-${r.routeId}`}>
                          <Clock aria-hidden="true" className="size-3.5" />
                          {t("route.walkSummary", {
                            d: `${(p.routePaths[r.routeId].totalDistanceM / 1000).toFixed(1)}${t("unit.km")}`,
                            t: `${Math.max(1, Math.round(p.routePaths[r.routeId].totalDurationS / 60))}${t("unit.min")}`,
                          })}
                        </span>
                      )}
                      {stay !== null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock aria-hidden="true" className="size-3.5" /> {t("route.duration", { n: stay })}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const { title, description } = localizeRoute(active, lang);
  const stops = active.placeIds.map((id) => p.placesById.get(id)).filter((x): x is Place => Boolean(x));
  const real = p.loadState.status === "ok" ? p.loadState.data : null;
  const walk = p.routePaths?.[active.routeId] ?? null;
  const segments = real?.segments ?? walk?.segments ?? null;
  const stay = stayMinutes(active, p.placesById);

  return (
    <section className="rise-in space-y-4 pb-6" data-testid="route-detail" aria-labelledby="route-title">
      <div className="flex items-center justify-between">
        <button type="button" onClick={p.onBack} className="btn btn-ghost -ml-2 !min-h-10 !px-3" data-testid="route-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> {t("route.back")}
        </button>
        <button type="button" onClick={p.onShare} className="btn btn-ghost !min-h-10 !px-3" data-testid="share-route">
          <Share2 aria-hidden="true" className="size-4" /> {t("header.share")}
        </button>
      </div>

      <div>
        <h2 id="route-title" className="text-[1.625rem] font-bold leading-tight" data-testid="route-title">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-[var(--color-muted)]">
          <span>{t("route.stopCount", { n: stops.length })}</span>
          {stay !== null && <span>{t("route.duration", { n: stay })}</span>}
        </p>
      </div>

      {/* 기본 모드(직선) vs 확장 모드(실제 경로)를 명확히 구분해서 안내합니다 */}
      {!real && walk && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4" data-testid="walk-summary">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)]">
            <Footprints aria-hidden="true" className="size-4" /> {t("route.realPath")}
          </p>
          <p className="mt-1 text-lg font-bold">
            {t("route.walkSummary", {
              d: `${(walk.totalDistanceM / 1000).toFixed(1)}${t("unit.km")}`,
              t: `${Math.max(1, Math.round(walk.totalDurationS / 60))}${t("unit.min")}`,
            })}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">{t("route.realPathNotice", { kmh: p.walkingSpeedKmh ?? 4.5 })}</p>
        </div>
      )}
      {!real && !walk && (
        <p className="rounded-xl bg-[var(--color-accent-soft)] px-3 py-2.5 text-xs leading-relaxed" data-testid="straight-notice">
          {t("route.straightNotice")}
        </p>
      )}

      {p.routingEnabled ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--color-muted)]">{t("route.optionalDriving")}</p>
          <div role="group" aria-label={t("route.mode")} className="flex gap-2">
            {(["walking", "driving"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={p.mode === m}
                onClick={() => p.onMode(m)}
                className={`btn flex-1 border ${p.mode === m ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "btn-outline"}`}
              >
                {m === "walking" ? <Footprints aria-hidden="true" className="size-4" /> : <Car aria-hidden="true" className="size-4" />}
                {t(m === "walking" ? "route.walking" : "route.driving")}
              </button>
            ))}
          </div>
          <button type="button" onClick={p.onLoadTimes} disabled={p.loadState.status === "loading"} data-testid="load-times" className="btn btn-accent w-full">
            {p.loadState.status === "loading" && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {p.loadState.status === "loading" ? t("route.loading") : t("route.loadTime")}
          </button>
          {p.loadState.status === "loading" && (
            <div className="space-y-2" aria-hidden="true">
              <div className="skeleton h-12 w-full" />
            </div>
          )}
        </div>
      ) : (
        !walk && (
          <p className="text-xs leading-relaxed text-[var(--color-muted)]" data-testid="routing-disabled">
            {t("route.notConfigured")}
          </p>
        )
      )}

      {p.loadState.status === "error" && p.loadState.code !== "not_configured" && (
        <p role="alert" className="rounded-xl bg-[var(--color-danger-soft)] px-3 py-2.5 text-sm text-[var(--color-danger)]" data-testid="route-error">
          {p.loadState.code === "rate_limited" ? t("route.rateLimited") : t("route.failed")}
        </p>
      )}
      {p.loadState.status === "error" && p.loadState.code === "not_configured" && (
        <p role="status" className="rounded-xl bg-[var(--color-sand)] px-3 py-2.5 text-sm" data-testid="route-error">
          {t("route.notConfigured")}
        </p>
      )}

      {real && (
        <div className="rounded-xl bg-[var(--color-primary-soft)] p-3 text-sm" data-testid="route-summary">
          <div className="flex justify-between gap-2 font-semibold">
            <span>
              {t("route.totalDistance")}: <Distance meters={real.totalDistanceM} />
            </span>
            <span>
              {t("route.totalTime")}: <Duration seconds={real.totalDurationS} />
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{t("route.realNotice", { mode: t(real.mode === "walking" ? "route.walking" : "route.driving") })}</p>
        </div>
      )}

      <h3 className="text-sm font-semibold text-[var(--color-muted)]">{t("route.stops")}</h3>
      <ol className="space-y-2" data-testid="route-stops">
        {stops.map((s, i) => (
          <li key={s.id} className="space-y-1.5">
            <PlaceCard place={s} category={catById.get(s.category)} order={i + 1} active={s.id === p.selectedPlaceId} onSelect={() => p.onSelectPlace(s.id)} />
            {segments && segments[i] && (
              <p className="ml-6 flex items-center gap-1.5 border-l-[3px] py-1.5 pl-4 text-xs text-[var(--color-muted)]" style={{ borderColor: orderColor(i) }} data-testid={`segment-${i}`}>
                <Footprints aria-hidden="true" className="size-3.5" style={{ color: orderColor(i) }} />
                {t("route.segment", { a: i + 1, b: i + 2 })} · <Distance meters={segments[i].distanceM} /> · <Duration seconds={segments[i].durationS} />
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
