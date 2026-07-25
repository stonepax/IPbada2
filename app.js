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

var currentSession = null;

function renderAuthUI(session){
  currentSession = session;
  var actions = document.getElementById('auth-actions');
  var hamburgerHTML = '<button class="hamburger" aria-label="메뉴 열기"><span></span><span></span><span></span></button>';
  if(session && session.user){
    actions.innerHTML =
      '<span class="user-chip">' + session.user.email + '</span>' +
      '<button class="btn btn-ghost" id="logout-btn" type="button">로그아웃</button>' + hamburgerHTML;
    document.getElementById('logout-btn').addEventListener('click', async function(){
      if(supabaseClient) await supabaseClient.auth.signOut();
    });
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

if(supabaseClient){
  supabaseClient.auth.onAuthStateChange(function(_event, session){ renderAuthUI(session); });
  supabaseClient.auth.getSession().then(function(res){ renderAuthUI(res.data.session); });
}
