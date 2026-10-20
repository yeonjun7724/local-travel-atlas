"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Share2, X } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";
import { buildShareUrl, isLocalHost } from "@/lib/share";

export type ShareScope = "map" | "route" | "place";

interface Props {
  open: boolean;
  onClose: () => void;
  routeId: string | null;
  placeId: string | null;
  scope: ShareScope;
  onScope: (s: ShareScope) => void;
  brand: string;
  titles: { route?: string; place?: string };
}

export function ShareDialog({ open, onClose, routeId, placeId, scope, onScope, brand, titles }: Props) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin + window.location.pathname;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = useMemo(() => {
    if (!baseUrl) return "";
    try {
      if (scope === "place" && placeId) return buildShareUrl(baseUrl, { placeId, routeId: routeId ?? undefined });
      if (scope === "route" && routeId) return buildShareUrl(baseUrl, { routeId });
      return buildShareUrl(baseUrl, {});
    } catch {
      return "";
    }
  }, [baseUrl, scope, placeId, routeId]);

  const isLocal = useMemo(() => {
    try {
      return baseUrl ? isLocalHost(new URL(baseUrl).hostname) : false;
    } catch {
      return false;
    }
  }, [baseUrl]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || !shareUrl) return;
    let cancelled = false;
    QRCode.toDataURL(shareUrl, { margin: 2, width: 512, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(""));
    return () => {
      cancelled = true;
    };
  }, [open, shareUrl]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied("idle"), 2500);
  };

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const nativeShare = async () => {
    const title = (scope === "place" ? titles.place : scope === "route" ? titles.route : undefined) ?? brand;
    try {
      await navigator.share({ title: brand, text: t("share.text", { title, brand }), url: shareUrl });
    } catch {
      // 사용자가 공유 창을 닫은 경우 — 오류로 취급하지 않습니다.
    }
  };

  const scopes: { id: ShareScope; label: string; disabled: boolean }[] = [
    { id: "map", label: t("share.scope.map"), disabled: false },
    { id: "route", label: t("share.scope.route"), disabled: !routeId },
    { id: "place", label: t("share.scope.place"), disabled: !placeId },
  ];

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="share-title"
      data-testid="share-dialog"
      className="m-auto w-[min(92vw,26rem)] rounded-3xl bg-[var(--color-paper)] p-0 text-[var(--color-ink)] shadow-[var(--shadow-float)] backdrop:bg-black/40"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 id="share-title" className="font-[family-name:var(--font-display)] text-xl">
            {t("share.title")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("share.close")} className="grid size-11 place-items-center rounded-full hover:bg-[var(--color-sand)]">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div role="group" aria-label={t("share.scope")} className="flex gap-1.5">
          {scopes.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={s.disabled}
              aria-pressed={scope === s.id}
              data-testid={`scope-${s.id}`}
              onClick={() => onScope(s.id)}
              className={`min-h-11 flex-1 rounded-full border px-2 text-sm font-medium disabled:opacity-40 ${
                scope === s.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-line)] bg-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl}
            aria-label="URL"
            data-testid="share-url"
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-line)] bg-white px-3 text-sm"
          />
          <button type="button" onClick={copy} data-testid="copy-url" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-white">
            {copied === "ok" ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            {copied === "ok" ? t("share.copied") : t("share.copy")}
          </button>
        </div>
        {copied === "fail" && (
          <p role="alert" className="text-xs text-red-700">
            {t("share.copyFailed")}
          </p>
        )}

        {isLocal && (
          <p className="rounded-xl bg-[var(--color-accent-soft)] px-3 py-2 text-xs leading-relaxed" data-testid="local-notice">
            {t("share.localNotice")}
          </p>
        )}

        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t("share.qr")} width={192} height={192} data-testid="qr-image" className="size-48" />
          ) : (
            <div className="size-48 animate-pulse rounded-xl bg-[var(--color-sand)]" />
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={qr || undefined}
              download={`${brand.toLowerCase().replace(/\s+/g, "-")}-qr.png`}
              aria-disabled={!qr}
              data-testid="qr-download"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-4 text-sm font-medium hover:bg-[var(--color-sand)]"
            >
              <Download aria-hidden="true" className="size-4" /> {t("share.qrDownload")}
            </a>
            {canNativeShare && (
              <button type="button" onClick={nativeShare} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--color-line)] px-4 text-sm font-medium hover:bg-[var(--color-sand)]">
                <Share2 aria-hidden="true" className="size-4" /> {t("share.native")}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
