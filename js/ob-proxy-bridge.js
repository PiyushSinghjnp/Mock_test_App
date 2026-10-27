/**
 * Oliveboard Live Browser & REA MCP Client Bridge
 * Injected into every proxied Oliveboard page inside #ob-live-iframe
 * -----------------------------------------------------------------
 * 1. Keeps all navigation and popups inside /api/ob-browser/proxy
 * 2. Provides robust 2-step Oliveboard login handlers (next.php & loginnext.php)
 * 3. Bridges postMessage commands from Login Assistant to Oliveboard modals
 * 4. Stubs third-party widgets ($zopim) and dismisses obstructive promo backdrops
 */

(function() {
  'use strict';

  // Injected target URL placeholder replaced by server
  window.__OB_PROXIED_URL__ = window.__OB_PROXIED_URL__ || 'https://www.oliveboard.in/';

  // 1. Zopim live chat mock to prevent unhandled ReferenceErrors
  try {
    if (typeof window.$zopim === 'undefined') {
      var zopimStub = function(cb) {
        if (typeof cb === 'function') {
          try { cb(); } catch (e) {}
        }
      };
      zopimStub.livechat = {
        setLanguage: function() {},
        setName: function() {},
        setEmail: function() {},
        setNotes: function() {},
        setOnConnected: function(cb) { if (typeof cb === 'function') try { cb(); } catch (e) {} },
        window: {
          show: function() {},
          hide: function() {},
          toggle: function() {}
        }
      };
      window.$zopim = zopimStub;
    }
  } catch (e) {}

  // 2. Helper to get proxy origin
  function getProxyOrigin() {
    try {
      return window.location.origin || '';
    } catch (e) {
      return '';
    }
  }

  // 3. Convert any raw URL into a proxied URL
  function toProxyUrl(rawHref) {
    if (!rawHref) return null;
    var str = String(rawHref).trim().replace(/&amp;/g, '&');
    if (!str || str.startsWith('javascript:') || str.startsWith('#') || str.startsWith('mailto:') || str.startsWith('tel:')) {
      return null;
    }
    try {
      var abs = new URL(str, window.__OB_PROXIED_URL__).toString();
      if (abs.indexOf('/api/ob-browser/proxy') !== -1) return abs;
      return getProxyOrigin() + '/api/ob-browser/proxy?url=' + encodeURIComponent(abs);
    } catch (e) {
      return null;
    }
  }
  window.toProxyUrl = toProxyUrl;

  // 4. Convert any AJAX URL into a proxied AJAX URL
  function toAjaxProxyUrl(rawUrl) {
    if (!rawUrl) return rawUrl;
    var str = String(rawUrl).trim().replace(/&amp;/g, '&');
    if (str.startsWith('/api/ob-browser/') || str.startsWith('data:') || str.startsWith('blob:')) {
      return str;
    }
    try {
      var abs = new URL(str, window.__OB_PROXIED_URL__).toString();
      if (abs.indexOf('oliveboard.in') !== -1) {
        return getProxyOrigin() + '/api/ob-browser/ajax-proxy?url=' + encodeURIComponent(abs);
      }
    } catch (e) {}
    return rawUrl;
  }
  window.toAjaxProxyUrl = toAjaxProxyUrl;

  // 5. Robust query param extractor (e.g. gq('next'))
  window.gq = function(p) {
    try {
      var proxiedUrl = window.__OB_PROXIED_URL__ || '';
      var u = new URL(proxiedUrl, window.location.href);
      var val = u.searchParams.get(p);
      if (val !== null && val !== undefined) return val;
    } catch (e) {}
    try {
      var query = window.location.search.substring(1);
      var vars = query.split('&');
      for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (pair[0] === p) return decodeURIComponent(pair[1]);
      }
    } catch (e) {}
    return '0';
  };

  // 6. Safe goto function
  window.goto = function(url) {
    if (url) {
      var proxied = toProxyUrl(url);
      window.location.href = proxied || url;
    }
  };

  // 7. Safe openwin and window.open preventing un-proxied frame breaks
  var origOpen = window.open;
  function safeOpenWin(url, windowname) {
    if (url && !String(url).startsWith('javascript:') && !String(url).startsWith('#')) {
      var proxied = toProxyUrl(url);
      if (proxied) {
        try {
          var abs = new URL(url, window.__OB_PROXIED_URL__).toString();
          window.parent.postMessage({ type: 'OB_PROXY_NAVIGATING', url: abs, popup: true }, '*');
        } catch (e) {}
        window.location.href = proxied;
        return window;
      }
    }
    return origOpen ? origOpen.apply(window, arguments) : null;
  }
  window.open = safeOpenWin;
  window.openwin = safeOpenWin;
  try {
    Object.defineProperty(window, 'openwin', {
      get: function() { return safeOpenWin; },
      set: function() {},
      configurable: true
    });
  } catch (e) {}

  // 8. Oliveboard Step 1 Login: safeCourseInValidation1 (loads captcha & reveals password)
  function safeCourseInValidation1() {
    var emailInp = document.getElementById('course-email');
    var email = emailInp ? emailInp.value.trim() : '';
    var errEl = document.querySelector('.courseIn');
    var btnCourseIn1 = document.getElementById('coursein1');

    if (email) {
      var filter = /^((\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*?)\s*;?\s*)+/;
      if (!filter.test(email)) {
        if (errEl) errEl.innerHTML = 'Enter Valid Email Address';
        return;
      }
      if (errEl) errEl.innerHTML = '';
      if (btnCourseIn1) btnCourseIn1.innerHTML = 'Please Wait';

      var postParams = new URLSearchParams();
      postParams.append('email', email);

      fetch(toAjaxProxyUrl('/pyscripts/next.php'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: postParams.toString()
      })
      .then(function(r) { return r.text(); })
      .then(function(captchaurl) {
        var imgBlk = document.getElementById('img-oblcaptcha');
        if (imgBlk && captchaurl) {
          imgBlk.innerHTML = '<img src="' + captchaurl + '" alt="captcha" style="max-height:45px;display:inline-block;">';
          imgBlk.style.display = 'block';
        }
        var captInputBlk = document.querySelector('.captcha-input-blk');
        if (captInputBlk && captchaurl) {
          captInputBlk.style.display = 'block';
        }
        if (emailInp) {
          emailInp.setAttribute('readonly', 'true');
          emailInp.style.backgroundColor = '#F1F3F9';
        }
        var nextGrp = document.getElementById('loginnext-group');
        if (nextGrp) nextGrp.style.display = 'block';
        var btnCourseIn = document.getElementById('coursein');
        if (btnCourseIn) btnCourseIn.style.display = 'inline-block';
        if (btnCourseIn1) btnCourseIn1.style.display = 'none';
        var lem = document.getElementById('lemailnext');
        if (lem) lem.value = email;
        if (errEl) errEl.innerHTML = '';
        var pwdInp = document.getElementById('course-password');
        if (pwdInp) pwdInp.focus();
      })
      .catch(function(err) {
        if (btnCourseIn1) btnCourseIn1.innerHTML = 'Next';
        if (errEl) errEl.innerHTML = 'Error contacting Oliveboard: ' + err.message;
      });
    } else {
      if (errEl) errEl.innerHTML = 'Fields cannot be empty';
    }
  }
  window.courseInValidation1 = safeCourseInValidation1;
  try {
    Object.defineProperty(window, 'courseInValidation1', {
      get: function() { return safeCourseInValidation1; },
      set: function() {},
      configurable: true
    });
  } catch (e) {}

  // 9. Oliveboard Step 2 Login: safeCourseInValidation (submits credentials & redirects strictly inside proxy)
  function safeCourseInValidation(courseurl) {
    if (typeof boxurl !== 'undefined' && boxurl !== '') {
      courseurl = boxurl;
    }
    var email = (document.getElementById('course-email') ? document.getElementById('course-email').value : '') || '';
    var pwd = (document.getElementById('course-password') ? document.getElementById('course-password').value : '') || '';
    var capt = (document.getElementById('lcaptcha-code') ? document.getElementById('lcaptcha-code').value : '') || '1';

    var errEl = document.querySelector('.courseIn');
    var btnCourseIn = document.getElementById('coursein');

    if (email && pwd && capt) {
      var filter = /^((\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*?)\s*;?\s*)+/;
      if (!filter.test(email)) {
        if (errEl) errEl.innerHTML = 'Enter Valid Email Address';
        return;
      }
      if (errEl) errEl.innerHTML = '';
      if (btnCourseIn) btnCourseIn.innerHTML = 'Please Wait';

      var postParams = new URLSearchParams();
      postParams.append('lemail', email);
      postParams.append('lpwd', pwd);
      postParams.append('lpwd1', capt);

      fetch(toAjaxProxyUrl('/pyscripts/loginnext.php'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: postParams.toString()
      })
      .then(function(r) { return r.text(); })
      .then(function(data) {
        if (!data || data.trim() === '0') {
          if (errEl) errEl.innerHTML = 'Invalid Credentials';
          if (btnCourseIn) btnCourseIn.innerHTML = 'Submit';
        } else {
          var next = (typeof window.gq === 'function') ? window.gq('next') : '0';
          var destUrl = (next && next !== '0') ? next : (courseurl || 'https://u1.oliveboard.in/tests/?c=dashboard&i=common');
          if (destUrl.indexOf('/exams/?c=') !== -1) {
            destUrl = destUrl.replace('/exams/?c=', '/tests/?c=');
          }
          var proxied = toProxyUrl(destUrl);
          try {
            window.parent.postMessage({ type: 'OB_PROXY_NAVIGATING', url: destUrl, loggedIn: true }, '*');
          } catch (e) {}
          window.location.href = proxied || destUrl;
          if (errEl) errEl.innerHTML = '';
        }
      })
      .catch(function(err) {
        if (errEl) errEl.innerHTML = 'Login connection error: ' + err.message;
        if (btnCourseIn) btnCourseIn.innerHTML = 'Submit';
      });
    } else {
      if (errEl) errEl.innerHTML = 'Fields cannot be empty';
    }
  }
  window.courseInValidation = safeCourseInValidation;
  try {
    Object.defineProperty(window, 'courseInValidation', {
      get: function() { return safeCourseInValidation; },
      set: function() {},
      configurable: true
    });
  } catch (e) {}

  // 10. Intercept XMLHttpRequest & fetch so Oliveboard AJAX calls route through proxy with server-side cookies
  try {
    var origXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = toAjaxProxyUrl(url);
      return origXhrOpen.apply(this, args);
    };
  } catch (e) {}

  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function(input, init) {
        if (typeof input === 'string') {
          input = toAjaxProxyUrl(input);
        }
        return origFetch.call(this, input, init);
      };
    }
  } catch (e) {}

  // 11. Intercept clicks on links, test cards, and action buttons so navigation stays inside proxied browser
  document.addEventListener('click', function(e) {
    var target = e.target;
    if (!target) return;

    // Check data-url attribute on cards or containers (used extensively by Oliveboard)
    var cardWithUrl = target.closest('[data-url]');
    if (cardWithUrl && !cardWithUrl.closest('a[href]')) {
      var durl = cardWithUrl.getAttribute('data-url');
      if (durl && !durl.startsWith('javascript:') && !durl.startsWith('#')) {
        var proxied = toProxyUrl(durl);
        if (proxied) {
          e.preventDefault();
          e.stopPropagation();
          try {
            var abs = new URL(durl, window.__OB_PROXIED_URL__).toString();
            window.parent.postMessage({ type: 'OB_PROXY_NAVIGATING', url: abs }, '*');
          } catch (err) {}
          window.location.href = proxied;
          return;
        }
      }
    }

    // Check <a> links
    var a = target.closest('a[href]');
    if (a) {
      var rawHref = (a.getAttribute('href') || '').trim();
      if (!rawHref || rawHref === '#' || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
      var proxied = toProxyUrl(rawHref);
      if (proxied) {
        e.preventDefault();
        e.stopPropagation();
        try {
          var abs = new URL(rawHref, window.__OB_PROXIED_URL__).toString();
          window.parent.postMessage({ type: 'OB_PROXY_NAVIGATING', url: abs }, '*');
        } catch (err) {}
        window.location.href = proxied;
        return;
      }
    }
  }, true);

  // 12. Dynamically rewrite inline onclicks
  function rewriteOnclicks(root) {
    try {
      var els = (root || document).querySelectorAll('[onclick*="location"], [onclick*="openwin"], [onclick*="part.php"], [onclick*="content.php"]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var oc = el.getAttribute('onclick');
        if (oc && oc.indexOf('toProxyUrl') === -1) {
          var rewritten = oc
            .replace(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/g, function(_, u) {
              var p = toProxyUrl(u);
              return p ? "window.location.href='" + p + "'" : _;
            })
            .replace(/window\.location\s*=\s*['"]([^'"]+)['"]/g, function(_, u) {
              var p = toProxyUrl(u);
              return p ? "window.location='" + p + "'" : _;
            })
            .replace(/openwin\s*\(\s*['"]([^'"]+)['"]/g, function(_, u) {
              var p = toProxyUrl(u);
              return p ? "openwin('" + p + "'" : _;
            });
          if (rewritten !== oc) el.setAttribute('onclick', rewritten);
        }
      }
    } catch (e) {}
  }

  // 13. Auto-dismiss obstructive promo backdrops on dashboard
  function dismissObstructiveModals() {
    try {
      var backdrops = document.querySelectorAll('.modal-backdrop');
      backdrops.forEach(function(b) {
        b.style.display = 'none';
        b.classList.remove('in');
      });
      var offerModal = document.getElementById('modal-offerimg');
      if (offerModal) {
        offerModal.style.display = 'none';
        offerModal.classList.remove('in');
      }
    } catch (e) {}
  }

  // 14. Observe DOM changes for cards and content
  try {
    var observer = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes && m.addedNodes.length > 0) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType === 1) {
              rewriteOnclicks(node);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  // 15. Intercept form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form) return;
    var rawAction = (form.getAttribute('action') || window.__OB_PROXIED_URL__).trim();
    if (rawAction.startsWith('javascript:') || rawAction === '#') return;
    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    try {
      var abs = new URL(rawAction, window.__OB_PROXIED_URL__).toString();
      if (method === 'GET') {
        e.preventDefault();
        var fd = new FormData(form);
        var sp = new URLSearchParams();
        for (var pair of fd.entries()) {
          sp.append(pair[0], pair[1]);
        }
        var targetWithQs = abs + (abs.indexOf('?') !== -1 ? '&' : '?') + sp.toString();
        window.location.href = toProxyUrl(targetWithQs);
      } else {
        form.action = getProxyOrigin() + '/api/ob-browser/proxy?url=' + encodeURIComponent(abs);
      }
    } catch (err) {}
  }, true);

  // 16. Login Assistant bridge listener
  window.addEventListener('message', function(ev) {
    var msg = ev.data || {};
    if (msg.type === 'OB_CMD_FILL_LOGIN') {
      var em = (msg.email || '').trim();
      var pw = (msg.password || '').trim();

      // Ensure SignUp modal is closed and Login modal is open
      var modalSignup = document.getElementById('modal-signup');
      if (modalSignup) modalSignup.classList.remove('is-active');
      var modalLogin = document.getElementById('modal-login');
      if (modalLogin) {
        modalLogin.classList.add('is-active');
        var lgrp = document.getElementById('login-group-abc');
        if (lgrp) lgrp.style.display = 'block';
        var fgrp = document.getElementById('forgotpwd-group-abc');
        if (fgrp) fgrp.style.display = 'none';
      }

      var emailInp = document.querySelector('#course-email, input[type="email"]');
      if (emailInp) {
        emailInp.value = em;
        emailInp.dispatchEvent(new Event('input', { bubbles: true }));
        emailInp.dispatchEvent(new Event('change', { bubbles: true }));
      }

      var btnNext = document.getElementById('coursein1');
      var nextGrp = document.getElementById('loginnext-group');
      var isStep1 = btnNext && (!nextGrp || window.getComputedStyle(nextGrp).display === 'none');

      if (isStep1 && em) {
        if (typeof window.courseInValidation1 === 'function') {
          window.courseInValidation1();
        } else if (btnNext) {
          btnNext.click();
        }
      }

      var passInp = document.querySelector('#course-password, input[type="password"]');
      if (passInp) {
        passInp.value = pw;
        passInp.dispatchEvent(new Event('input', { bubbles: true }));
        passInp.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (msg.submit) {
        setTimeout(function() {
          var submitBtn = document.getElementById('coursein');
          if (submitBtn && window.getComputedStyle(submitBtn).display !== 'none') {
            submitBtn.click();
          } else if (typeof window.courseInValidation === 'function') {
            window.courseInValidation('https://u1.oliveboard.in/exams/?c=dashboard&i=common');
          }
        }, 350);
      }
    } else if (msg.type === 'OB_CMD_SWITCH_AUTH_TAB') {
      var su = document.getElementById('modal-signup');
      var lg = document.getElementById('modal-login');
      if (msg.tab === 'signup') {
        if (lg) lg.classList.remove('is-active');
        if (su) su.classList.add('is-active');
      } else {
        if (su) su.classList.remove('is-active');
        if (lg) {
          lg.classList.add('is-active');
          var lgrp = document.getElementById('login-group-abc');
          if (lgrp) lgrp.style.display = 'block';
          var fgrp = document.getElementById('forgotpwd-group-abc');
          if (fgrp) fgrp.style.display = 'none';
          var emInp = document.getElementById('course-email');
          if (emInp) emInp.focus();
        }
      }
    } else if (msg.type === 'OB_CMD_TYPE_TEXT') {
      var active = document.activeElement;
      if (!active || active.tagName === 'BODY' || active.tagName === 'HTML' || active.tagName === 'IFRAME') {
        active = document.querySelector('#course-email, #course-uemail, input[type="email"], input[type="text"]:not([readonly]), input[type="password"]');
        if (active) active.focus();
      }
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.value = (active.value || '') + (msg.text || '');
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // 17. Notify parent frame of authentic page load
  function notifyParent() {
    try {
      window.parent.postMessage({
        type: 'OB_PROXY_LOADED',
        url: window.__OB_PROXIED_URL__,
        title: document.title || window.__OB_PROXIED_URL__
      }, '*');
    } catch (e) {}
  }

  window.addEventListener('DOMContentLoaded', function() {
    notifyParent();
    rewriteOnclicks();
    setTimeout(dismissObstructiveModals, 400);

    // Auto-open login modal on Oliveboard homepage or ?next= redirect
    try {
      var urlStr = String(window.__OB_PROXIED_URL__ || window.location.href);
      var isHome = urlStr.indexOf('u1.oliveboard.in/tests/') === -1 &&
                   urlStr.indexOf('u1.oliveboard.in/exams/') === -1 &&
                   (urlStr.indexOf('oliveboard.in') !== -1 || urlStr === 'https://www.oliveboard.in/');
      var hasNext = urlStr.indexOf('next=') !== -1 || urlStr.indexOf('next%3D') !== -1 ||
                    (window.location.search && (window.location.search.indexOf('next=') !== -1 || window.location.search.indexOf('next%3D') !== -1));
      if (isHome || hasNext) {
        var activateLogin = function() {
          var loginModal = document.getElementById('modal-login');
          if (loginModal) {
            loginModal.classList.add('is-active');
            var su = document.getElementById('modal-signup');
            if (su) su.classList.remove('is-active');
            var lgrp = document.getElementById('login-group-abc');
            if (lgrp) lgrp.style.display = 'block';
          }
          var btnLoginSignup = document.getElementById('btn-loginsignup') || document.querySelector('.btn-show-modal-login');
          if (btnLoginSignup) {
            try { btnLoginSignup.click(); } catch (e) {}
          }
          var emailInput = document.querySelector('#course-email, input[type="email"]');
          if (emailInput) {
            try { emailInput.focus(); } catch (e) {}
          }
        };
        setTimeout(activateLogin, 200);
        setTimeout(activateLogin, 600);
      }
    } catch (e) {}
  });

  window.addEventListener('load', function() {
    notifyParent();
    rewriteOnclicks();
    setTimeout(dismissObstructiveModals, 600);
  });
})();
