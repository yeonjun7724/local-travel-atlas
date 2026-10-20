"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { siteConfig, type Language } from "@/config/site";
import { isLanguage, translate, type MessageKey } from "@/lib/i18n";

const STORAGE_KEY = "local-atlas:lang";
const EVENT = "local-atlas:lang-change";

function readStored(): Language {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(v)) return v;
  } catch {
    // 개인정보 보호 모드 등에서 localStorage 접근이 막힌 경우: 기본 언어 사용
  }
  return siteConfig.defaultLanguage;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

interface I18nValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // 서버 렌더링에서는 기본 언어, 브라우저에서는 저장된 언어 (새로고침 후에도 유지)
  const lang = useSyncExternalStore(subscribe, readStored, () => siteConfig.defaultLanguage);

  const setLang = useCallback((l: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // 저장 실패해도 현재 세션에서는 계속 동작해야 하므로 이벤트만 발생시킵니다.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n 은 I18nProvider 안에서만 사용할 수 있습니다");
  return ctx;
}
