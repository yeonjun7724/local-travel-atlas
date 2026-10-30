"use client";

import { useCallback } from "react";
import { createIdStore } from "@/lib/id-store";

/** 찜한 장소 목록 — 이 브라우저에만 저장됩니다(서버로 보내지 않음). */
const useStore = createIdStore("local-atlas:favorites");

export function useFavorites() {
  const { list, update } = useStore();
  const toggle = useCallback((id: string) => update((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])), [update]);
  return { favorites: list, isFavorite: (id: string) => list.includes(id), toggle };
}
