/* Kaj System — AI Studio logic: intake (chat + wizard) -> live AI preview. */
(function () {
  'use strict';
  var CFG = window.KAJ_CONFIG || {};
  var SB = CFG.supabase || {};
  var FN = (SB.url || '') + '/functions/v1/generate-preview';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* Session id (anonymous, per browser) */
  function uuid() {
    try { return crypto.randomUUID(); } catch (e) {}
    return 'sid-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  var sessionId;
  try { sessionId = localStorage.getItem('kaj-sid') || uuid(); localStorage.setItem('kaj-sid', sessionId); }
  catch (e) { sessionId = uuid(); }

  var state = { projectId: null, previewCount: 0, spec: {}, messages: [], currentHtml: '', busy: false };

  /* ---- Options ---- */
  var TYPES = [
    ['E-commerce', 'Storefront, catalogue, checkout'],
    ['SaaS / web app', 'Accounts, dashboard, subscriptions'],
    ['Marketplace', 'Buyers and sellers, listings'],
    ['Booking & services', 'Appointments, calendar, payments'],
    ['Community / content', 'Posts, media, membership'],
    ['Internal tool', 'An operations app your team uses'],
    ['Something else', 'Tell us what you have in mind'],
  ];
  var FEATURES = ['User accounts', 'Online payments', 'Admin dashboard', 'Chat / messaging', 'Push notifications', 'Multiple languages', 'Offline mode', 'AI features', 'Booking / calendar', 'Maps / location', 'Reviews & ratings', 'Analytics'];
  var PLATFORMS = ['Website', 'Mobile app', 'Web + mobile'];
  var STARTERS = [
    'A booking app for a barber shop with deposits and reminders',
    'An online store for handmade jewellery',
    'A delivery app for a local restaurant',
    'A membership app for my church community',
  ];
  var STEP_CATS = ['Business', 'Problem', 'Features', 'Look & feel', 'Contact'];

  /* ---- Toast ---- */
  var toastEl = $('#toast'), toastT;
  function toast(msg, isErr) {
    toastEl.textContent = msg; toastEl.className = 'toast on' + (isErr ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.className = 'toast'; }, 4200);
  }

  /* ---- Backend call ---- */
  function callFn(payload) {
    if (!SB.url) return Promise.reject(new Error('Backend not configured'));
    return fetch(FN, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; })
        .catch(function () { return { ok: r.ok, status: r.status, body: {} }; });
    });
  }

  /* ---- Preview rendering ---- */
  var frame = $('#frame'), iframe = $('#previewFrame'), emptyEl = $('#previewEmpty'),
      loadingEl = $('#previewLoading'), loadingText = $('#loadingText'),
      metaEl = $('#previewMeta'), btnSend = $('#btnSend'), studio = $('#studio');

  function setLoading(on, text) {
    loadingEl.classList.toggle('on', on);
    if (text) loadingText.textContent = text;
  }
  function renderPreview(html, title) {
    state.currentHtml = html;
    iframe.srcdoc = html;
    emptyEl.hidden = true; frame.hidden = false;
    btnSend.disabled = false;
    metaEl.textContent = 'Preview v' + state.previewCount + (title ? ' · ' + title : '');
  }

  function currentTitle() {
    return state.spec.projectName || state.spec.buildType || '';
  }

  var pending = false;
  function generate(opts) {
    if (pending) return;
    opts = opts || {};
    pending = true;
    setLoading(true, opts.loadingText || 'Designing your app…');
    if (window.innerWidth <= 900) studio.classList.add('show-preview');
    return callFn({
      sessionId: sessionId, projectId: state.projectId, previewCount: state.previewCount,
      spec: state.spec, messages: state.messages,
    }).then(function (res) {
      pending = false; setLoading(false);
      var b = res.body || {};
      if (!res.ok || b.error) {
        var msg = b.message || 'Something went wrong generating the preview.';
        if (opts.onError) opts.onError(msg); else toast(msg, true);
        return null;
      }
      if (b.projectId) state.projectId = b.projectId;
      state.previewCount++;
      if (b.previewHtml) renderPreview(b.previewHtml, currentTitle());
      if (opts.onDone) opts.onDone(b);
      return b;
    }).catch(function () {
      pending = false; setLoading(false);
      var m = 'Could not reach the preview engine. Check your connection and try again.';
      if (opts.onError) opts.onError(m); else toast(m, true);
      return null;
    });
  }

  /* ---- Mode toggle ---- */
  var chatView = $('#chatView'), wizardView = $('#wizardView'), wizNav = $('#wizNav');
  function setMode(mode) {
    state.mode = mode;
    $$('#modeToggle button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
    var chat = mode === 'chat';
    chatView.classList.toggle('on', chat);
    wizardView.hidden = chat; wizNav.hidden = chat;
    if (chat) $('#chatInput').focus();
  }
  $$('#modeToggle button').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });

  /* ---- Chat ---- */
  var chatLog = $('#chatLog'), chatForm = $('#chatForm'), chatInput = $('#chatInput'), chatSend = $('#chatSend'),
      startersEl = $('#chatStarters');
  function addMsg(cls, text) {
    var el = document.createElement('div'); el.className = 'msg ' + cls; el.textContent = text;
    chatLog.appendChild(el); chatLog.scrollTop = chatLog.scrollHeight; return el;
  }
  function typingBubble() {
    var el = document.createElement('div'); el.className = 'msg bot typing'; el.innerHTML = '<i></i><i></i><i></i>';
    chatLog.appendChild(el); chatLog.scrollTop = chatLog.scrollHeight; return el;
  }
  function greet() {
    addMsg('bot', "Hi! I'm the Kaj System design assistant. Tell me about the app you'd like — who it's for and what it should do — and I'll design a live preview you can see on the right. What are we building?");
    startersEl.innerHTML = '';
    STARTERS.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = s;
      b.addEventListener('click', function () { chatInput.value = s; sendChat(); });
      startersEl.appendChild(b);
    });
  }
  function sendChat() {
    var text = chatInput.value.trim(); if (!text || pending) return;
    startersEl.innerHTML = '';
    addMsg('user', text);
    state.messages.push({ role: 'user', content: text });
    if (!state.spec.buildType && !state.spec.problem) state.spec.problem = text;
    chatInput.value = ''; autosize();
    chatSend.disabled = true;
    var typing = typingBubble();
    generate({
      loadingText: 'Designing your preview…',
      onDone: function (b) {
        typing.remove(); chatSend.disabled = false;
        var m = b.assistantMessage || 'Here is an updated preview — tell me what to change.';
        addMsg('bot', m); state.messages.push({ role: 'assistant', content: m });
      },
      onError: function (msg) { typing.remove(); chatSend.disabled = false; addMsg('bot', msg); },
    });
  }
  chatForm.addEventListener('submit', function (e) { e.preventDefault(); sendChat(); });
  function autosize() { chatInput.style.height = 'auto'; chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px'; }
  chatInput.addEventListener('input', autosize);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  /* ---- Wizard ---- */
  var STEP = 0, STEPS = 5;
  var progress = $('#progress'), stepNum = $('#stepNum'), stepCat = $('#stepCat'),
      wizBack = $('#wizBack'), wizNext = $('#wizNext');
  for (var i = 0; i < STEPS; i++) { var d = document.createElement('i'); progress.appendChild(d); }
  var progBars = $$('#progress i');

  // Build type cards
  var typeCards = $('#typeCards');
  TYPES.forEach(function (t) {
    var c = document.createElement('button'); c.type = 'button'; c.className = 'opt-card';
    c.innerHTML = '<div><b></b><span></span></div><i class="rc"></i>';
    $('b', c).textContent = t[0]; $('span', c).textContent = t[1];
    c.addEventListener('click', function () {
      $$('#typeCards .opt-card').forEach(function (x) { x.classList.remove('sel'); });
      c.classList.add('sel'); state.spec.buildType = t[0];
    });
    typeCards.appendChild(c);
  });
  // Feature chips
  var featChips = $('#featureChips'); state.spec.features = [];
  FEATURES.forEach(function (f) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = f;
    b.addEventListener('click', function () {
      var i = state.spec.features.indexOf(f);
      if (i >= 0) { state.spec.features.splice(i, 1); b.classList.remove('sel'); }
      else { state.spec.features.push(f); b.classList.add('sel'); }
    });
    featChips.appendChild(b);
  });
  // Platform chips (single-select)
  var platChips = $('#platformChips');
  PLATFORMS.forEach(function (p) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = p; b.style.setProperty('--x', 0);
    b.addEventListener('click', function () {
      $$('#platformChips button').forEach(function (x) { x.classList.remove('sel'); });
      b.classList.add('sel'); state.spec.platform = p;
    });
    platChips.appendChild(b);
  });

  function showStep(n) {
    STEP = Math.max(0, Math.min(STEPS - 1, n));
    $$('.wiz-step').forEach(function (s) { s.classList.toggle('on', +s.dataset.step === STEP); });
    progBars.forEach(function (b, i) { b.classList.toggle('done', i <= STEP); });
    stepNum.textContent = 'Step ' + (STEP + 1) + ' / ' + STEPS;
    stepCat.textContent = STEP_CATS[STEP];
    wizBack.style.visibility = STEP === 0 ? 'hidden' : 'visible';
    wizNext.innerHTML = STEP === STEPS - 1
      ? 'Send to Kaj System <svg><use href="#i-arrow"/></svg>'
      : (STEP === 3 ? 'Generate preview <svg><use href="#i-spark"/></svg>' : 'Continue <svg><use href="#i-arrow"/></svg>');
    $('#wizardView').scrollTop = 0;
  }
  function collectStep() {
    if (STEP === 0) state.spec.projectName = $('#w-name').value.trim();
    if (STEP === 1) state.spec.problem = $('#w-problem').value.trim();
    if (STEP === 3) state.spec.brand = $('#w-brand').value.trim();
  }
  function validateStep() {
    if (STEP === 0 && !state.spec.buildType) { toast('Pick what you’re building first.', true); return false; }
    if (STEP === 1 && !$('#w-problem').value.trim()) { toast('A sentence about the problem helps a lot.', true); return false; }
    return true;
  }
  wizBack.addEventListener('click', function () { collectStep(); showStep(STEP - 1); });
  wizNext.addEventListener('click', function () {
    collectStep();
    if (!validateStep()) return;
    if (STEP === 3) { // generate preview, then advance to contact
      showStep(4);
      generate({ loadingText: 'Designing your app…' });
      return;
    }
    if (STEP === STEPS - 1) { // contact -> send
      state.spec.contactName = $('#w-cname').value.trim();
      state.spec.contactEmail = $('#w-cemail').value.trim();
      state.spec.contactPhone = $('#w-cphone').value.trim();
      openSend(true);
      return;
    }
    showStep(STEP + 1);
  });

  /* ---- Preview tools ---- */
  $$('#deviceSeg button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#deviceSeg button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      frame.className = 'frame ' + b.dataset.device;
    });
  });
  $('#btnRegen').addEventListener('click', function () {
    if (!state.messages.length && !state.spec.buildType && !state.spec.problem) { toast('Describe your app first.', true); return; }
    generate({ loadingText: 'Redesigning your preview…' });
  });
  $('#btnOpen').addEventListener('click', function () {
    if (!state.currentHtml) { toast('No preview yet.', true); return; }
    try { var url = URL.createObjectURL(new Blob([state.currentHtml], { type: 'text/html' })); window.open(url, '_blank'); }
    catch (e) { toast('Could not open preview.', true); }
  });
  $('#btnBackIntake').addEventListener('click', function () { studio.classList.remove('show-preview'); });

  /* ---- Send modal ---- */
  var modal = $('#sendModal');
  function openSend(prefill) {
    if (!state.projectId) { toast('Generate a preview first so we have something to send.', true); return; }
    if (prefill) {
      $('#m-name').value = state.spec.contactName || '';
      $('#m-email').value = state.spec.contactEmail || '';
      $('#m-phone').value = state.spec.contactPhone || '';
    }
    $('#sendForm').hidden = false; $('#sendOk').hidden = true;
    modal.classList.add('on');
  }
  btnSend.addEventListener('click', function () { openSend(true); });
  $('#mCancel').addEventListener('click', function () { modal.classList.remove('on'); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('on'); });
  $('#mSubmit').addEventListener('click', function () {
    var name = $('#m-name').value.trim(), email = $('#m-email').value.trim(), phone = $('#m-phone').value.trim();
    if (!name || (!email && !phone)) { toast('Add your name and an email or phone.', true); return; }
    var btn = $('#mSubmit'); btn.disabled = true; btn.textContent = 'Sending…';
    callFn({ action: 'submit', sessionId: sessionId, projectId: state.projectId, contact: { name: name, email: email, phone: phone } })
      .then(function (res) {
        btn.disabled = false; btn.innerHTML = 'Send project';
        if (res.ok && res.body && res.body.ok) { $('#sendForm').hidden = true; $('#sendOk').hidden = false; }
        else { toast((res.body && res.body.message) || 'Could not send — please try again.', true); }
      })
      .catch(function () { btn.disabled = false; btn.textContent = 'Send project'; toast('Could not send — please try again.', true); });
  });

  /* ---- Init ---- */
  if (!SB.url) {
    toast('The AI studio backend is not configured yet.', true);
  }
  // Deep-link ?mode=form
  var qs = new URLSearchParams(location.search);
  greet();
  showStep(0);
  setMode(qs.get('mode') === 'form' ? 'form' : 'chat');
})();
