/* Kaj System – site behaviour: theme, language, nav, estimator, contact form. */
(function () {
  'use strict';
  var CFG = window.KAJ_CONFIG || {};
  var I18N = window.KAJ_I18N || { langs: { en: 'English' }, en: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* Theme ---------------------------------------------------------------- */
  var root = document.documentElement;
  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var sun = $('#themeBtn .ic-sun'), moon = $('#themeBtn .ic-moon');
    if (sun && moon) { sun.hidden = t === 'dark'; moon.hidden = t !== 'dark'; }
  }
  applyTheme(root.getAttribute('data-theme') || 'light');
  var themeBtn = $('#themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    store.set('kaj-theme', next); applyTheme(next);
  });

  /* Language ------------------------------------------------------------- */
  var langs = Object.keys(I18N.langs || { en: 1 });
  function pickLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q && I18N[q]) return q;
    var saved = store.get('kaj-lang');
    if (saved && I18N[saved]) return saved;
    var nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[nav] ? nav : 'en';
  }
  var lang = pickLang();
  function t(key) {
    var d = I18N[lang] || {}, e = I18N.en || {};
    return d[key] != null ? d[key] : (e[key] != null ? e[key] : key);
  }
  function applyLang(l) {
    lang = l; store.set('kaj-lang', l); root.lang = l;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-ph]').forEach(function (el) { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    document.title = t('meta.title');
    var md = $('meta[name="description"]'); if (md) md.content = t('meta.description');
    $$('.lang-switch button').forEach(function (b) { b.classList.toggle('active', b.dataset.lang === l); });
    renderEstimate();
    renderTestimonials();
  }
  $$('.lang-switch').forEach(function (sw) {
    langs.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button'; b.dataset.lang = l; b.textContent = l.toUpperCase();
      b.setAttribute('aria-label', I18N.langs[l]);
      b.addEventListener('click', function () { applyLang(l); });
      sw.appendChild(b);
    });
  });

  /* Nav ------------------------------------------------------------------ */
  var nav = $('#nav'), toggle = $('#navToggle'), mobile = $('#navMobile');
  function onScroll() { if (nav) nav.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  function setMenu(open) {
    if (!toggle || !mobile) return;
    mobile.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    $('.ic-open', toggle).hidden = open; $('.ic-close', toggle).hidden = !open;
  }
  if (toggle) toggle.addEventListener('click', function () { setMenu(!mobile.classList.contains('open')); });
  if (mobile) $$('a', mobile).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // Highlight the section in view.
  var sections = $$('main section[id]');
  var navAnchors = $$('.nav-links a');
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navAnchors.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* Reveal on scroll ----------------------------------------------------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Marquee -------------------------------------------------------------- */
  var marquee = $('#marquee');
  if (marquee) {
    var items = ['iOS', 'Android', 'Web & PWA', 'React', 'TypeScript', 'Firebase', 'Supabase', 'Stripe', 'AI assistants', 'Push notifications', 'Offline-first', 'Cloudflare'];
    var html = items.map(function (i) { return '<span>' + i + '</span>'; }).join('');
    marquee.innerHTML = html + html; // duplicate for a seamless loop
  }

  /* Animated counters ---------------------------------------------------- */
  var counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        co.unobserve(en.target);
        var el = en.target, target = parseInt(el.getAttribute('data-count'), 10) || 0, start = null, dur = 1100;
        function tick(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(eased * target));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  }

  /* Cursor glow (fine pointers only) ------------------------------------- */
  var glow = $('#cursorGlow');
  if (glow && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    window.addEventListener('pointermove', function (e) {
      glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; glow.classList.add('on');
    }, { passive: true });
  }

  /* Subtle 3D tilt on the hero card -------------------------------------- */
  var tilt = $('#tilt');
  if (tilt && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion) {
    var wrap = tilt.parentElement;
    wrap.addEventListener('pointermove', function (e) {
      var r = wrap.getBoundingClientRect();
      var rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
      var ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
      tilt.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
    });
    wrap.addEventListener('pointerleave', function () { tilt.style.transform = ''; });
  }

  /* Config-driven bits --------------------------------------------------- */
  var cur = CFG.currency || { symbol: '$' };
  function money(n) {
    n = Math.round(n / 10) * 10;
    return cur.symbol + n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
  }
  var P = CFG.pricing || {};
  $$('[data-price]').forEach(function (el) { var k = el.getAttribute('data-price'); if (P[k] != null) el.textContent = money(P[k]); });

  var C = CFG.contact || {};
  var yr = $('#year'); if (yr) yr.textContent = String(new Date().getFullYear());
  if (C.email) {
    var le = $('#linkEmail'); if (le) { le.href = 'mailto:' + C.email; $('#emailText').textContent = C.email; }
    var fe = $('#footerEmail'); if (fe) { fe.innerHTML = '<a href="mailto:' + C.email + '">' + C.email + '</a>'; }
  }
  var waUrl = C.whatsapp ? 'https://wa.me/' + String(C.whatsapp).replace(/\D/g, '') : '';
  if (waUrl) {
    var lw = $('#linkWa'); if (lw) { lw.href = waUrl; lw.hidden = false; $('#waText').textContent = '+' + String(C.whatsapp).replace(/\D/g, ''); }
    var fab = $('#waFab'); if (fab) { fab.href = waUrl; fab.hidden = false; }
  }
  if (C.bookingUrl) {
    var lb = $('#linkBook'); if (lb) { lb.href = C.bookingUrl; lb.hidden = false; $('#bookText').textContent = C.bookingUrl.replace(/^https?:\/\//, ''); }
  }
  var loc = $('#locText'); if (loc) loc.textContent = C.location || '';

  var S = CFG.social || {};
  var socials = $('#socials');
  if (socials) {
    [['linkedin', 'i-in', 'LinkedIn'], ['twitter', 'i-tw', 'X / Twitter'], ['instagram', 'i-ig', 'Instagram'], ['github', 'i-gh', 'GitHub']].forEach(function (s) {
      if (!S[s[0]]) return;
      var a = document.createElement('a');
      a.href = S[s[0]]; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', s[2]);
      a.innerHTML = '<svg><use href="#' + s[1] + '"/></svg>';
      socials.appendChild(a);
    });
  }

  function renderTestimonials() {
    var list = CFG.testimonials || [], sec = $('#testimonials'), grid = $('#testiGrid');
    if (!sec || !grid) return;
    if (!list.length) { sec.hidden = true; return; }
    sec.hidden = false; grid.innerHTML = '';
    list.forEach(function (q) {
      var el = document.createElement('article'); el.className = 'card quote reveal in';
      var initials = q.avatar || (q.name || '?').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      el.innerHTML = '<div class="stars" aria-hidden="true">★★★★★</div><p></p><div class="who"><i></i><div><b></b><span></span></div></div>';
      $('p', el).textContent = '“' + (q.quote || '') + '”';
      $('.who i', el).textContent = initials; $('.who b', el).textContent = q.name || ''; $('.who span', el).textContent = q.role || '';
      grid.appendChild(el);
    });
  }

  /* Estimator ------------------------------------------------------------ */
  var E = CFG.estimator || {};
  var estForm = $('#estimator');
  var estimate = null;
  // Pure pricing helper shared by the estimator and the AI intake chat.
  function estimateFrom(platform, addons, rush) {
    if (!E.base || !E.base[platform]) return null;
    var base = E.base[platform];
    var price = base.price, weeks = base.weeks;
    (addons || []).forEach(function (k) {
      var a = (E.addons || {})[k]; if (!a) return;
      price += a.price; weeks += a.weeks;
    });
    if (rush && E.rush) { price *= E.rush.price; weeks *= E.rush.weeks; }
    var spread = E.spread || 0.15;
    return {
      platform: platform, addons: (addons || []).slice(), rush: !!rush,
      low: price * (1 - spread), high: price * (1 + spread),
      weeksLow: Math.max(1, Math.round(weeks)), weeksHigh: Math.max(1, Math.round(weeks * 1.25)),
    };
  }
  function computeEstimate() {
    if (!estForm || !E.base) return null;
    var platform = (estForm.querySelector('input[name="platform"]:checked') || {}).value || 'webapp';
    var addons = $$('input[name="addon"]:checked', estForm).map(function (cb) { return cb.value; });
    var rush = (estForm.querySelector('input[name="speed"]:checked') || {}).value === 'rush';
    return estimateFrom(platform, addons, rush);
  }
  function renderEstimate() {
    estimate = computeEstimate();
    if (!estimate) return;
    $('#estPrice').textContent = money(estimate.low) + ' – ' + money(estimate.high);
    var w = estimate.weeksLow === estimate.weeksHigh ? String(estimate.weeksLow) : estimate.weeksLow + ' – ' + estimate.weeksHigh;
    $('#estWeeks').textContent = w + ' ' + t('est.weeksUnit');
    var tally = $('#estTally'); tally.innerHTML = '';
    var rows = [[t('est.p.' + estimate.platform), money(E.base[estimate.platform].price)]];
    estimate.addons.forEach(function (a) { rows.push(['+ ' + t('est.a.' + a), money(E.addons[a].price)]); });
    if (estimate.rush) rows.push([t('est.t.rush'), '×' + E.rush.price]);
    rows.forEach(function (r) {
      var d = document.createElement('div'); d.innerHTML = '<span></span><span></span>';
      d.children[0].textContent = r[0]; d.children[1].textContent = r[1]; tally.appendChild(d);
    });
  }
  if (estForm) { estForm.addEventListener('change', renderEstimate); }

  function summarizeEstimate() {
    if (!estimate) return '';
    var lines = [t('est.p.' + estimate.platform)];
    estimate.addons.forEach(function (a) { lines.push('+ ' + t('est.a.' + a)); });
    if (estimate.rush) lines.push(t('est.t.rush'));
    lines.push(t('est.result') + ': ' + money(estimate.low) + ' – ' + money(estimate.high));
    lines.push(t('est.weeks') + ': ' + $('#estWeeks').textContent);
    return lines.join('\n');
  }
  var estSend = $('#estSend');
  if (estSend) estSend.addEventListener('click', function () {
    var type = $('#f-type'), msg = $('#f-msg');
    if (type && estimate) type.value = estimate.platform;
    if (msg && estimate) {
      var summary = summarizeEstimate();
      msg.value = (msg.value && msg.value.indexOf(summary) === -1 ? msg.value + '\n\n' : '') + summary + '\n\n';
      var budget = $('#f-budget');
      if (budget) {
        var mid = (estimate.low + estimate.high) / 2;
        budget.value = mid < 1000 ? '<1000' : mid < 3000 ? '1000-3000' : mid < 8000 ? '3000-8000' : '>8000';
      }
      setTimeout(function () { msg.focus(); }, 600);
    }
  });

  // "Choose this package" buttons preselect the project type.
  $$('[data-plan]').forEach(function (a) {
    a.addEventListener('click', function () { var type = $('#f-type'); if (type) type.value = a.getAttribute('data-plan'); });
  });

  /* Contact form --------------------------------------------------------- */
  var form = $('#contactForm'), status = $('#formStatus'), submitBtn = $('#submitBtn');
  function showStatus(kind, text) { status.hidden = false; status.className = 'form-status ' + kind; status.textContent = text; }
  if (form) form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var data = new FormData(form);
    if (data.get('_gotcha')) return; // bot
    var payload = {
      name: data.get('name'), email: data.get('email'), phone: data.get('phone'),
      project: data.get('project'), budget: data.get('budget'), message: data.get('message'),
      language: lang, page: location.href,
    };
    var endpoint = C.formEndpoint;
    if (!endpoint) {
      // No backend configured: open the visitor's email client with everything filled in.
      var body = Object.keys(payload).map(function (k) { return k + ': ' + payload[k]; }).join('\n');
      location.href = 'mailto:' + (C.email || '') + '?subject=' + encodeURIComponent('Project request – ' + payload.name) + '&body=' + encodeURIComponent(body);
      showStatus('ok', t('contact.success'));
      return;
    }
    submitBtn.disabled = true; var label = $('span', submitBtn); var old = label.textContent; label.textContent = t('contact.sending');
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); showStatus('ok', t('contact.success')); form.reset(); })
      .catch(function () { showStatus('err', t('contact.error') + ' ' + (C.email || '')); })
      .then(function () { submitBtn.disabled = false; label.textContent = old; });
  });

  /* Intake panel toggle (Fill the form / Talk it through) ---------------- */
  var intakeToggle = $('#intakeToggle');
  var panels = $$('.contact .panel');
  var chatStarted = false;
  function showPanel(which) {
    panels.forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== which; });
    if (intakeToggle) $$('button', intakeToggle).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-panel') === which); });
    if (which === 'chat' && !chatStarted) { chatStarted = true; startChat(); }
  }
  if (intakeToggle) {
    $$('button', intakeToggle).forEach(function (b) {
      b.addEventListener('click', function () { showPanel(b.getAttribute('data-panel')); });
    });
  }

  /* AI intake chat ------------------------------------------------------- */
  var chatLog = $('#chatLog'), chatQuick = $('#chatQuick'), chatInputForm = $('#chatInputForm'), chatInput = $('#chatInput');
  var brief = { platform: '', about: '', features: [], timeline: '', budget: '', name: '', reach: '' };

  // Conversation script. Each step: a question, an input mode and (for chips) options.
  function steps() {
    return [
      { key: 'platform', q: 'ai.q.platform', mode: 'single',
        options: [['website', 'est.p.website'], ['webapp', 'est.p.webapp'], ['mobile', 'est.p.mobile'], ['system', 'contact.type.system'], ['other', 'contact.type.other']] },
      { key: 'about', q: 'ai.q.about', mode: 'text' },
      { key: 'features', q: 'ai.q.features', mode: 'multi', done: 'ai.featuresDone',
        options: [['accounts', 'est.a.accounts'], ['payments', 'est.a.payments'], ['admin', 'est.a.admin'], ['chat', 'est.a.chat'], ['push', 'est.a.push'], ['i18n', 'est.a.i18n'], ['offline', 'est.a.offline'], ['ai', 'est.a.ai'], ['design', 'est.a.design']] },
      { key: 'timeline', q: 'ai.q.timeline', mode: 'single',
        options: [['rush', 'ai.t.asap'], ['standard', 'ai.t.normal'], ['flexible', 'ai.t.flex']] },
      { key: 'budget', q: 'ai.q.budget', mode: 'single',
        options: [['<1000', 'contact.budget.1'], ['1000-3000', 'contact.budget.2'], ['3000-8000', 'contact.budget.3'], ['>8000', 'contact.budget.4']] },
      { key: 'name', q: 'ai.q.name', mode: 'text' },
      { key: 'reach', q: 'ai.q.reach', mode: 'text' },
    ];
  }
  var flow = [], stepIdx = 0;

  function scrollChat() { if (chatLog) chatLog.scrollTop = chatLog.scrollHeight; }
  function addMsg(cls, text) {
    var el = document.createElement('div'); el.className = 'msg ' + cls; el.textContent = text;
    chatLog.appendChild(el); scrollChat(); return el;
  }
  function typing(cb, delay) {
    var el = document.createElement('div'); el.className = 'msg bot typing'; el.innerHTML = '<i></i><i></i><i></i>';
    chatLog.appendChild(el); scrollChat();
    setTimeout(function () { el.remove(); cb(); }, reduceMotion ? 60 : (delay || 650));
  }
  function botSay(text, cb) { typing(function () { addMsg('bot', text); if (cb) cb(); }, 550 + Math.min(text.length * 12, 700)); }

  function renderQuick(step) {
    chatQuick.innerHTML = '';
    if (step.mode === 'text') { chatInputForm.classList.remove('hide'); chatInput.value = ''; chatInput.focus(); return; }
    chatInputForm.classList.add('hide');
    var selected = [];
    step.options.forEach(function (o) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t(o[1]); b.dataset.val = o[0];
      b.addEventListener('click', function () {
        if (step.mode === 'single') { answer(step, o[0], t(o[1])); }
        else {
          var i = selected.indexOf(o[0]);
          if (i >= 0) { selected.splice(i, 1); b.classList.remove('sel'); }
          else { selected.push(o[0]); b.classList.add('sel'); }
        }
      });
      chatQuick.appendChild(b);
    });
    if (step.mode === 'multi') {
      var go = document.createElement('button'); go.type = 'button'; go.className = 'go'; go.textContent = t(step.done);
      go.addEventListener('click', function () {
        var labels = selected.map(function (v) { var f = step.options.filter(function (o) { return o[0] === v; })[0]; return f ? t(f[1]) : v; });
        answer(step, selected.slice(), labels.length ? labels.join(', ') : t('ai.none'));
      });
      chatQuick.appendChild(go);
    }
  }

  function answer(step, value, label) {
    brief[step.key] = value;
    addMsg('user', label);
    chatQuick.innerHTML = ''; chatInputForm.classList.add('hide');
    stepIdx++;
    setTimeout(nextStep, reduceMotion ? 40 : 250);
  }

  function nextStep() {
    if (stepIdx >= flow.length) { finishChat(); return; }
    var step = flow[stepIdx];
    botSay(t(step.q), function () { renderQuick(step); });
  }

  function platformForEstimate(p) { return (p === 'website' || p === 'webapp' || p === 'mobile') ? p : 'webapp'; }

  function finishChat() {
    chatInputForm.classList.add('hide'); chatQuick.innerHTML = '';
    var est = estimateFrom(platformForEstimate(brief.platform), brief.features, brief.timeline === 'rush');
    typing(function () {
      var el = document.createElement('div'); el.className = 'msg bot summary';
      var featLabels = (brief.features || []).map(function (v) { return t('est.a.' + v); });
      var lines = [
        t('ai.summary.title'),
        t('ai.f.building') + ' ' + labelFor('platform', brief.platform),
        brief.about ? (t('ai.f.about') + ' ' + brief.about) : null,
        (featLabels.length ? t('ai.f.features') + ' ' + featLabels.join(', ') : null),
        t('ai.f.timeline') + ' ' + labelFor('timeline', brief.timeline),
        t('ai.f.budget') + ' ' + labelFor('budget', brief.budget),
      ].filter(Boolean);
      el.textContent = lines.join('\n');
      if (est) {
        var span = document.createElement('span'); span.className = 'est';
        span.textContent = money(est.low) + ' – ' + money(est.high) + ' · ' + est.weeksLow + '–' + est.weeksHigh + ' ' + t('est.weeksUnit');
        el.appendChild(span);
      }
      chatLog.appendChild(el); scrollChat();
      typing(function () {
        addMsg('bot', t('ai.handoff'));
        var go = document.createElement('button'); go.type = 'button'; go.className = 'go';
        go.textContent = t('ai.sendBtn');
        go.addEventListener('click', handoffToForm);
        chatQuick.appendChild(go);
      }, 500);
    }, 700);
  }

  function labelFor(kind, val) {
    var maps = {
      platform: { website: 'est.p.website', webapp: 'est.p.webapp', mobile: 'est.p.mobile', system: 'contact.type.system', other: 'contact.type.other' },
      timeline: { rush: 'ai.t.asap', standard: 'ai.t.normal', flexible: 'ai.t.flex' },
      budget: { '<1000': 'contact.budget.1', '1000-3000': 'contact.budget.2', '3000-8000': 'contact.budget.3', '>8000': 'contact.budget.4' },
    };
    var k = (maps[kind] || {})[val];
    return k ? t(k) : (val || '');
  }

  function handoffToForm() {
    var typeSel = $('#f-type'); if (typeSel) typeSel.value = ['website', 'webapp', 'mobile', 'system'].indexOf(brief.platform) >= 0 ? brief.platform : 'other';
    var budgetSel = $('#f-budget'); if (budgetSel && brief.budget) budgetSel.value = brief.budget;
    if (brief.name) $('#f-name').value = brief.name;
    // Route the "reach" answer to email or phone.
    if (brief.reach) { if (brief.reach.indexOf('@') >= 0) $('#f-email').value = brief.reach; else $('#f-phone').value = brief.reach; }
    var featLabels = (brief.features || []).map(function (v) { return t('est.a.' + v); });
    var est = estimateFrom(platformForEstimate(brief.platform), brief.features, brief.timeline === 'rush');
    var msg = [
      t('ai.summary.title'),
      t('ai.f.building') + ' ' + labelFor('platform', brief.platform),
      brief.about ? t('ai.f.about') + ' ' + brief.about : null,
      featLabels.length ? t('ai.f.features') + ' ' + featLabels.join(', ') : null,
      t('ai.f.timeline') + ' ' + labelFor('timeline', brief.timeline),
      t('ai.f.budget') + ' ' + labelFor('budget', brief.budget),
      est ? '\n' + t('est.result') + ': ' + money(est.low) + ' – ' + money(est.high) + ' (' + est.weeksLow + '–' + est.weeksHigh + ' ' + t('est.weeksUnit') + ')' : null,
    ].filter(Boolean).join('\n');
    var ta = $('#f-msg'); if (ta) ta.value = msg;
    showPanel('form');
    if (submitBtn) { submitBtn.scrollIntoView({ block: 'center' }); }
    var missing = !$('#f-email').value && !$('#f-phone').value;
    (missing ? $('#f-email') : $('#f-msg')).focus();
  }

  function startChat() {
    flow = steps(); stepIdx = 0;
    brief = { platform: '', about: '', features: [], timeline: '', budget: '', name: '', reach: '' };
    chatLog.innerHTML = ''; chatQuick.innerHTML = '';
    botSay(t('ai.greeting'), function () { nextStep(); });
  }

  if (chatInputForm) {
    chatInputForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = chatInput.value.trim(); if (!v) return;
      var step = flow[stepIdx]; if (!step || step.mode !== 'text') return;
      answer(step, v, v);
    });
  }

  applyLang(lang);
})();
