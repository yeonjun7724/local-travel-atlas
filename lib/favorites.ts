"use client";

import { useCallback, useSyncExternalStore } from "react";

/** 찜한 장소 목록 — 이 브라우저에만 저장됩니다(서버로 보내지 않음). */
const KEY = "local-atlas:favorites";
const EVENT = "local-atlas:favorites-change";
const EMPTY: string[] = [];
let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY; // 저장소 접근이 막힌 환경
  }
  if (raw === cache.raw) return cache.value; // 같은 참조를 돌려줘야 불필요한 리렌더가 없습니다
  let value: string[] = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) value = parsed.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,64}$/.test(x));
  } catch {
    value = EMPTY;
  }
  cache = { raw, value };
  return value;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useFavorites() {
  const list = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // 저장 실패 시에도 오류 없이 무시 (편의 기능)
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { favorites: list, isFavorite: (id: string) => list.includes(id), toggle };
}
