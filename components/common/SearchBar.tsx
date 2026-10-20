"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  /** 화면 어디서든 "/" 를 누르면 검색창에 포커스 */
  enableShortcut?: boolean;
}

export function SearchBar({ value, onChange, className = "", enableShortcut = true }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enableShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableShortcut]);

  return (
    <div role="search" className={`relative ${className}`}>
      <label htmlFor="place-search" className="sr-only">
        {t("search.label")}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--color-muted)]" />
      <input
        id="place-search"
        ref={ref}
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        value={value}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            onChange("");
          }
        }}
        placeholder={t("search.placeholder")}
        aria-keyshortcuts="/"
        className="h-12 w-full rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] pl-12 pr-12 text-base text-[var(--color-ink)] shadow-[var(--shadow-card)] outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={t("search.clear")}
          data-testid="search-clear"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-sand)]"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      )}
    </div>
  );
}
