"use client";

import { ListIcon, Loader2, Locate, Map as MapIcon, Minus, Plus, RotateCcw } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";

interface Props {
  locating: boolean;
  onLocate: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

/** 모바일 전용: 지도 ↔ 목록 전환. 바텀시트 바로 위 가운데에 떠 있어 엄지로 누르기 쉽습니다. */
export function ListToggle({ showingList, onToggle }: { showingList: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" onClick={onToggle} data-testid="list-toggle" className="btn btn-primary pointer-events-auto shadow-[var(--shadow-float)]">
      {showingList ? <MapIcon aria-hidden="true" className="size-4" /> : <ListIcon aria-hidden="true" className="size-4" />}
      {t(showingList ? "map.showMap" : "map.showList")}
    </button>
  );
}

/** 지도 위에 떠 있는 컨트롤 묶음. 모든 버튼은 44px 이상의 터치 영역을 가집니다. */
export function MapControls({ locating, onLocate, onZoomIn, onZoomOut, onReset }: Props) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={t("map.controls")} className="flex flex-col items-end gap-2">
      <button type="button" onClick={onLocate} disabled={locating} aria-label={t("geo.button")} title={t("geo.button")} data-testid="locate-button" className="btn-icon">
        {locating ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <Locate aria-hidden="true" className="size-5" />}
      </button>
      <button type="button" onClick={onReset} aria-label={t("map.reset")} title={t("map.reset")} data-testid="reset-button" className="btn-icon">
        <RotateCcw aria-hidden="true" className="size-5" />
      </button>
      {/* 터치 기기는 핀치로 확대/축소하므로 버튼을 숨겨 화면을 비웁니다(마우스·키보드 사용자에게는 표시) */}
      <div className="flex flex-col overflow-hidden rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-float)] [@media(pointer:coarse)]:hidden">
        <button type="button" onClick={onZoomIn} aria-label={t("map.zoomIn")} title={t("map.zoomIn")} data-testid="zoom-in" className="grid size-11 place-items-center transition-colors hover:bg-[var(--color-sand)] active:bg-[var(--color-line)]">
          <Plus aria-hidden="true" className="size-5" />
        </button>
        <span aria-hidden="true" className="mx-2 h-px bg-[var(--color-line)]" />
        <button type="button" onClick={onZoomOut} aria-label={t("map.zoomOut")} title={t("map.zoomOut")} data-testid="zoom-out" className="grid size-11 place-items-center transition-colors hover:bg-[var(--color-sand)] active:bg-[var(--color-line)]">
          <Minus aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}
