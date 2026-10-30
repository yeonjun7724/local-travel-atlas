"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Clock, ExternalLink, Heart, MapPin, Navigation, Route as RouteIcon, Share2 } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { PlaceVisual } from "@/components/common/PlaceVisual";
import { formatDistance } from "@/lib/geo";
import { localizeLabel, localizePlace, localizeRoute } from "@/lib/i18n";
import { directionsUrl } from "@/lib/share";
import type { Category, Place, Route } from "@/lib/validation/schemas";

interface Props {
  place: Place;
  category?: Category;
  routes: Route[];
  orderInActiveRoute?: number;
  activeRoute?: Route | null;
  distanceM?: number | null;
  favorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onShare: () => void;
  onFocusMap: () => void;
  onOpenRoute: (routeId: string) => void;
}

function SourceLink({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--color-line)] underline-offset-2 hover:text-[var(--color-ink)]">
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

/** 장소 상세. 지도 핀을 눌러도 목록 카드를 눌러도 같은 컴포넌트가 열립니다. 출처·사진 저작자를 함께 표기합니다. */
export function PlaceDetailPanel(p: Props) {
  const { place, category, routes, orderInActiveRoute, activeRoute, distanceM, favorite } = p;
  const { t, lang } = useI18n();
  const { name, description, fellBack } = localizePlace(place, lang);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const color = category?.color ?? "#4e5968";

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [place.id]);

  return (
    <article className="rise-in space-y-5 pb-6" data-testid={`place-detail-${place.id}`} aria-labelledby="place-detail-title">
      <button type="button" onClick={p.onBack} data-testid="detail-back" className="btn btn-ghost -ml-2 !min-h-10 !px-3">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {activeRoute ? t("route.fromRoute", { title: localizeRoute(activeRoute, lang).title }) : t("place.back")}
      </button>

      <figure className="space-y-1.5">
        <PlaceVisual place={place} category={category} alt={name} variant="hero" noImageLabel={t("place.noImage")} />
        {place.imageUrl && place.imageCredit && (
          <figcaption className="text-[0.6875rem] text-[var(--color-muted)]" data-testid="photo-credit">
            {t("place.photoCredit")}: <SourceLink href={place.imageSourceUrl}>{place.imageCredit}</SourceLink>
          </figcaption>
        )}
      </figure>

      <header className="space-y-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold" style={{ color }}>
          <CategoryIcon name={category?.icon} className="size-4" />
          {category ? localizeLabel(category, lang) : place.category}
          {place.subtype && lang === "ko" && <span className="font-medium text-[var(--color-muted)]">· {place.subtype}</span>}
          {orderInActiveRoute && (
            <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-accent-strong)]" data-testid="detail-route-order">
              {t("place.routeOrder", { n: orderInActiveRoute })}
            </span>
          )}
        </p>
        <div className="flex items-start justify-between gap-3">
          <h2 id="place-detail-title" ref={headingRef} tabIndex={-1} className="text-[1.5rem] font-bold leading-tight tracking-tight outline-none focus-visible:outline-none">
            {name}
          </h2>
          <button
            type="button"
            onClick={p.onToggleFavorite}
            aria-pressed={favorite}
            aria-label={t(favorite ? "fav.remove" : "fav.add")}
            data-testid="detail-fav"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] transition-colors hover:bg-[var(--color-sand)]"
          >
            <Heart aria-hidden="true" className={`size-5 ${favorite ? "fill-[#e5484d] text-[#e5484d]" : "text-[var(--color-muted)]"}`} />
          </button>
        </div>
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

      <ul className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm" aria-label={t("place.info")}>
        <li className="flex gap-3">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-muted)]" />
          <span>
            <span className="sr-only">{t("place.address")}: </span>
            {place.address}
            {distanceM != null && (
              <span className="ml-1.5 font-semibold text-[var(--color-accent)]">· {t("place.distanceFrom", { d: formatDistance(distanceM, { km: t("unit.km"), m: t("unit.m") }) })}</span>
            )}
          </span>
        </li>
        {place.openingHours && (
          <li className="flex gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-muted)]" />
            <span>
              <span className="sr-only">{t("place.hours")}: </span>
              {place.openingHours}
            </span>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={p.onFocusMap} className="btn btn-primary" data-testid="detail-focus">
          <MapPin aria-hidden="true" className="size-4" /> {t("place.focus")}
        </button>
        <a href={directionsUrl(place.latitude, place.longitude)} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
          <Navigation aria-hidden="true" className="size-4" /> {t("place.directions")}
        </a>
        <button type="button" onClick={p.onShare} className="btn btn-outline" data-testid="share-place">
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
                  onClick={() => p.onOpenRoute(r.routeId)}
                  data-testid={`detail-route-${r.routeId}`}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-ink)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{localizeRoute(r, lang).title}</span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {t("place.routeOrder", { n: r.placeIds.indexOf(place.id) + 1 })} · {t("route.stopCount", { n: r.placeIds.length })}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-accent)]">{t("route.open")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="space-y-1 border-t border-[var(--color-line)] pt-3 text-xs leading-relaxed text-[var(--color-muted)]" data-testid="detail-sources">
        <p className="font-semibold">{t("data.sources")}</p>
        <p>
          {t("place.dataSource")}: <SourceLink href={place.sourceUrl}>{place.source}</SourceLink> · {place.license}
          {place.updatedAt ? ` · ${t("place.updated", { d: place.updatedAt })}` : ""}
        </p>
        {place.descriptionSource && (
          <p>
            {t("place.descSource")}: <SourceLink href={place.descriptionSourceUrl}>{place.descriptionSource}</SourceLink>
          </p>
        )}
      </footer>
    </article>
  );
}
