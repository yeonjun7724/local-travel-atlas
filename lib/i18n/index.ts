import { ko, type MessageKey } from "./ko";
import { en } from "./en";
import type { Language } from "@/config/site";
import type { Category, Place, Route, Theme } from "@/lib/validation/schemas";

export type { MessageKey };

const dictionaries: Record<Language, Record<MessageKey, string>> = { ko, en };

export function translate(lang: Language, key: MessageKey, vars?: Record<string, string | number>): string {
  // 폴백 정책: 선택 언어에 없으면 한국어, 한국어에도 없으면 키 자체
  let s = dictionaries[lang][key] ?? ko[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function isLanguage(v: unknown): v is Language {
  return v === "ko" || v === "en";
}

/** 영어 콘텐츠가 비어 있으면 한국어로 대체하고 fellBack=true 로 알려 줍니다. */
function pick(lang: Language, ko_: string, en_: string): { text: string; fellBack: boolean } {
  if (lang === "en") return en_ ? { text: en_, fellBack: false } : { text: ko_, fellBack: true };
  return { text: ko_, fellBack: false };
}

export function localizePlace(p: Place, lang: Language) {
  const n = pick(lang, p.nameKo, p.nameEn);
  const d = pick(lang, p.descriptionKo, p.descriptionEn);
  return { name: n.text, description: d.text, fellBack: n.fellBack || d.fellBack };
}

export function localizeRoute(r: Route, lang: Language) {
  return {
    title: pick(lang, r.titleKo, r.titleEn).text,
    description: pick(lang, r.descriptionKo, r.descriptionEn).text,
  };
}

export function localizeLabel(item: Category | Theme, lang: Language): string {
  return lang === "en" ? item.labelEn : item.labelKo;
}
