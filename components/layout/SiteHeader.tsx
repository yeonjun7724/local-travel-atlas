"use client";

import { Compass, Map as MapIcon, Share2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useI18n } from "@/components/common/I18nProvider";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { SearchBar } from "@/components/common/SearchBar";

export type Tab = "places" | "routes";

export function TabNav({ tab, onTab, className = "" }: { tab: Tab; onTab: (t: Tab) => void; className?: string }) {
  const { t } = useI18n();
  const item = (id: Tab, label: string, Icon: typeof MapIcon) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={tab === id}
      aria-controls="panel-content"
      data-testid={`tab-${id}`}
      onClick={() => onTab(id)}
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${
        tab === id ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink)] hover:bg-[var(--color-sand)]"
      }`}
    >
      <Icon aria-hidden="true" className="size-4" /> {label}
    </button>
  );
  return (
    <div role="tablist" aria-label={t("nav.aria")} className={`flex gap-1 ${className}`}>
      {item("places", t("nav.places"), MapIcon)}
      {item("routes", t("nav.routes"), Compass)}
    </div>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
      <circle cx="16" cy="16" r="16" fill="var(--color-primary)" />
      <path d="M16 6.5c-3.6 0-6.5 2.8-6.5 6.3 0 4.6 6.5 12.2 6.5 12.2s6.5-7.6 6.5-12.2c0-3.5-2.9-6.3-6.5-6.3Z" fill="#fff" />
      <circle cx="16" cy="12.8" r="2.6" fill="var(--color-accent)" />
    </svg>
  );
}

interface Props {
  tab: Tab;
  /** 데스크톱: 헤더에 탐색 탭과 검색창을 표시 / 모바일: 탭은 바텀시트, 검색은 지도 위에 표시 */
  desktop: boolean;
  /** 헤더에 검색창을 둘 만큼 넓은 화면(lg 이상). 태블릿에서는 사이드 패널 안에 표시 */
  wide: boolean;
  query: string;
  onQuery: (q: string) => void;
  onTab: (t: Tab) => void;
  onShare: () => void;
}

export function SiteHeader({ tab, desktop, wide, query, onQuery, onTab, onShare }: Props) {
  const { t, lang } = useI18n();
  const regionName = lang === "en" ? siteConfig.region.nameEn : siteConfig.region.nameKo;
  return (
    <header className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 pt-[env(safe-area-inset-top)] lg:px-6">
      <a
        href="#main-content"
        className="sr-only rounded-full bg-[var(--color-ink)] px-4 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50"
      >
        {t("nav.skip")}
      </a>

      <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
        <LogoMark />
        <div className="min-w-0">
          <p className="whitespace-nowrap font-[family-name:var(--font-display)] text-base font-bold leading-none tracking-[0.1em] sm:tracking-[0.16em] lg:text-lg" data-testid="brand">
            {siteConfig.brand.name}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--color-muted)]" data-testid="region-name">
            <span className="sr-only">{t("header.region")}: </span>
            {regionName}
          </p>
        </div>
      </div>

      {desktop && (
        <>
          <TabNav tab={tab} onTab={onTab} className="ml-2 shrink-0" />
          {wide && (
            <div className="mx-auto w-full max-w-md">
              <SearchBar value={query} onChange={onQuery} />
            </div>
          )}
        </>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitcher />
        <button type="button" onClick={onShare} data-testid="share-button" aria-label={t("header.share")} className="btn btn-accent !px-3.5 lg:!px-4">
          <Share2 aria-hidden="true" className="size-4" />
          <span className="hidden lg:inline">{t("header.share")}</span>
        </button>
      </div>
    </header>
  );
}
