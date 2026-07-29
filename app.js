/* ===========================================================
   AccrediQ — shared behaviour + injected header/footer
   =========================================================== */
(function () {
  var page = document.body.getAttribute('data-page') || '';

  var NAV = [
    ['standards', 'Standards', 'standards.html'],
    ['departments', 'Departments', 'departments.html'],
    ['tools', 'Quality Tools', 'tools.html'],
    ['kpi', 'KPI Library', 'kpi.html'],
    ['videos', 'Videos', 'videos.html'],
    ['learn', 'Learn', 'learn.html'],
    ['about', 'About', 'about.html']
  ];

  var MARK = '<svg class="mark" viewBox="0 0 26 30" fill="none" aria-hidden="true">' +
    '<path d="M13 1 24 5v10c0 7-5 12-11 14C7 27 2 22 2 15V5L13 1Z" fill="var(--brand)"/>' +
    '<path d="M8 15.5l3.4 3.4L18 11.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var SUN = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function navLinks(cls) {
    return NAV.map(function (n) {
      return '<a href="' + n[2] + '"' + (page === n[0] ? ' class="active" aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
  }

  // ---------- HEADER ----------
  var header = document.getElementById('site-header');
  if (header) {
    header.outerHTML =
      '<header class="nav"><div class="wrap nav-inner">' +
        '<a class="brand" href="index.html" aria-label="AccrediQ home">' + MARK + 'Accredi<b>Q</b></a>' +
        '<nav class="links" aria-label="Primary">' + navLinks() + '</nav>' +
        '<div class="nav-right">' +
          '<span class="kbd">Search <kbd>⌘</kbd><kbd>K</kbd></span>' +
          '<button class="icon-btn" id="themeBtn" aria-label="Toggle light or dark theme" title="Toggle theme">' + SUN + '</button>' +
          '<a class="btn btn-ghost btn-sm" href="#">Sign in</a>' +
          '<button class="icon-btn menu-btn" id="menuBtn" aria-label="Open menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>' +
        '</div>' +
      '</div></header>' +
      '<div class="drawer" id="drawer"><div class="scrim" data-close></div><div class="panel">' +
        '<button class="icon-btn" id="drawerClose" aria-label="Close menu" style="align-self:flex-end;margin-bottom:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        navLinks() +
      '</div></div>';
  }

  // ---------- FOOTER ----------
  var footer = document.getElementById('site-footer');
  if (footer) {
    footer.outerHTML =
      '<footer><div class="wrap">' +
        '<div class="foot-grid">' +
          '<div><a class="brand" href="index.html" style="font-size:17px;">' + MARK + 'Accredi<b>Q</b></a>' +
            '<p class="foot-note">Know it before the assessor does. The learning platform that teaches healthcare teams to understand accreditation the way an assessor does — so the NC never happens.</p>' +
            '<div style="margin-top:14px;display:flex;gap:8px;"><span class="pill">▶ YouTube</span><span class="pill">✦ Newsletter</span></div>' +
          '</div>' +
          '<div class="foot-col"><h4>Learn</h4><a href="standards.html">NABH Standards</a><a href="departments.html">By Department</a><a href="kpi.html">KPI Library</a><a href="tools.html">Quality Tools</a></div>' +
          '<div class="foot-col"><h4>Explore</h4><a href="videos.html">Assessor Videos</a><a href="learn.html">Quizzes & Flashcards</a><a href="standard.html">Sample Standard</a><a href="about.html">Accreditations</a></div>' +
          '<div class="foot-col"><h4>AccrediQ</h4><a href="about.html">About & Mission</a><a href="about.html#roadmap">Roadmap</a><a href="#">Programs</a><a href="#">Contact</a></div>' +
        '</div>' +
        '<div class="foot-bottom"><span>© 2026 AccrediQ · An independent quality &amp; accreditation education forum.</span>' +
        '<span>Prototype build · content representative pending review.</span></div>' +
      '</div></footer>';
  }

  // ---------- THEME TOGGLE ----------
  var root = document.documentElement;
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#themeBtn')) {
      var bg = getComputedStyle(root).getPropertyValue('--bg').trim().toLowerCase();
      var isDark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && bg.indexOf('#08') === 0);
      root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    }
    // mobile drawer
    if (e.target.closest && e.target.closest('#menuBtn')) { document.getElementById('drawer').classList.add('open'); }
    if (e.target.closest && (e.target.closest('#drawerClose') || e.target.closest('[data-close]'))) { document.getElementById('drawer').classList.remove('open'); }
  });

  // ---------- ROLE TABS ----------
  document.querySelectorAll('.roletabs').forEach(function (grp) {
    grp.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        grp.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
        btn.setAttribute('aria-selected', 'true');
        var r = btn.dataset.role;
        var scope = grp.closest('section') || document;
        scope.querySelectorAll('.role-panel').forEach(function (p) { p.classList.toggle('show', p.dataset.role === r); });
      });
    });
  });

  // ---------- QUIZ ----------
  document.querySelectorAll('.quiz').forEach(function (q) {
    q.querySelectorAll('.opt').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var fb = q.querySelector('.feedback');
        var correct = opt.dataset.correct === 'true';
        q.querySelectorAll('.opt').forEach(function (o) { o.disabled = true; });
        opt.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) { var c = q.querySelector('.opt[data-correct="true"]'); if (c) c.classList.add('correct'); }
        if (fb) fb.textContent = correct ? (opt.dataset.ok || 'Correct.') : (opt.dataset.no || 'Not quite.');
      });
    });
  });

  // ---------- DOC NAV SCROLL SPY ----------
  var spy = document.querySelectorAll('.doc-nav a');
  if (spy.length) {
    var secs = [].map.call(spy, function (a) { return document.querySelector(a.getAttribute('href')); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var id = '#' + e.target.id;
          spy.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === id); });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach(function (s) { if (s) io.observe(s); });
  }

  // ---------- ROTATING BADGE (home) ----------
  var cv = document.getElementById('shield');
  if (cv) {
    var ctx = cv.getContext('2d');
    var DPR = Math.min(window.devicePixelRatio || 1, 2), CSS = 440;
    cv.width = CSS * DPR; cv.height = CSS * DPR; ctx.scale(DPR, DPR);
    var cx = CSS / 2, cy = CSS / 2;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function shieldPath(s) {
      ctx.beginPath(); ctx.moveTo(0, -78 * s); ctx.lineTo(62 * s, -52 * s); ctx.lineTo(62 * s, 22 * s);
      ctx.quadraticCurveTo(62 * s, 74 * s, 0, 96 * s); ctx.quadraticCurveTo(-62 * s, 74 * s, -62 * s, 22 * s);
      ctx.lineTo(-62 * s, -52 * s); ctx.closePath();
    }
    function node(x, y, d) { ctx.beginPath(); ctx.arc(x, y, 2 + d * 2.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(34,211,238,' + (0.25 + d * 0.6) + ')'; ctx.fill(); }
    function draw(t) {
      ctx.clearRect(0, 0, CSS, CSS);
      var angle = reduce ? 0.15 : t * 0.00075, sx = Math.cos(angle), front = sx >= 0, scaleX = Math.max(Math.abs(sx), 0.06);
      var flo = reduce ? 0 : Math.sin(t * 0.0011) * 6;
      var g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 210);
      g.addColorStop(0, 'rgba(79,70,229,0.30)'); g.addColorStop(0.5, 'rgba(34,211,238,0.10)'); g.addColorStop(1, 'rgba(10,14,28,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, CSS, CSS);
      if (!reduce) for (var i = 0; i < 9; i++) { var a = t * 0.0006 + i * (Math.PI * 2 / 9); if (Math.sin(a) < 0) node(cx + Math.cos(a) * 170, cy + Math.sin(a) * 60 + flo * .4, (Math.sin(a) + 1) / 2); }
      ctx.save(); ctx.translate(cx, cy + flo); ctx.transform(scaleX, 0, 0, 1, 0, 0);
      var grad = ctx.createLinearGradient(0, -90, 0, 100);
      if (front) { grad.addColorStop(0, '#6366F1'); grad.addColorStop(1, '#4338CA'); } else { grad.addColorStop(0, '#22D3EE'); grad.addColorStop(1, '#0E7490'); }
      shieldPath(1); ctx.fillStyle = grad; ctx.shadowColor = 'rgba(34,211,238,0.35)'; ctx.shadowBlur = 40; ctx.fill(); ctx.shadowBlur = 0;
      shieldPath(1); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
      shieldPath(0.8); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
      var sweep = ctx.createLinearGradient(-70 + Math.sin(angle * 2) * 40, -90, 70, 100);
      sweep.addColorStop(0, 'rgba(255,255,255,0)'); sweep.addColorStop(0.5, 'rgba(255,255,255,0.16)'); sweep.addColorStop(1, 'rgba(255,255,255,0)');
      shieldPath(1); ctx.fillStyle = sweep; ctx.fill();
      if (front) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-26, 6); ctx.lineTo(-6, 28); ctx.lineTo(34, -22); ctx.stroke(); }
      else { ctx.fillStyle = '#fff'; ctx.font = '700 62px ' + getComputedStyle(document.body).getPropertyValue('--font-display'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('AQ', 0, 6); }
      ctx.restore();
      if (!reduce) for (var j = 0; j < 9; j++) { var b = t * 0.0006 + j * (Math.PI * 2 / 9); if (Math.sin(b) >= 0) node(cx + Math.cos(b) * 170, cy + Math.sin(b) * 60 + flo * .4, (Math.sin(b) + 1) / 2); }
    }
    var start;
    function loop(ts) { if (!start) start = ts; draw(ts - start); if (!reduce) requestAnimationFrame(loop); }
    requestAnimationFrame(loop); if (reduce) draw(0);
  }
})();
