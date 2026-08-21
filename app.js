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

/* ---- Auth modal open/close/tabs (함수 정의만; 실제 바인딩은 헤더 삽입 후 initHeaderUI에서) ---- */
var authModal = null;

function openAuthModal(mode){
  document.querySelectorAll('.auth-form').forEach(function(f){ f.classList.remove('active'); });
  document.querySelectorAll('.modal-tabs button').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById(mode + '-form').classList.add('active');
  document.querySelector('.modal-tabs button[data-tab="' + mode + '"]').classList.add('active');
  authModal.classList.add('open');
}
function closeAuthModal(){ authModal.classList.remove('open'); }

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

var currentSession = null;

function renderAuthUI(session){
  currentSession = session;
  var actions = document.getElementById('auth-actions');
  // 헤더가 아직 fetch로 삽입되기 전이면 그릴 DOM이 없다. currentSession은 이미
  // 위에서 갱신했으므로, 페이지별 인라인 스크립트가 각자 구독하는 onAuthStateChange가
  // 이 값을 읽어도 안전하다 -- 헤더가 삽입되면 loadHeader()가 이 함수를 다시 불러
  // 실제 UI를 그린다.
  if(!actions) return;
  var hamburgerHTML = '<button class="hamburger" aria-label="메뉴 열기"><span></span><span></span><span></span></button>';
  if(session && session.user){
    actions.innerHTML =
      '<span class="user-info">' +
        '<span class="user-chip">' + session.user.email + '</span>' +
        '<a class="credit-chip" id="credit-chip" href="mypage.html"></a>' +
      '</span>' +
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

// currentSession 갱신은 헤더 삽입 여부와 무관하게 항상 즉시 이뤄져야 한다 --
// prior-art.html/spec-writer.html/blog.html 등 여러 페이지가 각자 자기 자신의
// onAuthStateChange를 별도로 구독해 이 전역값을 읽기 때문에(로그인 게이트 표시 등),
// 헤더 fetch가 끝날 때까지 currentSession 설정이 늦어지면 그 페이지들이 경쟁 상태에
// 빠진다. 그래서 이 구독은 initHeaderUI()가 아니라 여기 최상위에서 즉시 시작하고,
// renderAuthUI 자신은 헤더 DOM이 아직 없으면(위 참고) 그리기만 건너뛴다 -- 헤더가
// 삽입된 뒤 loadHeader()가 renderAuthUI(currentSession)을 한 번 더 호출해 그린다.
if(supabaseClient){
  supabaseClient.auth.onAuthStateChange(function(_event, session){ renderAuthUI(session); });
  supabaseClient.auth.getSession().then(function(res){ renderAuthUI(res.data.session); });
}

/* ---- 헤더/인증모달은 header.html을 fetch로 가져와 삽입한다 (8개 페이지 중복 제거).
   이 DOM에 의존하는 모든 바인딩(햄버거, 드롭다운, 로그인/가입/재설정 폼)은 삽입이
   끝난 뒤 initHeaderUI()에서 한 번에 실행해야 한다 -- 삽입 전에 실행하면 해당
   엘리먼트가 아직 DOM에 없어 조용히 실패한다. ---- */
function initHeaderUI(){
  authModal = document.getElementById('auth-modal');
  bindHamburger();

  // Nav dropdown (예: 인사이트): 데스크톱은 CSS hover/focus-within으로 열리고,
  // 여기 JS는 모바일/터치에서 화살표를 탭했을 때 열고 닫는 것만 담당한다.
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

  document.addEventListener('click', function(e){
    var trigger = e.target.closest('[data-auth-open]');
    if(trigger){ e.preventDefault(); openAuthModal(trigger.dataset.authOpen); }
  });
  document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
  authModal.addEventListener('click', function(e){ if(e.target === authModal) closeAuthModal(); });
  document.querySelectorAll('.modal-tabs button').forEach(function(btn){
    btn.addEventListener('click', function(){ openAuthModal(btn.dataset.tab); });
  });

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

  // 비밀번호 찾기: 로그인 폼 -> 재설정 폼 전환, 재설정 이메일 발송
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

  // 구독은 이미 최상위(스크립트 로드 시점)에서 시작됐으므로 여기서 다시 구독하지
  // 않는다. 다만 그 구독이 헤더 삽입 전에 먼저 발화해 currentSession만 갱신하고
  // DOM은 못 그렸을 수 있으므로, 지금 알고 있는 currentSession으로 한 번 더 그린다.
  renderAuthUI(currentSession);
}

// header.html은 다른 7개 페이지 기준으로 "index.html#..." 절대경로 앵커를 쓴다.
// index.html 자신에서는 그대로 두면 클릭할 때마다 전체 새로고침이 일어나므로,
// 홈페이지에서만 앵커를 상대경로(#...)로 바꿔 매끄러운 스크롤이 되게 한다.
function loadHeader(){
  var root = document.getElementById('site-header-root');
  if(!root) return;
  fetch('header.html').then(function(res){ return res.text(); }).then(function(html){
    var path = window.location.pathname;
    var isHome = path === '/' || /\/?index\.html$/.test(path);
    if(isHome){
      html = html
        .replace('href="index.html" class="logo"', 'href="#top" class="logo"')
        .replace(/href="index\.html#/g, 'href="#');
    }
    root.outerHTML = html;
    initHeaderUI();
  }).catch(function(err){
    console.error('헤더 로드 실패:', err);
  });
}
loadHeader();

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
