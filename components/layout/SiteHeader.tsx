"use client";

import { Compass, Map as MapIcon } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/components/common/I18nProvider";

export type Tab = "places" | "routes";

/** 장소 탐색 / 추천 코스 탭. 데스크톱 패널은 밑줄형, 모바일 바텀시트는 알약형 */
export function TabNav({ tab, onTab, variant = "pill", className = "" }: { tab: Tab; onTab: (t: Tab) => void; variant?: "pill" | "underline"; className?: string }) {
  const { t } = useI18n();
  const item = (id: Tab, label: string, Icon: typeof MapIcon) => {
    const on = tab === id;
    const cls =
      variant === "underline"
        ? `inline-flex h-12 flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-semibold transition-colors ${
            on ? "border-[var(--color-ink)] text-[var(--color-ink)]" : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          }`
        : `inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${
            on ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink)] hover:bg-[var(--color-sand)]"
          }`;
    return (
      <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={on} aria-controls="panel-content" data-testid={`tab-${id}`} onClick={() => onTab(id)} className={cls}>
        <Icon aria-hidden="true" className="size-4" /> {label}
      </button>
    );
  };
  return (
    <div role="tablist" aria-label={t("nav.aria")} className={`flex ${variant === "underline" ? "border-b border-[var(--color-line)]" : "gap-1"} ${className}`}>
      {item("places", t("nav.places"), MapIcon)}
      {item("routes", t("nav.routes"), Compass)}
    </div>
  );
}

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="9" fill="var(--color-ink)" />
      <path d="M16 6.5c-3.6 0-6.5 2.8-6.5 6.3 0 4.6 6.5 12.2 6.5 12.2s6.5-7.6 6.5-12.2c0-3.5-2.9-6.3-6.5-6.3Z" fill="#fff" />
      <circle cx="16" cy="12.8" r="2.6" fill="var(--color-accent)" />
    </svg>
  );
}

/** 로고 + 서비스명 + 지역명 */
export function BrandMark() {
  const { t, lang } = useI18n();
  const regionName = lang === "en" ? siteConfig.region.nameEn : siteConfig.region.nameKo;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <LogoMark />
      <div className="min-w-0">
        <p className="whitespace-nowrap text-[1.0625rem] font-extrabold leading-none tracking-tight" data-testid="brand">
          {siteConfig.brand.name}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-[var(--color-muted)]" data-testid="region-name">
          <span className="sr-only">{t("header.region")}: </span>
          {regionName}
        </p>
      </div>
    </div>
  );
}
