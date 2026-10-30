"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Footprints, Loader2, MousePointerClick, Shuffle, Share2, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { orderColor } from "@/lib/data/geojson";
import { formatDistance } from "@/lib/geo";
import { localizeLabel, localizePlace } from "@/lib/i18n";
import type { WalkResult } from "@/lib/routing/osrm";
import type { Category, Place } from "@/lib/validation/schemas";

export type WalkState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: WalkResult }
  | { status: "error"; code: "not_configured" | "no_route" | "failed" };

interface Props {
  stops: Place[];
  categories: Category[];
  walk: WalkState;
  selectedId: string | null;
  onSelectPlace: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  onOptimize: () => void;
  onClear: () => void;
  onBack: () => void;
  onShare: () => void;
}

/** 내 코스: 고른 장소를 순서대로 잇고 실제 도보 경로(OSRM)·구간 거리를 보여 줍니다. */
export function MyRoutePanel(p: Props) {
  const { t, lang } = useI18n();
  const catById = new Map(p.categories.map((c) => [c.id, c]));
  const units = { km: t("unit.km"), m: t("unit.m") };
  const walk = p.walk.status === "ok" ? p.walk.data : null;
  const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))}${t("unit.min")}`;

  return (
    <section className="rise-in space-y-4 pb-6" data-testid="my-route" aria-labelledby="my-route-title">
      <div className="flex items-center justify-between">
        <button type="button" onClick={p.onBack} className="btn btn-ghost -ml-2 !min-h-10 !px-3" data-testid="route-back">
          <ArrowLeft aria-hidden="true" className="size-4" /> {t("route.back")}
        </button>
        {p.stops.length > 1 && (
          <button type="button" onClick={p.onShare} className="btn btn-ghost !min-h-10 !px-3" data-testid="share-route">
            <Share2 aria-hidden="true" className="size-4" /> {t("header.share")}
          </button>
        )}
      </div>

      <div>
        <h2 id="my-route-title" className="text-[1.625rem] font-bold leading-tight" data-testid="route-title">
          {t("my.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{t("my.description")}</p>
      </div>

      {p.stops.length < 2 && (
        <div className="flex gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm" data-testid="my-route-hint">
          <MousePointerClick aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--color-accent)]" />
          <p className="leading-relaxed">{t(p.stops.length ? "my.needOneMore" : "my.empty")}</p>
        </div>
      )}

      {p.stops.length > 1 && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4" data-testid="walk-summary" aria-live="polite">
          {p.walk.status === "loading" && (
            <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" /> {t("my.calculating")}
            </p>
          )}
          {walk && (
            <>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-accent)]">
                <Footprints aria-hidden="true" className="size-4" /> {t("route.realPath")}
              </p>
              <p className="mt-1 text-lg font-bold">{t("route.walkSummary", { d: formatDistance(walk.totalDistanceM, units), t: minutes(walk.totalDurationS) })}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">{t("my.osrmNotice")}</p>
            </>
          )}
          {p.walk.status === "error" && (
            <p className="text-xs leading-relaxed" data-testid="straight-notice">
              {t(p.walk.code === "no_route" ? "my.noRoute" : p.walk.code === "not_configured" ? "my.notConfigured" : "my.failed")} {t("route.straightNotice")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {p.stops.length > 2 && (
              <button type="button" onClick={p.onOptimize} className="btn btn-outline !min-h-10 !px-3 text-sm" data-testid="my-optimize">
                <Shuffle aria-hidden="true" className="size-4" /> {t("my.optimize")}
              </button>
            )}
            <button type="button" onClick={p.onClear} className="btn btn-ghost !min-h-10 !px-3 text-sm text-[var(--color-danger)]" data-testid="my-clear">
              <Trash2 aria-hidden="true" className="size-4" /> {t("my.clear")}
            </button>
          </div>
        </div>
      )}

      {p.stops.length > 0 && (
        <ol className="space-y-1.5" data-testid="route-stops" aria-label={t("route.stops")}>
          {p.stops.map((s, i) => {
            const cat = catById.get(s.category);
            const seg = walk?.segments[i];
            const name = localizePlace(s, lang).name;
            return (
              <li key={s.id} className="space-y-1.5">
                <div
                  className={`flex items-center gap-2 rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-2 pl-3 ${s.id === p.selectedId ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]" : "border-[var(--color-line)]"}`}
                  data-testid={`my-stop-${s.id}`}
                >
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: orderColor(i) }}>
                    {i + 1}
                  </span>
                  <button type="button" onClick={() => p.onSelectPlace(s.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: cat?.color }}>
                      <CategoryIcon name={cat?.icon} className="size-3.5 shrink-0" />
                      <span className="truncate">{cat ? localizeLabel(cat, lang) : s.category}</span>
                    </span>
                    <span className="block truncate font-bold">{name}</span>
                  </button>
                  <span className="flex shrink-0">
                    <button type="button" onClick={() => p.onMove(i, i - 1)} disabled={i === 0} aria-label={t("my.up", { name })} className="grid size-9 place-items-center rounded-full hover:bg-[var(--color-sand)] disabled:opacity-30">
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => p.onMove(i, i + 1)}
                      disabled={i === p.stops.length - 1}
                      aria-label={t("my.down", { name })}
                      className="grid size-9 place-items-center rounded-full hover:bg-[var(--color-sand)] disabled:opacity-30"
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </button>
                    <button type="button" onClick={() => p.onRemove(s.id)} aria-label={t("my.remove", { name })} data-testid={`my-remove-${s.id}`} className="grid size-9 place-items-center rounded-full hover:bg-[var(--color-sand)]">
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </span>
                </div>
                {i < p.stops.length - 1 && (
                  <p className="ml-6 flex items-center gap-1.5 border-l-[3px] py-1 pl-4 text-xs text-[var(--color-muted)]" style={{ borderColor: orderColor(i) }} data-testid={`segment-${i}`}>
                    <Footprints aria-hidden="true" className="size-3.5" style={{ color: orderColor(i) }} />
                    {t("route.segment", { a: i + 1, b: i + 2 })}
                    {seg ? ` · ${formatDistance(seg.distanceM, units)} · ${minutes(seg.durationS)}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
