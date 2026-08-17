// 크레딧 확인/차감/환불 헬퍼.
//
// 실제 잔액 증감의 원자성(동시 요청 시 이중 차감 방지)은 Postgres 함수
// (deduct_credit / refund_credit, SQL 마이그레이션 참고)가 담당한다. 이 파일은
// 그 함수를 호출하고 결과를 다루기 쉬운 형태로 감싸는 얇은 래퍼다.
//
// 이 파일은 소스 코드상의 공용 모듈(git으로 버전 관리)이며, 실제 Edge Function은
// 대시보드에 자기완결적 파일 하나로 붙여넣어 배포하는 방식이므로, 이 모듈의
// 내용은 각 Edge Function 소스에 조립되어 포함된다(런타임 import가 아님).
//
// 크레딧 지급 수량(가입 시 선행기술조사 3회 / 명세서작성 1회)은 잠정치다.
// "과제의 해결 수단"/"발명의 효과" 채팅체 혼입 문제(별도 품질개선 작업)로 인한
// 재시도 원가가 아직 불안정하므로, 품질개선 PR 병합 후 실사용 데이터를 보고
// 재조정할 수 있다.

export type CreditType = "prior_art_search" | "spec_drafting";

export interface CreditCheckResult {
  ok: boolean;
  balance: number;
}

// 잔액만 조회한다 (차감 없음). "AI명세서작성" 5단계 파이프라인의 첫 호출(core)에서
// 시작 전 사전 차단용으로 쓴다. 만료된 크레딧은 실제 차감 시 Postgres 함수가
// 걸러내므로, 여기서는 만료 여부와 무관하게 저장된 balance를 그대로 보여줘도
// 실사용(차감)에는 영향이 없다 -- 다만 UI에 보여줄 때 오해를 줄이려면 5번
// (대시보드) 작업에서 만료 표시를 함께 정리한다.
export async function getCreditBalance(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  creditType: CreditType,
): Promise<number> {
  const { data } = await supabase
    .from("user_credits")
    .select("balance, expires_at")
    .eq("user_id", userId)
    .eq("credit_type", creditType)
    .maybeSingle();
  if (!data) return 0;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return 0;
  return data.balance ?? 0;
}

// 크레딧 1개를 원자적으로 차감한다. 잔액 부족(또는 만료)이면 차감하지 않고 ok:false.
export async function deductCredit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  creditType: CreditType,
  refId: string | null,
): Promise<CreditCheckResult> {
  const { data, error } = await supabase.rpc("deduct_credit", {
    p_user_id: userId,
    p_credit_type: creditType,
    p_ref_id: refId,
  });
  if (error || !data || data.length === 0) return { ok: false, balance: 0 };
  return { ok: data[0].ok, balance: data[0].balance };
}

// 사용 실패 시 크레딧 1개를 환불한다 (예: 선행기술조사 시작 후 KIPRIS 검색 자체가
// 실패한 경우). "AI명세서작성"은 재시도를 별도 차감하지 않는 설계라 환불 대상이
// 아니다 -- 애초에 완료 시점에만 1회 차감하기 때문.
export async function refundCredit(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  creditType: CreditType,
  refId: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc("refund_credit", {
    p_user_id: userId,
    p_credit_type: creditType,
    p_ref_id: refId,
  });
  if (error) return 0;
  return data ?? 0;
}
