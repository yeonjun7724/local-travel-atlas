"use client";

import { Heart, MapPin } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { PlaceVisual } from "@/components/common/PlaceVisual";
import { orderColor } from "@/lib/data/geojson";
import { poiStyle } from "@/lib/data/poi-style";
import { formatDistance } from "@/lib/geo";
import { localizeLabel, localizePlace } from "@/lib/i18n";
import type { Category, Place } from "@/lib/validation/schemas";

interface Props {
  place: Place;
  category?: Category;
  /** 코스 안에서의 방문 순서(있으면 번호 배지 표시) */
  order?: number;
  active: boolean;
  /** 기준점(내 위치·지도 중심)에서의 거리(m) */
  distanceM?: number | null;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  onSelect: () => void;
}

/** 목록용 장소 카드. 누르면 장소 상세(패널/바텀시트)가 열립니다. 찜 버튼은 별도 버튼입니다. */
export function PlaceCard({ place, category, order, active, distanceM, favorite, onToggleFavorite, onSelect }: Props) {
  const { t, lang } = useI18n();
  const { name } = localizePlace(place, lang);
  const style = poiStyle(place, category); // 지도 핀과 같은 세부 업종 색·아이콘
  const color = style.color;
  const kind = place.subtype && place.subtype !== (category ? localizeLabel(category, "ko") : "") ? place.subtype : null;
  return (
    <div className="relative">
      <button
        type="button"
        id={`place-card-${place.id}`}
        data-testid={`place-item-${place.id}`}
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
        className={`group flex w-full items-center gap-3 rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-3 pr-12 text-left transition-[border-color,box-shadow,transform] hover:border-[var(--color-ink)] active:scale-[0.99] ${
          active ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]" : "border-[var(--color-line)]"
        }`}
      >
        <span className="relative shrink-0">
          <PlaceVisual place={place} category={category} alt={name} variant="thumb" noImageLabel={t("place.noImage")} />
          {order && (
            <span
              aria-hidden="true"
              className="absolute -left-1.5 -top-1.5 grid size-7 place-items-center rounded-full border-2 border-white text-sm font-bold text-white"
              style={{ background: orderColor(order - 1) }}
              data-testid="order-badge"
            >
              {order}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color }}>
            <CategoryIcon name={style.icon} className="size-3.5 shrink-0" />
            <span className="truncate">
              {category ? localizeLabel(category, lang) : place.category}
              {kind && lang === "ko" ? ` · ${kind}` : ""}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[0.9375rem] font-bold leading-snug text-[var(--color-ink)]">{name}</span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted)]">
            <MapPin aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">{place.address}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {distanceM != null && (
              <span className="font-semibold text-[var(--color-accent)]" data-testid="card-distance">
                {formatDistance(distanceM, { km: t("unit.km"), m: t("unit.m") })}
              </span>
            )}
            {place.openingHours && <span className="truncate text-[var(--color-muted)]">{place.openingHours}</span>}
          </span>
        </span>
      </button>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={favorite}
          aria-label={`${t(favorite ? "fav.remove" : "fav.add")}: ${name}`}
          data-testid={`fav-${place.id}`}
          className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full transition-colors hover:bg-[var(--color-sand)]"
        >
          <Heart aria-hidden="true" className={`size-5 ${favorite ? "fill-[#e5484d] text-[#e5484d]" : "text-[var(--color-muted)]"}`} />
        </button>
      )}
    </div>
  );
}
