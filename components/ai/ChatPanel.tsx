"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, RotateCcw, Send, Wrench, X } from "lucide-react";
import { useI18n } from "@/components/common/I18nProvider";

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ApiMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** 한 번의 요청에서 도구 호출 → 재질문을 반복할 최대 횟수 */
const MAX_ROUNDS = 8;
/** 서버로 보낼 최근 메시지 수(오래된 대화는 잘라 비용·지연을 줄입니다) */
const HISTORY = 40;

function trimHistory(msgs: ApiMessage[]): ApiMessage[] {
  if (msgs.length <= HISTORY) return msgs;
  let start = msgs.length - HISTORY;
  // tool 메시지가 짝(assistant tool_calls) 없이 맨 앞에 오지 않도록 user 메시지부터 시작
  while (start < msgs.length && msgs[start].role !== "user") start++;
  return msgs.slice(start);
}

export function ChatPanel({
  runTool,
  getState,
  onClose,
  className = "",
}: {
  runTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  getState: () => string;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let convo: ApiMessage[] = [...messages, { role: "user", content: q }];
    setMessages(convo);
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: trimHistory(convo), state: getState() }),
          signal: ctrl.signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error ?? "upstream");
        const msg = body.message as Extract<ApiMessage, { role: "assistant" }>;
        convo = [...convo, msg];
        setMessages(convo);
        if (!msg.tool_calls?.length) break;
        // 도구는 순서대로 실행합니다(앞 도구의 화면 변화가 다음 도구에 반영되도록).
        for (const call of msg.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            // 인자가 깨졌으면 빈 인자로 실행 → 도구가 오류를 돌려줍니다
          }
          let result: string;
          try {
            result = await runTool(call.function.name, args);
          } catch (e) {
            result = JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) });
          }
          if (ctrl.signal.aborted) return;
          convo = [...convo, { role: "tool", tool_call_id: call.id, content: result.slice(0, 12000) }];
          setMessages(convo);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const code = (e as Error).message;
      setError(t(code === "not_configured" ? "ai.notConfigured" : code === "rate_limited" ? "ai.rateLimited" : "ai.failed"));
      // 실패한 턴에서 짝이 맞지 않는 tool_calls 가 남지 않도록 마지막 user 메시지 이전으로 되돌립니다
      setMessages((cur) => {
        const last = cur.findLastIndex((m) => m.role === "user");
        return last >= 0 ? cur.slice(0, last) : cur;
      });
      setInput(q);
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages([]);
    setError(null);
  };

  const suggestions = [t("ai.suggest1"), t("ai.suggest2"), t("ai.suggest3")];

  return (
    <section aria-label={t("ai.title")} data-testid="ai-panel" className={`flex min-h-0 flex-col bg-[var(--color-surface)] ${className}`}>
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">
        <Bot aria-hidden="true" className="size-5 text-[var(--color-accent)]" />
        <h2 className="flex-1 text-sm font-bold">{t("ai.title")}</h2>
        <button type="button" onClick={reset} aria-label={t("ai.reset")} title={t("ai.reset")} className="btn btn-outline !min-h-8 !px-2">
          <RotateCcw aria-hidden="true" className="size-4" />
        </button>
        <button type="button" onClick={onClose} aria-label={t("ai.close")} title={t("ai.close")} className="btn btn-outline !min-h-8 !px-2" data-testid="ai-close">
          <X aria-hidden="true" className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="sheet-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--color-paper)] px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">{t("ai.intro")}</p>
            <div className="flex flex-col items-start gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-left text-sm hover:border-[var(--color-ink)]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          if (m.role === "user")
            return (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-[var(--color-ink)] px-3 py-2 text-sm text-white">{m.content}</p>
              </div>
            );
          if (m.role === "assistant")
            return (
              <div key={i} className="space-y-1.5">
                {m.tool_calls?.map((c) => (
                  <p key={c.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sand)] px-2 py-0.5 text-[0.6875rem] font-medium text-[var(--color-muted)] [margin-right:0.25rem]">
                    <Wrench aria-hidden="true" className="size-3" />
                    {c.function.name}
                  </p>
                ))}
                {m.content && <p className="max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed shadow-sm">{m.content}</p>}
              </div>
            );
          return null;
        })}
        {busy && (
          <p className="inline-flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" /> {t("ai.thinking")}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>

      <form
        className="flex shrink-0 items-end gap-2 border-t border-[var(--color-line)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label className="sr-only" htmlFor="ai-input">
          {t("ai.placeholder")}
        </label>
        <textarea
          id="ai-input"
          data-testid="ai-input"
          rows={1}
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={t("ai.placeholder")}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm"
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t("ai.send")} className="btn btn-primary !min-h-10 !px-3 disabled:opacity-40">
          <Send aria-hidden="true" className="size-4" />
        </button>
      </form>
    </section>
  );
}
