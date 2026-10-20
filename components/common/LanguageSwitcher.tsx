"use client";

import { siteConfig, type Language } from "@/config/site";
import { useI18n } from "@/components/common/I18nProvider";

export function LanguageSwitcher() {
  const { t, lang, setLang } = useI18n();
  return (
    <div role="group" aria-label={t("header.language")} className="flex rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-0.5">
      {siteConfig.languages.map((l: Language) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          lang={l}
          aria-label={`${l.toUpperCase()} ${t(l === "ko" ? "lang.ko" : "lang.en")}`}
          data-testid={`lang-${l}`}
          onClick={() => setLang(l)}
          className={`min-h-11 min-w-11 rounded-full px-3 text-xs font-bold transition-colors ${
            lang === l ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:bg-[var(--color-sand)]"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
