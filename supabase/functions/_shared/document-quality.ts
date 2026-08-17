// 공용 문서 품질 가이드 모듈
//
// "AI 문서생성" 계열 기능(현재: AI명세서작성, 향후: 의견서 작성, 계약서 검토 등)이
// 공통으로 사용하는 문체/구조 품질 규칙. 특허명세서 생성 품질을 다듬으며 발견한
// 문제들(대화체 혼입, 카테고리 누락, 실시예 부실 등)을 문서 유형에 관계없이
// 재사용 가능한 형태로 일반화했다.
//
// 이 파일은 소스 코드상의 공용 모듈(git으로 버전 관리)이며, 실제 Edge Function은
// 대시보드에 자기완결적 파일 하나로 붙여넣어 배포하는 방식이므로, 이 모듈의
// 내용은 각 Edge Function 소스에 조립되어 포함된다(런타임 import가 아님).
//
// 사용법: 문서 유형별로 DocumentQualityConfig 를 하나 정의하고,
//   - buildQualitySystemPrompt(config) 로 시스템 프롬프트에 넣을 공통 규칙 텍스트를 만들고
//   - checkDocumentQuality(생성된 필드들, config) 로 후처리 검증을 돌린다.

export interface DocumentQualityConfig {
  // 문서 유형 이름 (예: "대한민국 특허 명세서")
  docTypeName: string;
  // 서술체 규칙 설명 (예: '"~된다", "~할 수 있다" 같은 서술체만 사용')
  narrationRule: string;
  // 이 문서 유형에서 금지되는 구어체 종결어미 등 추가 패턴
  forbiddenEndingPatterns: { name: string; regex: RegExp }[];
  // 핵심 구성요소/항목에 대해 대안·범주를 함께 열거해야 하는지 여부
  requiresAlternativeEnumeration: boolean;
  // 문서가 여러 카테고리로 나뉘어 작성되어야 하는 경우 (예: 청구항의 방법/프로그램/장치)
  categories?: { key: string; label: string }[];
  // 다른 분야·상황에 적용되는 구체적 실시예/사례를 요구하는지 여부
  requiresApplicationExample: boolean;
  // 문서 내 구성요소 간 대응관계를 명시하라는 규칙 (예: "도면-처리단계 대응")
  correspondenceRule?: string;
  // 용어정의/관용구 등, AI가 매번 새로 생성하지 않고 고정 삽입할 표준 문구
  termsTemplate?: string;
}

// 모든 문서 유형에 공통으로 금지되는 표현 (문체 오염의 가장 흔한 형태)
export const BASE_FORBIDDEN_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "마크다운 볼드(**)", regex: /\*\*[^*\n]+\*\*/ },
  { name: "번호매김 기호(①②③...)", regex: /[①②③④⑤⑥⑦⑧⑨⑩]/ },
  { name: "대화 맥락 참조", regex: /(이전에|앞서)\s*(논의|말씀|언급)|말씀하신|말씀드린/ },
];

// 문서 유형 설정을 받아 시스템 프롬프트에 넣을 공통 규칙 텍스트를 만든다.
// 이 텍스트에 문서 유형 고유의 세부 지시(예: 특허명세서의 청구항 작성 형식)를
// 이어붙여 최종 시스템 프롬프트로 사용한다.
export function buildQualitySystemPrompt(config: DocumentQualityConfig): string {
  const lines: string[] = [];
  lines.push(`당신은 ${config.docTypeName}을(를) 작성하는 전문가입니다. 아래 규칙을 반드시 지키세요.`);
  lines.push("");

  let n = 1;
  lines.push(
    `${n++}. 모든 문장은 ${config.docTypeName}의 공식 서술체로만 작성합니다 (${config.narrationRule}). ` +
      `구어체·대화체 문장은 절대 사용하지 않습니다.`,
  );
  lines.push(
    `${n++}. 마크다운 볼드(**), 번호매김 기호(①②③ 등), 이모지, "이전에 논의했듯이", "말씀하신 대로" 같은 ` +
      `대화 맥락 참조 표현을 절대 포함하지 않습니다. 마크다운 코드블록 표시로 감싸지 말고 순수 JSON 텍스트만 ` +
      `출력합니다.`,
  );
  lines.push(
    `${n++}. 입력으로 사용자가 작성한 메모나 분석 노트, 혹은 이전 대화 내용이 주어지더라도, 그 문장을 그대로 ` +
      `옮기지 말고 반드시 ${config.docTypeName}의 서술체 문장으로 다시 작성합니다.`,
  );
  if (config.requiresAlternativeEnumeration) {
    lines.push(
      `${n++}. 핵심 구성요소나 항목(보통 3~5개)에 한해서만, 범위가 부당하게 좁아지지 않도록 대체 가능한 ` +
        `대안·범주를 2~3개 함께 열거합니다. 사소한 개념이나 세부 옵션까지 전부 나열하지 않습니다 -- 분량이 ` +
        `과도하게 길어지는 것을 반드시 피합니다.`,
    );
  }
  if (config.categories && config.categories.length > 0) {
    const labels = config.categories.map((c) => c.label).join("/");
    lines.push(`${n++}. ${labels}을(를) 모두 빠짐없이 작성합니다. 하나의 카테고리만 작성하고 끝내지 않습니다.`);
  }
  if (config.requiresApplicationExample) {
    lines.push(
      `${n++}. 문서 내용 마지막에는, 입력된 분야와 다른 인접 분야·상황에 적용되는 구체적 사례를 최소 1개 ` +
        `추가로 서술하되, 한 문장으로 끝내지 말고 2~3문장 이상으로 구체적으로 씁니다.`,
    );
  }
  if (config.correspondenceRule) {
    lines.push(`${n++}. ${config.correspondenceRule}`);
  }
  lines.push(
    `${n++}. 각 JSON 필드는 요청된 분량(글자 수)을 넘기지 않습니다. 분량 제한이 있는 이유는 응답이 중간에 ` +
      `잘리는 것을 막기 위함이므로 반드시 지킵니다.`,
  );

  return lines.join("\n");
}

// 생성된 문서 필드들을 검사해 위반된 규칙 이름 목록을 반환한다 (비어있으면 통과).
// 재생성은 기본적으로 시도하지 않는다 -- 과거 자동재시도를 넣었다가 Edge Function
// 실행시간 제한(EarlyDrop)에 걸린 적이 있어, 경고만 남기고 호출부가 그 경고를
// 사용자에게 보여주는 방식을 기본으로 한다. 시간 여유가 충분한 문서 유형에서만
// 호출부에서 재시도 로직을 선택적으로 추가한다.
export function checkDocumentQuality(spec: Record<string, unknown>, config: DocumentQualityConfig): string[] {
  const combined = Object.values(spec).filter((v) => typeof v === "string").join("\n");
  const patterns = [...BASE_FORBIDDEN_PATTERNS, ...config.forbiddenEndingPatterns];
  return patterns.filter((p) => p.regex.test(combined)).map((p) => p.name);
}
