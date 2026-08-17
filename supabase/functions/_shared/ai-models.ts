// AI 모델 티어 설정 + 호출 계측 헬퍼.
//
// 작업 성격별로 모델을 분리한다: "fast"는 단순 변환/정제/분류 작업(키워드 확장,
// 뉴스 1차 요약 등), "quality"는 논리적 판단이나 법률문서 품질이 중요한 작업
// (선행기술 유사점 분석, 명세서 섹션 생성 등)에 쓴다. 모델명을 코드에 하드코딩하지
// 않고 환경변수를 먼저 확인하므로, Edge Function을 재배포하지 않고 Supabase
// 대시보드에서 환경변수만 바꿔도 모델을 조정할 수 있다.
//
// 이 파일은 소스 코드상의 공용 모듈(git으로 버전 관리)이며, 실제 Edge Function은
// 대시보드에 자기완결적 파일 하나로 붙여넣어 배포하는 방식이므로, 이 모듈의
// 내용은 각 Edge Function 소스에 조립되어 포함된다(런타임 import가 아님).

export type ModelTier = "fast" | "quality";

const MODEL_DEFAULTS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5-20251001",
  quality: "claude-sonnet-4-5",
};

export function resolveModel(tier: ModelTier): string {
  const envKey = tier === "fast" ? "AI_MODEL_FAST" : "AI_MODEL_QUALITY";
  return Deno.env.get(envKey) || MODEL_DEFAULTS[tier];
}

export interface ClaudeUsage {
  tier: ModelTier;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

// 계측 포함 Claude 호출. systemPrompt가 없으면 system 필드를 아예 생략한다
// (선행기술조사/뉴스 파이프라인은 지금까지 system 프롬프트를 쓰지 않았음).
export async function callClaudeInstrumented(
  anthropicApiKey: string,
  tier: ModelTier,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number,
): Promise<{ text: string; usage: ClaudeUsage }> {
  const model = resolveModel(tier);
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const start = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";
  const usage: ClaudeUsage = {
    tier,
    model,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    latencyMs,
  };
  console.log(
    `[claude] tier=${usage.tier} model=${usage.model} in=${usage.inputTokens} out=${usage.outputTokens} ms=${usage.latencyMs}`,
  );
  return { text, usage };
}

// api_usage_log에 넣을 행을 만든다. search_id가 없는 호출(예: 명세서 생성)은 null.
export function usageLogRow(usage: ClaudeUsage, searchId: string | null) {
  return {
    api_name: "anthropic",
    search_id: searchId,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    latency_ms: usage.latencyMs,
  };
}
