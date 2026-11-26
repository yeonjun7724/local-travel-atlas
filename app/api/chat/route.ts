import { NextResponse } from "next/server";
import { z } from "zod";
import { AI_SYSTEM_PROMPT, AI_TOOL_NAMES, AI_TOOLS } from "@/lib/ai/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5-mini";

const toolCall = z.object({
  id: z.string().max(100),
  type: z.literal("function"),
  function: z.object({ name: z.enum(AI_TOOL_NAMES), arguments: z.string().max(4000) }),
});
const message = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(2000) }),
  z.object({ role: z.literal("assistant"), content: z.string().max(8000).nullable(), tool_calls: z.array(toolCall).max(10).optional() }),
  z.object({ role: z.literal("tool"), tool_call_id: z.string().max(100), content: z.string().max(12000) }),
]);
const bodySchema = z.object({
  messages: z.array(message).min(1).max(60),
  /** 브라우저가 보낸 현재 화면 상태(JSON 문자열) */
  state: z.string().max(16000),
});

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
let windowStart = 0;
let windowCount = 0;

/** GET: ChatGPT 패널 사용 가능 여부 */
export function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.OPENAI_API_KEY) });
}

/**
 * POST: 대화 한 단계. 응답이 tool_calls 를 담고 있으면 브라우저가 실행한 뒤 결과(tool 메시지)를 붙여 다시 호출합니다.
 * API 키는 서버에만 있습니다(NEXT_PUBLIC_ 금지).
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  if (++windowCount > MAX_PER_WINDOW) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const reasoning = /^(gpt-5|o\d)/.test(model) ? { reasoning_effort: "low" } : {};
  const body = {
    model,
    ...reasoning,
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "system", content: `현재 화면 상태(state):\n${parsed.data.state}` },
      ...parsed.data.messages,
    ],
    tools: AI_TOOLS,
    tool_choice: "auto",
    parallel_tool_calls: true,
  };

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[api/chat]", res.status, json?.error?.message ?? "");
      return NextResponse.json({ error: res.status === 429 ? "rate_limited" : "upstream" }, { status: res.status === 429 ? 429 : 502 });
    }
    const msg = json?.choices?.[0]?.message;
    return NextResponse.json({
      message: {
        role: "assistant",
        content: typeof msg?.content === "string" ? msg.content : null,
        tool_calls: Array.isArray(msg?.tool_calls) && msg.tool_calls.length ? msg.tool_calls : undefined,
      },
    });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    console.error("[api/chat]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: timeout ? "timeout" : "upstream" }, { status: timeout ? 504 : 502 });
  }
}
