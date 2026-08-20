/* ---- Shared helpers ---- */
function escapeHtml(str){
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ---- UI bindings run first and unconditionally, independent of Supabase ---- */
function bindHamburger(){
  var h = document.querySelector('.hamburger');
  if(!h) return;
  h.addEventListener('click', function(){
    var nav = document.querySelector('.main-nav');
    var isOpen = nav.style.display === 'flex';
    nav.style.display = isOpen ? 'none' : 'flex';
    nav.style.flexDirection = 'column';
    nav.style.position = 'absolute';
    nav.style.top = '64px';
    nav.style.left = '0';
    nav.style.right = '0';
    nav.style.background = '#fff';
    nav.style.padding = '16px 24px';
    nav.style.borderBottom = '1px solid var(--border)';
    nav.style.gap = '16px';
  });
}
bindHamburger();

/* ---- Nav dropdown (예: 인사이트): 데스크톱은 CSS hover/focus-within으로 열리고,
   여기 JS는 모바일/터치에서 화살표를 탭했을 때 열고 닫는 것만 담당한다 ---- */
document.querySelectorAll('.dropdown-toggle').forEach(function(btn){
  btn.addEventListener('click', function(e){
    e.preventDefault();
    e.stopPropagation();
    var item = btn.closest('.nav-item');
    var willOpen = !item.classList.contains('open');
    document.querySelectorAll('.nav-item.open').forEach(function(openItem){
      openItem.classList.remove('open');
      var openBtn = openItem.querySelector('.dropdown-toggle');
      if(openBtn) openBtn.setAttribute('aria-expanded', 'false');
    });
    item.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
  });
});
document.addEventListener('click', function(e){
  if(e.target.closest('.nav-item')) return;
  document.querySelectorAll('.nav-item.open').forEach(function(item){
    item.classList.remove('open');
    var btn = item.querySelector('.dropdown-toggle');
    if(btn) btn.setAttribute('aria-expanded', 'false');
  });
});

/* ---- Make whole service cards clickable, not just the "자세히 보기" link ---- */
document.querySelectorAll('.card').forEach(function(card){
  var link = card.querySelector('.card-link');
  if(!link) return;
  card.style.cursor = 'pointer';
  card.addEventListener('click', function(e){
    if(e.target.closest('a')) return;
    var href = link.getAttribute('href');
    if(href.charAt(0) === '#'){
      var target = document.querySelector(href);
      if(target) target.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = href;
    }
  });
});

/* ---- Auth modal open/close/tabs ---- */
var authModal = document.getElementById('auth-modal');

function openAuthModal(mode){
  document.querySelectorAll('.auth-form').forEach(function(f){ f.classList.remove('active'); });
  document.querySelectorAll('.modal-tabs button').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById(mode + '-form').classList.add('active');
  document.querySelector('.modal-tabs button[data-tab="' + mode + '"]').classList.add('active');
  authModal.classList.add('open');
}
function closeAuthModal(){ authModal.classList.remove('open'); }

document.addEventListener('click', function(e){
  var trigger = e.target.closest('[data-auth-open]');
  if(trigger){ e.preventDefault(); openAuthModal(trigger.dataset.authOpen); }
});
document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
authModal.addEventListener('click', function(e){ if(e.target === authModal) closeAuthModal(); });
document.querySelectorAll('.modal-tabs button').forEach(function(btn){
  btn.addEventListener('click', function(){ openAuthModal(btn.dataset.tab); });
});

/* ---- Supabase client: guarded init so a blocked/failed CDN load never breaks the page above ---- */
var SUPABASE_URL = 'https://guofrvaebojjalmidoxg.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_5cc3UHFZCe-BgCuiBZO64Q_12OI7yQc';
var ADMIN_EMAIL = 'stonepax@gmail.com';
var supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch(err) {
  console.error('Supabase 초기화 실패:', err);
}

/* ---- Supabase Auth: login / signup / logout ---- */
document.getElementById('login-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var msg = document.getElementById('login-msg');
  if(!supabaseClient){ msg.textContent = '서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'; msg.className = 'auth-msg error'; return; }
  msg.textContent = '로그인 중...'; msg.className = 'auth-msg';
  var email = e.target.email.value, password = e.target.password.value;
  var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  if(result.error){ msg.textContent = result.error.message; msg.className = 'auth-msg error'; }
  else { msg.textContent = '로그인 성공!'; msg.className = 'auth-msg success'; setTimeout(closeAuthModal, 800); }
});

document.getElementById('signup-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var msg = document.getElementById('signup-msg');
  if(!supabaseClient){ msg.textContent = '서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'; msg.className = 'auth-msg error'; return; }
  msg.textContent = '가입 처리 중...'; msg.className = 'auth-msg';
  var email = e.target.email.value, password = e.target.password.value;
  var result = await supabaseClient.auth.signUp({ email: email, password: password });
  if(result.error){ msg.textContent = result.error.message; msg.className = 'auth-msg error'; }
  else { msg.textContent = '가입 완료! 이메일을 확인해주세요.'; msg.className = 'auth-msg success'; }
});

/* ---- 비밀번호 찾기: 로그인 폼 -> 재설정 폼 전환, 재설정 이메일 발송 ---- */
document.getElementById('forgot-password-toggle').addEventListener('click', function(e){
  e.preventDefault();
  document.querySelectorAll('.auth-form').forEach(function(f){ f.classList.remove('active'); });
  document.querySelectorAll('.modal-tabs button').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('reset-form').classList.add('active');
});

document.getElementById('back-to-login-toggle').addEventListener('click', function(e){
  e.preventDefault();
  openAuthModal('login');
});

document.getElementById('reset-form').addEventListener('submit', async function(e){
  e.preventDefault();
  var msg = document.getElementById('reset-msg');
  if(!supabaseClient){ msg.textContent = '서비스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'; msg.className = 'auth-msg error'; return; }
  msg.textContent = '전송 중...'; msg.className = 'auth-msg';
  var email = e.target.email.value;
  var result = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });
  if(result.error){ msg.textContent = result.error.message; msg.className = 'auth-msg error'; }
  else { msg.textContent = '이메일로 재설정 링크를 보냈습니다. 메일함을 확인해주세요.'; msg.className = 'auth-msg success'; }
});

var currentSession = null;

function renderAuthUI(session){
  currentSession = session;
  var actions = document.getElementById('auth-actions');
  var hamburgerHTML = '<button class="hamburger" aria-label="메뉴 열기"><span></span><span></span><span></span></button>';
  if(session && session.user){
    actions.innerHTML =
      '<span class="user-chip">' + session.user.email + '</span>' +
      '<span class="credit-chip" id="credit-chip"></span>' +
      '<button class="btn btn-ghost" id="logout-btn" type="button">로그아웃</button>' + hamburgerHTML;
    document.getElementById('logout-btn').addEventListener('click', async function(){
      if(supabaseClient) await supabaseClient.auth.signOut();
    });
    renderCreditChip(session);
  } else {
    actions.innerHTML =
      '<a class="btn btn-ghost" href="#login" data-auth-open="login">로그인</a>' +
      '<a class="btn btn-primary" href="#signup" data-auth-open="signup">무료 회원가입</a>' + hamburgerHTML;
  }
  bindHamburger();

  // Admin-only upload panel toggle: only present on resources.html, so guard existence.
  var isAdmin = !!(session && session.user && session.user.email === ADMIN_EMAIL);
  var uploadToggle = document.getElementById('admin-upload-toggle');
  if(uploadToggle){
    uploadToggle.style.display = isAdmin ? 'inline-block' : 'none';
    if(!isAdmin){
      var panel = document.getElementById('admin-upload-panel');
      if(panel) panel.style.display = 'none';
    }
  }
}

// 헤더에 잔여 크레딧을 표시한다. 관리자는 무제한이라 조회 없이 바로 표시하고,
// 일반 회원은 user_credits를 본인 것만 읽어온다(RLS "본인 크레딧 조회" 정책).
// 만료된 크레딧은 DB에 저장된 balance가 남아있어도 0으로 취급한다 -- 실제
// 차감 로직(Postgres 함수 deduct_credit)도 만료 여부를 같은 방식으로 걸러낸다.
async function renderCreditChip(session){
  var chip = document.getElementById('credit-chip');
  if(!chip || !supabaseClient) return;
  if(session.user.email === ADMIN_EMAIL){
    chip.textContent = '크레딧 무제한';
    return;
  }
  var result = await supabaseClient.from('user_credits')
    .select('credit_type, balance, expires_at')
    .eq('user_id', session.user.id);
  if(result.error || !result.data || result.data.length === 0){ chip.textContent = ''; return; }

  var search = result.data.find(function(r){ return r.credit_type === 'prior_art_search'; });
  var spec = result.data.find(function(r){ return r.credit_type === 'spec_drafting'; });
  var expiresAt = (search && search.expires_at) || (spec && spec.expires_at) || null;
  var expired = !!(expiresAt && new Date(expiresAt).getTime() < Date.now());
  var searchBalance = (search && !expired) ? search.balance : 0;
  var specBalance = (spec && !expired) ? spec.balance : 0;

  var text = '선행기술조사 ' + searchBalance + '회 · 명세서작성 ' + specBalance + '회 남음';
  if(expired){
    text += ' (만료됨)';
  } else if(expiresAt){
    var daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000)));
    text += ' (' + daysLeft + '일 후 만료)';
  }
  chip.textContent = text;
}

if(supabaseClient){
  supabaseClient.auth.onAuthStateChange(function(_event, session){ renderAuthUI(session); });
  supabaseClient.auth.getSession().then(function(res){ renderAuthUI(res.data.session); });
}

/* ---- 선행기술조사 공용 헬퍼 (prior-art.html / spec-writer.html이 함께 사용) ----
   KIPRIS/Voyage/Claude 파이프라인은 Edge Function "prior-art-search" 하나에만 있고,
   여기 있는 건 그 함수를 호출해서 결과를 카드로 그려주는 프론트엔드 공통 로직이다. ---- */
function paFormatDate(raw){
  if(!raw) return '';
  var d = new Date(raw);
  if(isNaN(d.getTime())) return raw;
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '.' + mm + '.' + dd;
}

function paRelevanceLabel(score){
  if(score === null || score === undefined) return '-';
  return Math.round(score * 100) + '%';
}

// opts.showStartSpecButton: true면 각 카드에 "이 특허 기준으로 명세서 작성 시작" 버튼을 붙인다
function renderPriorArtCards(results, opts){
  opts = opts || {};
  return results.map(function(r){
    var note = r.ai_similarity_note
      ? '<p class="pa-note">' + escapeHtml(r.ai_similarity_note) + '</p>'
      : '<p class="pa-note pa-note-loading"><span class="spinner spinner-sm"></span>AI 유사점·차이점 분석 중...</p>';
    var specBtn = opts.showStartSpecButton
      ? '<button type="button" class="btn btn-dark start-spec-btn" data-result-id="' + r.id + '" style="margin-top:10px;">이 특허 기준으로 명세서 작성 시작 →</button>'
      : '';
    return '' +
      '<div class="resource-card pa-card">' +
        '<div class="badges"><span class="resource-badge">관련도 ' + paRelevanceLabel(r.relevance_score) + '</span></div>' +
        '<h4>' + escapeHtml(r.title || '(제목 없음)') + '</h4>' +
        '<p style="font-size:12.5px;color:var(--muted);">출원인: ' + escapeHtml(r.applicant || '정보 없음') + (r.filing_date ? ' · 출원일: ' + paFormatDate(r.filing_date) : '') + '</p>' +
        (r.application_number ? '<p style="font-size:12.5px;color:var(--muted);">출원번호: <strong style="color:var(--text);user-select:all;">' + escapeHtml(r.application_number) + '</strong></p>' : '') +
        note +
        (r.kipris_url ? '<a class="dl" href="' + escapeHtml(r.kipris_url) + '" target="_blank" rel="noopener">KIPRIS 특허검색 열기 → (출원번호를 검색창에 붙여넣어주세요)</a>' : '') +
        specBtn +
      '</div>';
  }).join('');
}

// "prior-art-search" Edge Function의 start -> summarize(반복) 흐름을 캡슐화.
// projectId를 넘기면 prior_art_searches.project_id에 저장되어 나중에 이 검색이
// 어느 명세서 작성 프로젝트에서 시작됐는지 추적할 수 있다 (없어도 정상 동작).
async function runPriorArtSearch(queryText, projectId, callbacks){
  callbacks = callbacks || {};
  var startResult;
  try {
    startResult = await supabaseClient.functions.invoke('prior-art-search', {
      body: { action: 'start', query_text: queryText, project_id: projectId || null }
    });
  } catch(err) {
    if(callbacks.onError) callbacks.onError('검색 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    return null;
  }
  var data = startResult.data;
  if(startResult.error || !data || data.error){
    var msg = (data && data.error) ? data.error : '검색에 실패했습니다. 잠시 후 다시 시도해주세요.';
    if(data && data.credit_exhausted) msg = '보유하신 선행기술조사 크레딧을 모두 사용하셨습니다. 유료 전환은 현재 준비 중입니다.';
    if(callbacks.onError) callbacks.onError(msg, !!(data && data.credit_exhausted));
    return null;
  }
  if(callbacks.onStart) callbacks.onStart(data);

  var searchId = data.search_id;
  function poll(){
    supabaseClient.functions.invoke('prior-art-search', {
      body: { action: 'summarize', search_id: searchId }
    }).then(function(result){
      if(result.error) return;
      var updData = result.data;
      if(callbacks.onUpdate) callbacks.onUpdate(updData);
      if(!updData.done){
        setTimeout(poll, 800);
      } else if(callbacks.onDone) {
        callbacks.onDone();
      }
    }).catch(function(){});
  }
  poll();
  return data;
}
