"use client";

import { useI18n } from "@/components/common/I18nProvider";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { localizeLabel } from "@/lib/i18n";
import type { Category } from "@/lib/validation/schemas";

interface Props {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  /** 지도 위에 띄울 때(true)는 칩마다 그림자를 줍니다 */
  floating?: boolean;
}

/** 여행 테마 필터 칩. 가로 스크롤(스와이프)·키보드 Tab 이동 가능, 선택 상태는 aria-pressed. */
export function CategoryFilters({ categories, value, onChange, className = "", floating = false }: Props) {
  const { t, lang } = useI18n();
  const chip = (active: boolean) =>
    `inline-flex h-11 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors active:scale-[0.97] ${
      active
        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
        : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-sand)]"
    } ${floating ? "shadow-[var(--shadow-card)]" : ""}`;
  return (
    <div
      role="group"
      aria-label={t("filter.label")}
      data-testid="theme-chips"
      className={`scrollbar-none flex snap-x gap-2 overflow-x-auto px-px py-1 ${className}`}
    >
      <button type="button" aria-pressed={value === null} data-testid="chip-all" className={chip(value === null)} onClick={() => onChange(null)}>
        {t("filter.all")}
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={value === c.id}
          data-testid={`chip-${c.id}`}
          className={chip(value === c.id)}
          onClick={() => onChange(value === c.id ? null : c.id)}
        >
          <CategoryIcon name={c.icon} className="size-4" />
          {localizeLabel(c, lang)}
        </button>
      ))}
    </div>
  );
}
