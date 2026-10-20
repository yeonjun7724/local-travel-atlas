"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { PlaceVisual } from "@/components/common/PlaceVisual";
import { localizeLabel, localizePlace } from "@/lib/i18n";
import type { Category, Place } from "@/lib/validation/schemas";

interface Props {
  place: Place;
  category?: Category;
  /** 코스 안에서의 방문 순서(있으면 번호 배지 표시) */
  order?: number;
  active: boolean;
  onSelect: () => void;
}

/** 목록용 장소 카드. 누르면 장소 상세(패널/바텀시트)가 열립니다. */
export function PlaceCard({ place, category, order, active, onSelect }: Props) {
  const { t, lang } = useI18n();
  const { name, description } = localizePlace(place, lang);
  const color = category?.color ?? "#566260";
  return (
    <button
      type="button"
      id={`place-card-${place.id}`}
      data-testid={`place-item-${place.id}`}
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={`group flex w-full items-stretch gap-3 rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-3 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] hover:border-[var(--color-primary)] active:scale-[0.99] ${
        active ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]" : "border-[var(--color-line)]"
      }`}
    >
      <span className="relative shrink-0 self-start">
        <PlaceVisual place={place} category={category} alt={name} variant="thumb" noImageLabel={t("place.noImage")} />
        {order && (
          <span
            aria-hidden="true"
            className="absolute -left-1.5 -top-1.5 grid size-7 place-items-center rounded-full border-2 border-white text-sm font-bold text-white"
            style={{ background: color }}
          >
            {order}
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          <CategoryIcon name={category?.icon} className="size-3.5" />
          <span className="truncate">{category ? localizeLabel(category, lang) : place.category}</span>
          {place.isSample && (
            <span className="rounded-full bg-[var(--color-sand)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--color-muted)]">{t("place.sampleBadge")}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-base font-semibold leading-snug">{name}</span>
        <span className="line-clamp-2 text-sm leading-snug text-[var(--color-muted)]">{description}</span>
        <span className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-muted)]">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{place.address}</span>
        </span>
        {place.tags.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {place.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-[var(--color-sand)] px-2 py-0.5 text-[0.6875rem] text-[var(--color-ink)]">
                #{tag}
              </span>
            ))}
          </span>
        )}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 self-center text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
