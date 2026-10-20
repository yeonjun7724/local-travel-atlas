"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";

export interface ToastMessage {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

const STYLE = {
  success: { Icon: CheckCircle2, cls: "bg-[var(--color-primary)] text-white" },
  error: { Icon: AlertCircle, cls: "bg-[var(--color-ink)] text-white" },
  info: { Icon: Info, cls: "bg-[var(--color-ink)] text-white" },
} as const;

/** 상호작용 결과(성공·실패·권한 거부)를 알려 주는 일시적 메시지. 스크린 리더에도 읽힙니다. */
export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(onDismiss, toast.kind === "error" ? 6000 : 3500);
    return () => window.clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const { Icon, cls } = STYLE[toast.kind];
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      data-testid="toast"
      className={`rise-in pointer-events-auto flex max-w-[min(92vw,26rem)] items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-[var(--shadow-float)] ${cls}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1 leading-snug" data-testid="toast-text">
        {toast.text}
      </p>
      <button type="button" onClick={onDismiss} aria-label={t("common.close")} className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full hover:bg-white/20">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
