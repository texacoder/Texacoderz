/* ---------------- Account system (Login / Sign Up / Logout) ----------------
   Talks to this site's own /api/auth/* serverless functions (see
   /api/auth/*.js) — the same relative-path convention as coffee.js.
   Accounts are stored in Postgres (see /lib/db.js); the session is an
   HttpOnly cookie the browser resends automatically, so being logged in
   survives page refreshes and full browser restarts with no client-side
   token storage at all.

   Injects the Login/Sign Up buttons (or the account menu, once signed in)
   into every page's existing #navLinks, and a single shared modal for
   Login / Sign Up / Forgot Password, built once and reused on every page
   that includes this script. */
(function(){
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  /* ---------------- Inject nav auth controls ---------------- */
  const navLinks = document.getElementById('navLinks');
  if(!navLinks) return; // page doesn't have the shared header — nothing to do

  const navAuth = document.createElement('div');
  navAuth.className = 'nav-auth';
  navAuth.id = 'navAuth';
  navAuth.innerHTML = `
    <button type="button" class="btn btn-line" id="navLoginBtn" data-auth="out">Login</button>
    <button type="button" class="btn btn-solid nav-cta" id="navSignupBtn" data-auth="out">Sign Up</button>
    <div class="account-menu" id="accountMenu" data-auth="in" hidden>
      <button type="button" class="account-trigger" id="accountTrigger" aria-haspopup="true" aria-expanded="false">
        <span class="account-avatar" id="accountAvatar">A</span>
        <span class="account-name" id="accountName">Account</span>
      </button>
      <div class="account-dropdown" id="accountDropdown">
        <div class="account-dropdown-email" id="accountDropdownEmail">user@example.com</div>
        <button type="button" class="account-dropdown-logout" id="logoutBtn">Log Out</button>
      </div>
    </div>
  `;
  navLinks.appendChild(navAuth);

  /* ---------------- Inject the auth modal (once per page) ---------------- */
  const modalWrap = document.createElement('div');
  modalWrap.innerHTML = `
    <div class="auth-modal-overlay" id="authModalOverlay" hidden>
      <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
        <button type="button" class="auth-modal-close" id="authModalClose" aria-label="Close">&times;</button>

        <div class="auth-modal-tabs" id="authModalTabs">
          <button type="button" class="auth-tab active" data-auth-tab="login">Login</button>
          <button type="button" class="auth-tab" data-auth-tab="signup">Sign Up</button>
        </div>

        <form class="auth-panel active" id="loginForm" data-auth-panel="login" novalidate>
          <h3 id="authModalTitle" class="auth-panel-title">Welcome back</h3>
          <p class="auth-panel-sub">Log in to your Texacoderzz account.</p>

          <div class="form-group">
            <label class="field-label">EMAIL</label>
            <input type="email" class="text-input" id="loginEmail" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="field-label">PASSWORD</label>
            <input type="password" class="text-input" id="loginPassword" placeholder="••••••••" required autocomplete="current-password">
          </div>

          <button type="button" class="auth-link-btn" id="showForgotBtn">Forgot password?</button>

          <div class="auth-alert" id="loginAlert" hidden></div>

          <button type="submit" class="btn btn-solid btn-block" id="loginSubmitBtn">
            <span class="btn-spinner" aria-hidden="true"></span>
            <span class="btn-label">Log In</span>
          </button>
        </form>

        <form class="auth-panel" id="signupForm" data-auth-panel="signup" novalidate>
          <h3 class="auth-panel-title">Create your account</h3>
          <p class="auth-panel-sub">Join Texacoderzz — it only takes a minute.</p>

          <div class="form-group">
            <label class="field-label">NAME</label>
            <input type="text" class="text-input" id="signupName" placeholder="Your name" required autocomplete="name">
          </div>
          <div class="form-group">
            <label class="field-label">EMAIL</label>
            <input type="email" class="text-input" id="signupEmail" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="field-label">PASSWORD</label>
            <input type="password" class="text-input" id="signupPassword" placeholder="Min. 8 characters" required autocomplete="new-password" minlength="8">
          </div>
          <div class="form-group">
            <label class="field-label">CONFIRM PASSWORD</label>
            <input type="password" class="text-input" id="signupConfirmPassword" placeholder="••••••••" required autocomplete="new-password" minlength="8">
          </div>

          <div class="auth-alert" id="signupAlert" hidden></div>

          <button type="submit" class="btn btn-solid btn-block" id="signupSubmitBtn">
            <span class="btn-spinner" aria-hidden="true"></span>
            <span class="btn-label">Create Account</span>
          </button>
        </form>

        <form class="auth-panel" id="forgotForm" data-auth-panel="forgot" novalidate>
          <h3 class="auth-panel-title">Reset password</h3>
          <p class="auth-panel-sub">Enter your email and we'll send you a reset link.</p>

          <div class="form-group">
            <label class="field-label">EMAIL</label>
            <input type="email" class="text-input" id="forgotEmail" placeholder="you@example.com" required autocomplete="email">
          </div>

          <div class="auth-alert" id="forgotAlert" hidden></div>

          <button type="submit" class="btn btn-solid btn-block" id="forgotSubmitBtn">
            <span class="btn-spinner" aria-hidden="true"></span>
            <span class="btn-label">Send Reset Link</span>
          </button>

          <button type="button" class="auth-link-btn" id="backToLoginBtn">Back to login</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modalWrap.firstElementChild);

  /* ---------------- Element refs ---------------- */
  const overlay = document.getElementById('authModalOverlay');
  const closeBtn = document.getElementById('authModalClose');
  const tabsWrap = document.getElementById('authModalTabs');
  const tabs = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.auth-panel');

  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const forgotForm = document.getElementById('forgotForm');

  const navLoginBtn = document.getElementById('navLoginBtn');
  const navSignupBtn = document.getElementById('navSignupBtn');
  const accountTrigger = document.getElementById('accountTrigger');
  const accountDropdown = document.getElementById('accountDropdown');
  const accountAvatar = document.getElementById('accountAvatar');
  const accountName = document.getElementById('accountName');
  const accountDropdownEmail = document.getElementById('accountDropdownEmail');
  const logoutBtn = document.getElementById('logoutBtn');

  const authInEls = document.querySelectorAll('[data-auth="in"]');
  const authOutEls = document.querySelectorAll('[data-auth="out"]');

  /* ---------------- Modal open/close/tabs ---------------- */
  let lastFocusedEl = null;

  function showPanel(name){
    panels.forEach(p => p.classList.toggle('active', p.getAttribute('data-auth-panel') === name));
    tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-auth-tab') === name));
    tabsWrap.hidden = name === 'forgot';
    clearAllAlerts();
  }

  function openModal(panel){
    lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    showPanel(panel || 'login');
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      const input = overlay.querySelector('.auth-panel.active input');
      if(input) input.focus();
    });
  }

  function closeModal(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 200);
    clearAllAlerts();
    [loginForm, signupForm, forgotForm].forEach(f => {
      f.reset();
      f.querySelectorAll('.form-group.invalid').forEach(g => g.classList.remove('invalid'));
    });
    if(lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus();
  }

  navLoginBtn.addEventListener('click', () => openModal('login'));
  navSignupBtn.addEventListener('click', () => openModal('signup'));
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if(e.target === overlay) closeModal(); });
  window.addEventListener('keydown', e => { if(e.key === 'Escape' && !overlay.hidden) closeModal(); });
  tabs.forEach(tab => tab.addEventListener('click', () => showPanel(tab.getAttribute('data-auth-tab'))));
  document.getElementById('showForgotBtn').addEventListener('click', () => showPanel('forgot'));
  document.getElementById('backToLoginBtn').addEventListener('click', () => showPanel('login'));

  /* ---------------- Account dropdown ---------------- */
  accountTrigger.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = accountDropdown.classList.toggle('open');
    accountTrigger.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', e => {
    if(!document.getElementById('accountMenu').contains(e.target)){
      accountDropdown.classList.remove('open');
      accountTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  /* ---------------- Validation + alert + loading helpers ---------------- */
  function setFieldInvalid(input, invalid){
    const group = input.closest('.form-group');
    if(group) group.classList.toggle('invalid', invalid);
  }
  function validateRequired(input){
    const valid = input.value.trim() !== '';
    setFieldInvalid(input, !valid);
    return valid;
  }
  function validateEmailField(input){
    const valid = input.value.trim() !== '' && validEmail(input.value.trim());
    setFieldInvalid(input, !valid);
    return valid;
  }
  function validateMinLength(input, min){
    const valid = input.value.length >= min;
    setFieldInvalid(input, !valid);
    return valid;
  }
  function validateMatch(input, other){
    const valid = input.value !== '' && input.value === other.value;
    setFieldInvalid(input, !valid);
    return valid;
  }
  document.querySelectorAll('.auth-panel input').forEach(input => {
    input.addEventListener('input', () => {
      const group = input.closest('.form-group');
      if(group && group.classList.contains('invalid')) group.classList.remove('invalid');
    });
  });

  function showAlert(id, text, kind){
    const el = document.getElementById(id);
    el.hidden = false;
    el.className = 'auth-alert ' + kind;
    el.textContent = text;
  }
  function clearAlert(id){
    const el = document.getElementById(id);
    el.hidden = true;
    el.textContent = '';
  }
  function clearAllAlerts(){
    ['loginAlert', 'signupAlert', 'forgotAlert'].forEach(clearAlert);
  }
  function setLoading(btn, on){
    btn.disabled = on;
    btn.classList.toggle('is-loading', on);
  }

  /* ---------------- API calls ---------------- */
  async function postJson(url, body){
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  /* ---------------- Auth state → UI ---------------- */
  function initials(user){
    if(user.name && user.name.trim()){
      const parts = user.name.trim().split(/\s+/);
      return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }
    return (user.email || '?')[0].toUpperCase();
  }

  function renderLoggedIn(user){
    authInEls.forEach(el => { el.hidden = false; });
    authOutEls.forEach(el => { el.hidden = true; });
    accountAvatar.textContent = initials(user);
    accountName.textContent = user.name || user.email;
    accountDropdownEmail.textContent = user.email;
  }

  function renderLoggedOut(){
    authInEls.forEach(el => { el.hidden = true; });
    authOutEls.forEach(el => { el.hidden = false; });
  }

  async function refreshAuthState(){
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if(res.ok){
        const user = await res.json();
        renderLoggedIn(user);
      } else {
        renderLoggedOut();
      }
    } catch {
      renderLoggedOut();
    }
  }

  /* ---------------- Form handlers ---------------- */
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('loginAlert');

    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');
    const validE = validateEmailField(email);
    const validP = validateRequired(password);
    if(!validE || !validP) return;

    const btn = document.getElementById('loginSubmitBtn');
    setLoading(btn, true);
    const { ok, data } = await postJson('/api/auth/login', { email: email.value.trim(), password: password.value });
    setLoading(btn, false);

    if(!ok){
      showAlert('loginAlert', data.error || 'Something went wrong. Please try again.', 'error');
      return;
    }
    renderLoggedIn(data);
    closeModal();
  });

  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('signupAlert');

    const name = document.getElementById('signupName');
    const email = document.getElementById('signupEmail');
    const password = document.getElementById('signupPassword');
    const confirm = document.getElementById('signupConfirmPassword');

    const validN = validateRequired(name);
    const validE = validateEmailField(email);
    const validP = validateMinLength(password, 8);
    const validC = validateMatch(confirm, password);
    if(!validN || !validE || !validP || !validC) return;

    const btn = document.getElementById('signupSubmitBtn');
    setLoading(btn, true);
    const { ok, data } = await postJson('/api/auth/signup', {
      name: name.value.trim(), email: email.value.trim(), password: password.value
    });
    setLoading(btn, false);

    if(!ok){
      // TEMPORARY: appends server debug detail — revert alongside the
      // matching change in api/auth/signup.js once diagnosed.
      const msg = (data.error || 'Something went wrong. Please try again.') + (data.debug ? ' [' + data.debug + ']' : '');
      showAlert('signupAlert', msg, 'error');
      return;
    }
    renderLoggedIn(data);
    closeModal();
  });

  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('forgotAlert');

    const email = document.getElementById('forgotEmail');
    if(!validateEmailField(email)) return;

    const btn = document.getElementById('forgotSubmitBtn');
    setLoading(btn, true);
    const { ok, data } = await postJson('/api/auth/forgot-password', { email: email.value.trim() });
    setLoading(btn, false);

    if(!ok){
      showAlert('forgotAlert', data.error || 'Something went wrong. Please try again.', 'error');
      return;
    }
    showAlert('forgotAlert', data.message || 'If an account exists for that email, a reset link is on its way.', 'success');
  });

  logoutBtn.addEventListener('click', async () => {
    accountDropdown.classList.remove('open');
    accountTrigger.setAttribute('aria-expanded', 'false');
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
    renderLoggedOut();
  });

  refreshAuthState();
})();
