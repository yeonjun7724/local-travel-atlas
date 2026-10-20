"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Clock, ExternalLink, Info, MapPin, Navigation, Route as RouteIcon, Share2 } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { PlaceVisual } from "@/components/common/PlaceVisual";
import { localizeLabel, localizePlace, localizeRoute } from "@/lib/i18n";
import { directionsUrl } from "@/lib/share";
import type { Category, Place, Route } from "@/lib/validation/schemas";

interface Props {
  place: Place;
  category?: Category;
  /** 이 장소가 포함된 코스들 */
  routes: Route[];
  /** 현재 선택된 코스 안에서의 순서(있으면 표시) */
  orderInActiveRoute?: number;
  activeRoute?: Route | null;
  onBack: () => void;
  onShare: () => void;
  onFocusMap: () => void;
  onOpenRoute: (routeId: string) => void;
}

/** 장소 상세. 지도 마커를 눌러도 목록 카드를 눌러도 같은 컴포넌트가 열립니다. */
export function PlaceDetailPanel({ place, category, routes, orderInActiveRoute, activeRoute, onBack, onShare, onFocusMap, onOpenRoute }: Props) {
  const { t, lang } = useI18n();
  const { name, description, fellBack } = localizePlace(place, lang);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const color = category?.color ?? "#566260";

  // 키보드·스크린 리더 사용자를 위해 열릴 때 제목으로 포커스를 옮깁니다.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [place.id]);

  return (
    <article className="rise-in space-y-5 pb-6" data-testid={`place-detail-${place.id}`} aria-labelledby="place-detail-title">
      <button type="button" onClick={onBack} data-testid="detail-back" className="btn btn-ghost -ml-2 !min-h-10 !px-3">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {activeRoute ? t("route.fromRoute", { title: localizeRoute(activeRoute, lang).title }) : t("place.back")}
      </button>

      <PlaceVisual place={place} category={category} alt={name} variant="hero" noImageLabel={t("place.noImage")} />

      <header className="space-y-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color }}>
          <CategoryIcon name={category?.icon} className="size-4" />
          {category ? localizeLabel(category, lang) : place.category}
          {place.isSample && (
            <span className="rounded-full bg-[var(--color-sand)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-muted)]">{t("place.sampleBadge")}</span>
          )}
          {orderInActiveRoute && (
            <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-strong)]" data-testid="detail-route-order">
              {t("place.routeOrder", { n: orderInActiveRoute })}
            </span>
          )}
        </p>
        <h2 id="place-detail-title" ref={headingRef} tabIndex={-1} className="font-[family-name:var(--font-display)] text-[1.625rem] font-bold leading-tight outline-none focus-visible:outline-none">
          {name}
        </h2>
      </header>

      <section aria-label={t("place.about")} className="space-y-2">
        <p className="leading-relaxed">{description}</p>
        {fellBack && <p className="text-xs text-[var(--color-muted)]">{t("place.noTranslation")}</p>}
        {place.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("place.tags")}>
            {place.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-[var(--color-sand)] px-3 py-1 text-sm">
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="space-y-3 rounded-[var(--radius-card)] bg-[var(--color-sand)] p-4 text-sm" aria-label={t("place.info")}>
        <li className="flex gap-3">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-muted)]" />
          <span>
            <span className="sr-only">{t("place.address")}: </span>
            {place.address}
          </span>
        </li>
        {place.openingHours && (
          <li className="flex gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-muted)]" />
            <span>
              <span className="sr-only">{t("place.hours")}: </span>
              {place.openingHours}
              {place.recommendedDurationMinutes ? ` · ${t("place.duration", { n: place.recommendedDurationMinutes })}` : ""}
            </span>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onFocusMap} className="btn btn-primary" data-testid="detail-focus">
          <MapPin aria-hidden="true" className="size-4" /> {t("place.focus")}
        </button>
        <a href={directionsUrl(place.latitude, place.longitude)} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
          <Navigation aria-hidden="true" className="size-4" /> {t("place.directions")}
        </a>
        <button type="button" onClick={onShare} className="btn btn-outline" data-testid="share-place">
          <Share2 aria-hidden="true" className="size-4" /> {t("place.share")}
        </button>
        {place.externalUrl && (
          <a href={place.externalUrl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-outline">
            <ExternalLink aria-hidden="true" className="size-4" /> {t("place.website")}
          </a>
        )}
      </div>

      {routes.length > 0 && (
        <section aria-labelledby="place-routes-title" className="space-y-2" data-testid="detail-routes">
          <h3 id="place-routes-title" className="flex items-center gap-2 text-sm font-semibold text-[var(--color-muted)]">
            <RouteIcon aria-hidden="true" className="size-4" /> {t("place.inRoutes")}
          </h3>
          <ul className="space-y-2">
            {routes.map((r) => (
              <li key={r.routeId}>
                <button
                  type="button"
                  onClick={() => onOpenRoute(r.routeId)}
                  data-testid={`detail-route-${r.routeId}`}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-primary)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{localizeRoute(r, lang).title}</span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {t("place.routeOrder", { n: r.placeIds.indexOf(place.id) + 1 })} · {t("route.stopCount", { n: r.placeIds.length })}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-primary)]">{t("route.open")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="space-y-1 text-xs leading-relaxed text-[var(--color-muted)]">
        {place.isSample && (
          <p className="flex gap-1.5 text-[var(--color-accent-strong)]">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> {t("place.sampleNote")}
          </p>
        )}
        <p>
          {t("place.source")}: {place.source} · {place.license}
          {place.updatedAt ? ` · ${t("place.updated", { d: place.updatedAt })}` : ""}
        </p>
      </footer>
    </article>
  );
}
