"use client";

import { useI18n } from "@/components/common/I18nProvider";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">{t("error.title")}</h1>
      <p className="text-[var(--color-muted)]">{t("error.description")}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-[var(--color-accent)] px-6 py-2 font-medium text-white"
      >
        {t("error.retry")}
      </button>
    </div>
  );
}
