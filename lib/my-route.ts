"use client";

import { useCallback } from "react";
import { createIdStore } from "@/lib/id-store";

/** 내 코스: 사용자가 고른 장소 id(방문 순서). 이 브라우저에만 저장, 공유 링크(?stops=)로 전달 가능 */
export const MY_ROUTE_MAX = 25;
export const MY_ROUTE_ID = "my-route";
const useStore = createIdStore("local-atlas:my-route", MY_ROUTE_MAX);

/** 순서 바꾸기(순수 함수) — 범위를 벗어나면 그대로 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function useMyRoute() {
  const { list, update } = useStore();
  return {
    stops: list,
    has: (id: string) => list.includes(id),
    add: useCallback((id: string) => update((cur) => (cur.includes(id) || cur.length >= MY_ROUTE_MAX ? cur : [...cur, id])), [update]),
    remove: useCallback((id: string) => update((cur) => cur.filter((x) => x !== id)), [update]),
    move: useCallback((from: number, to: number) => update((cur) => moveItem(cur, from, to)), [update]),
    replace: useCallback((ids: string[]) => update(() => ids), [update]),
    clear: useCallback(() => update(() => []), [update]),
  };
}
