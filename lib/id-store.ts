"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 장소 id 목록을 이 브라우저(localStorage)에만 저장하는 작은 저장소 — 찜·내 코스가 함께 씁니다(서버로 보내지 않음).
 * useSyncExternalStore 로 읽어 서버 렌더링과 첫 화면이 어긋나지 않습니다.
 */
const EMPTY: string[] = [];
const ID = /^[a-z0-9-]{1,64}$/;

export function createIdStore(key: string, max = 500) {
  const event = `${key}-change`;
  let cache: { raw: string | null; value: string[] } = { raw: null, value: EMPTY };

  function read(): string[] {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return EMPTY; // 저장소 접근이 막힌 환경
    }
    if (raw === cache.raw) return cache.value; // 같은 참조를 돌려줘야 불필요한 리렌더가 없습니다
    let value: string[] = EMPTY;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) value = [...new Set(parsed.filter((x): x is string => typeof x === "string" && ID.test(x)))].slice(0, max);
    } catch {
      value = EMPTY;
    }
    cache = { raw, value };
    return value;
  }

  function write(next: string[]) {
    try {
      window.localStorage.setItem(key, JSON.stringify(next.slice(0, max)));
    } catch {
      // 저장 실패 시에도 오류 없이 무시 (편의 기능)
    }
    window.dispatchEvent(new Event(event));
  }

  function subscribe(cb: () => void) {
    window.addEventListener(event, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(event, cb);
      window.removeEventListener("storage", cb);
    };
  }

  return function useIdStore() {
    const list = useSyncExternalStore(subscribe, read, () => EMPTY);
    const update = useCallback((fn: (cur: string[]) => string[]) => write(fn(read())), []);
    return { list, update };
  };
}
