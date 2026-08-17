// "AI 명세서 작성" 기능이 사용하는 문서 품질 설정값.
// 공용 규칙은 ../document-quality.ts 의 DocumentQualityConfig 를 참고.

import type { DocumentQualityConfig } from "../document-quality.ts";

// 용어정의 문단은 매번 새로 생성하지 않고 고정 문구를 항상 붙인다.
export const TERM_DEFINITIONS_TEMPLATE =
  `이하, 본 명세서에서 사용되는 용어의 의미를 정의한다. 본 명세서에서 "또는" 및 "및/또는"은 ` +
  `문맥상 명백히 다른 의미로 해석되지 않는 한 나열된 항목 중 하나 이상을 포함하는 것으로 해석된다. ` +
  `"적어도 하나"라는 표현은 나열된 항목 중 하나 또는 둘 이상의 조합을 포함하는 것으로 해석된다. ` +
  `어떤 구성요소를 "포함한다"고 기재한 경우, 이는 명시적으로 기재되지 않은 다른 구성요소를 ` +
  `배제하지 않는 것으로 해석된다.\n\n`;

export const PATENT_SPEC_QUALITY_CONFIG: DocumentQualityConfig = {
  docTypeName: "대한민국 특허 명세서",
  narrationRule: `예: "~된다", "~할 수 있다", "~일 수 있다". "~입니다", "~습니다" 같은 표현은 사용하지 않음`,
  forbiddenEndingPatterns: [
    { name: "구어체 종결어미(~습니다)", regex: /습니다[.!?]?(\s|$)/ },
  ],
  requiresAlternativeEnumeration: true,
  categories: [
    { key: "method", label: "방법 청구항" },
    { key: "program", label: "컴퓨터프로그램 청구항" },
    { key: "device", label: "장치 청구항" },
  ],
  requiresApplicationExample: true,
  correspondenceRule:
    "도면의 간단한 설명을 작성할 때는, 각 도면이 대응하는 처리 단계 번호(S110, S120 등)를 함께 언급합니다.",
  termsTemplate: TERM_DEFINITIONS_TEMPLATE,
};
