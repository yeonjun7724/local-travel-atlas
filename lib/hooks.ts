"use client";

import { useSyncExternalStore } from "react";

/** Tailwind md(768px) 이상이면 true. 서버/첫 렌더에서는 false(모바일 우선). */
function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}

/** Tailwind lg(1024px) 이상 */
export function useIsWide(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
