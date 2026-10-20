"use client";

import { useRef, type ReactNode } from "react";
import { useI18n } from "@/components/common/I18nProvider";

export type SheetState = "collapsed" | "half" | "full";
const ORDER: SheetState[] = ["collapsed", "half", "full"];

/** 시트가 지도(main) 안에서 차지하는 높이(px). 지도 컨테이너 높이에 비례합니다. */
export function sheetSnaps(containerHeight: number): Record<SheetState, number> {
  const collapsed = 124;
  const half = Math.max(collapsed + 80, Math.round(containerHeight * 0.46));
  // 전체 상태에서도 위쪽 검색 바·테마 칩(약 112px)은 가리지 않습니다.
  const full = Math.max(half + 40, containerHeight - 116);
  return { collapsed, half, full };
}

interface Props {
  state: SheetState;
  onState: (s: SheetState) => void;
  containerHeight: number;
  /** 드래그 중인 실시간 높이(px). 끝나면 null */
  dragHeight: number | null;
  onDragHeight: (h: number | null) => void;
  tabs: ReactNode;
  children: ReactNode;
  label: string;
}

/**
 * 모바일 바텀시트: collapsed / half / full 3단계.
 * 손잡이를 끌어서(Pointer Events) 높이를 조절하고, 놓으면 가장 가까운 단계로 스냅합니다.
 * 탭/Enter 는 단계 순환, ↑/↓ 키로도 조절할 수 있습니다.
 */
export function MobileBottomSheet({ state, onState, containerHeight, dragHeight, onDragHeight, tabs, children, label }: Props) {
  const { t } = useI18n();
  const snaps = sheetSnaps(containerHeight);
  const height = dragHeight ?? snaps[state];
  const gesture = useRef<{ startY: number; startH: number; startT: number; moved: boolean } | null>(null);

  const nearest = (h: number, velocityPxPerMs: number): SheetState => {
    // 빠르게 던지면 방향 쪽으로 관성을 더해 다음 단계로 보냅니다.
    const projected = h + velocityPxPerMs * 180;
    return ORDER.reduce((best, s) => (Math.abs(snaps[s] - projected) < Math.abs(snaps[best] - projected) ? s : best), "half" as SheetState);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { startY: e.clientY, startH: height, startT: performance.now(), moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    const dy = g.startY - e.clientY;
    if (Math.abs(dy) > 6) g.moved = true;
    if (g.moved) onDragHeight(Math.min(snaps.full, Math.max(snaps.collapsed, g.startH + dy)));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (!g.moved) {
      // 탭: 단계 순환 (half → full → collapsed → half)
      onState(state === "half" ? "full" : state === "full" ? "collapsed" : "half");
      return;
    }
    const dt = Math.max(1, performance.now() - g.startT);
    const finalH = Math.min(snaps.full, Math.max(snaps.collapsed, g.startH + (g.startY - e.clientY)));
    onState(nearest(finalH, (g.startY - e.clientY) / dt));
    onDragHeight(null);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = ORDER.indexOf(state);
    if (e.key === "ArrowUp" && i < 2) {
      e.preventDefault();
      onState(ORDER[i + 1]);
    } else if (e.key === "ArrowDown" && i > 0) {
      e.preventDefault();
      onState(ORDER[i - 1]);
    }
  };

  return (
    <section
      aria-label={label}
      data-testid="bottom-sheet"
      data-state={state}
      data-dragging={dragHeight !== null}
      style={{ height }}
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[var(--radius-panel)] border-t border-[var(--color-line)] bg-[var(--color-paper)] shadow-[var(--shadow-sheet)] ${
        dragHeight === null ? "transition-[height] duration-200 ease-out" : ""
      }`}
    >
      <button
        type="button"
        data-testid="sheet-handle"
        aria-label={t("sheet.drag")}
        aria-expanded={state !== "collapsed"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          gesture.current = null;
          onDragHeight(null);
        }}
        onKeyDown={onKeyDown}
        // 키보드(Enter/Space)로 누르면 detail===0 → 단계 순환. 포인터 탭은 pointerup 에서 이미 처리했습니다.
        onClick={(e) => {
          if (e.detail === 0) onState(state === "half" ? "full" : state === "full" ? "collapsed" : "half");
        }}
        style={{ touchAction: "none" }}
        className="flex h-9 w-full shrink-0 cursor-grab items-center justify-center rounded-t-[var(--radius-panel)] active:cursor-grabbing"
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-[var(--color-line)]" />
      </button>
      <div className="shrink-0 px-4 pb-2">{tabs}</div>
      <div
        id="panel-content"
        // 접힌 상태의 내용은 보이지 않으므로 포커스·스크린 리더에서도 제외합니다.
        inert={state === "collapsed"}
        aria-hidden={state === "collapsed"}
        className="sheet-scroll safe-bottom min-h-0 flex-1 overflow-y-auto px-4 pt-1"
      >
        {children}
      </div>
    </section>
  );
}
