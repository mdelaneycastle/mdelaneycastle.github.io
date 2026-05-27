// footer live clock (UK time)
const timeEl = document.getElementById('footerTime');
function tick() {
  if (!timeEl) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm}:${ss}`;
}
tick();
setInterval(tick, 1000);

// reveal sections on scroll
const revealTargets = document.querySelectorAll('.section, .hero');
revealTargets.forEach((el) => el.classList.add('reveal'));

const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);
revealTargets.forEach((el) => io.observe(el));

// status pill toggle (just for fun)
const statusStates = [
  { text: 'available for work', color: '#5eead4' },
  { text: 'deep in a side project', color: '#fcd34d' },
  { text: 'probably watching a film', color: '#a78bfa' },
];
let statusIdx = 0;
const pill = document.querySelector('.status-pill');
const pillText = document.querySelector('.status-text');
const pillDot = document.querySelector('.status-dot');
if (pill && pillText && pillDot) {
  pill.addEventListener('click', () => {
    statusIdx = (statusIdx + 1) % statusStates.length;
    const next = statusStates[statusIdx];
    pillText.textContent = next.text;
    pillDot.style.background = next.color;
    pillDot.style.boxShadow = `0 0 0 0 ${next.color}33`;
  });
}

// matrix rain — scoped to the .film-matrix row, only while hovered
(function initMatrixRain() {
  const row = document.querySelector('.film-matrix');
  const canvas = row && row.querySelector('.matrix-row-canvas');
  if (!row || !canvas) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) { canvas.remove(); return; }

  const ctx = canvas.getContext('2d', { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:・."=*+-<>¦|_';
  const FONT_BASE = 14; // smaller — the row is short
  let columns = [];
  let w = 0, h = 0;

  function makeColumn(x) {
    const depth = Math.random();
    const speed = 0.35 + depth * 0.95;
    return {
      x,
      depth,
      speed,
      head: -Math.random() * 20,
      trail: 4 + Math.floor(Math.random() * 8),
      glyphs: [],
      // shorter naps — row is small, we want activity quickly on hover
      sleep: Math.random() < 0.25 ? Math.random() * 40 : 0,
      mutateOdds: 0.05 + Math.random() * 0.08,
    };
  }

  function resize() {
    const rect = row.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colCount = Math.ceil(w / FONT_BASE);
    columns = new Array(colCount);
    for (let i = 0; i < colCount; i++) {
      columns[i] = makeColumn(i * FONT_BASE);
    }
    ctx.clearRect(0, 0, w, h);
  }

  function randomGlyph() {
    return GLYPHS[(Math.random() * GLYPHS.length) | 0];
  }

  function draw() {
    // trail fade
    ctx.fillStyle = 'rgba(7, 9, 13, 0.12)';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      if (c.sleep > 0) { c.sleep--; continue; }

      c.head += c.speed;
      const headRow = Math.floor(c.head);

      const fs = FONT_BASE + (c.depth - 0.5) * 1.2;
      ctx.font = `${fs}px 'JetBrains Mono', monospace`;
      ctx.textBaseline = 'top';

      for (let t = c.trail; t >= 1; t--) {
        const r = headRow - t;
        if (r < 0) continue;
        const y = r * FONT_BASE;
        if (y > h) continue;

        if (!c.glyphs[r] || Math.random() < c.mutateOdds) {
          c.glyphs[r] = randomGlyph();
        }
        const tNorm = 1 - (t / c.trail);
        const a = (0.08 + tNorm * 0.55) * (0.45 + c.depth * 0.55);
        ctx.fillStyle = `rgba(80, 220, 120, ${a.toFixed(3)})`;
        ctx.fillText(c.glyphs[r], c.x, y);
      }

      const hy = headRow * FONT_BASE;
      if (hy >= 0 && hy < h) {
        if (!c.glyphs[headRow] || Math.random() < c.mutateOdds * 2) {
          c.glyphs[headRow] = randomGlyph();
        }
        const headA = 0.85 + c.depth * 0.15;
        ctx.fillStyle = `rgba(220, 255, 230, ${headA.toFixed(3)})`;
        ctx.fillText(c.glyphs[headRow], c.x, hy);
      }

      if ((headRow - c.trail) * FONT_BASE > h) {
        if (Math.random() < 0.96) {
          const nc = makeColumn(c.x);
          nc.head = -Math.random() * 16;
          columns[i] = nc;
        }
      }
    }
  }

  let rafId = 0;
  let running = false;
  function loop() {
    if (!running) return;
    draw();
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (running) return;
    if (!w || !h) resize();
    // clear the stale last frame from the previous hover so we start fresh
    // (canvas opacity is 0 here anyway, so this isn't visible)
    ctx.clearRect(0, 0, w, h);
    // reset column state so we don't resume mid-fall
    for (let i = 0; i < columns.length; i++) columns[i] = makeColumn(i * FONT_BASE);
    running = true;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    // just stop drawing — leave the last frame in place so CSS opacity can fade it out
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  row.addEventListener('mouseenter', start);
  row.addEventListener('mouseleave', stop);
  // also handle keyboard focus on any future interactive children
  row.addEventListener('focusin', start);
  row.addEventListener('focusout', stop);

  const ro = new ResizeObserver(() => { if (running) resize(); else resize(); });
  ro.observe(row);
  resize();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
})();

// avengers snap — flash, pause, disintegrate the .film-snap row
(function initSnap() {
  const row = document.querySelector('.film-snap');
  const canvas = row && row.querySelector('.snap-canvas');
  if (!row || !canvas) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;

  function resize() {
    const r = row.getBoundingClientRect();
    w = Math.max(1, Math.floor(r.width));
    h = Math.max(1, Math.floor(r.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Render each visible text span to an offscreen canvas, sample opaque
  // pixels at a stride, return particles positioned relative to the row.
  function sampleParticles() {
    const spans = row.querySelectorAll('.film-year, .film-title, .film-note');
    const rowRect = row.getBoundingClientRect();
    const particles = [];
    let minX = Infinity, maxX = -Infinity;

    spans.forEach((span) => {
      const s = getComputedStyle(span);
      const rect = span.getBoundingClientRect();
      const sx = rect.left - rowRect.left;
      const sy = rect.top - rowRect.top;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx + rect.width);

      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.ceil(rect.width));
      off.height = Math.max(1, Math.ceil(rect.height));
      const o = off.getContext('2d');
      o.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      o.fillStyle = '#fff';
      o.textBaseline = 'middle';
      o.fillText(span.textContent, 0, rect.height / 2);

      const data = o.getImageData(0, 0, off.width, off.height).data;
      const m = (s.color.match(/\d+/g) || ['230', '237', '243']).slice(0, 3);
      const colorStr = `rgb(${m[0]},${m[1]},${m[2]})`;

      const stride = 2;
      for (let py = 0; py < off.height; py += stride) {
        for (let px = 0; px < off.width; px += stride) {
          const i = (py * off.width + px) * 4;
          if (data[i + 3] > 80) {
            particles.push({
              x: sx + px,
              y: sy + py,
              vx: 0.15 + Math.random() * 0.6,
              vy: -(0.25 + Math.random() * 0.6),
              alpha: 1,
              size: 1 + Math.random() * 1.4,
              color: colorStr,
              phase: Math.random() * Math.PI * 2,
              absX: sx + px, // for cascade ordering
            });
          }
        }
      }
    });

    // cascade: dust travels left → right across the row over ~700ms
    const span = Math.max(1, maxX - minX);
    for (const p of particles) {
      const t = (p.absX - minX) / span; // 0 at left, 1 at right
      p.delay = t * 700 + Math.random() * 220;
    }
    return particles;
  }

  let particles = [];
  let rafId = 0;
  let running = false;
  let startTime = 0;

  function tick() {
    if (!running) return;
    const now = performance.now();
    const t = now - startTime;

    ctx.clearRect(0, 0, w, h);

    let alive = 0;
    for (const p of particles) {
      if (t < p.delay) {
        // still solid — render in place to fill the gap left by hidden DOM text
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        alive++;
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.012;            // upward acceleration
      p.vx *= 0.995;
      p.x += Math.sin(now * 0.003 + p.phase) * 0.18; // slight sway
      p.alpha -= 0.011;

      if (p.alpha > 0 && p.y > -10) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        alive++;
      }
    }
    ctx.globalAlpha = 1;

    if (alive === 0) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function startSnap() {
    resize();
    particles = sampleParticles();
    if (!particles.length) { onCooldown = false; return; }
    row.classList.add('is-dusting');
    running = true;
    startTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function finish() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    ctx.clearRect(0, 0, w, h);
    row.classList.remove('is-dusting'); // text fades back in via CSS
    setTimeout(() => { onCooldown = false; }, 900);
  }

  let flashTimer = 0;
  let snapTimer = 0;
  let onCooldown = false;

  row.addEventListener('mouseenter', () => {
    if (onCooldown || running) return;
    onCooldown = true;

    // 1) flash (slow build + decay, fills the whole row)
    row.classList.add('is-flashing');
    flashTimer = setTimeout(() => row.classList.remove('is-flashing'), 1500);

    // 2) wait, then snap (~2s pause after the flash ends)
    snapTimer = setTimeout(startSnap, 3500);
  });

  row.addEventListener('mouseleave', () => {
    // if already disintegrating, let it finish — looks weird to cancel mid-dust
    if (running) return;
    clearTimeout(flashTimer);
    clearTimeout(snapTimer);
    row.classList.remove('is-flashing');
    onCooldown = false;
  });

  const ro = new ResizeObserver(() => { if (!running) resize(); });
  ro.observe(row);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(resize);
  }
  resize();
})();

// interstellar — year counts up while hovered, slowly rewinds on leave.
// Forward rate is a stylized homage to the film's 7:1 Miller's-planet ratio,
// not the literal rate (which would be 7 yrs per Earth hour — visually frozen).
(function initInterstellar() {
  const row = document.querySelector('.film-interstellar');
  const yearNum = row && row.querySelector('.year-num');
  if (!row || !yearNum) return;

  const BASE = 2014;
  const FWD = 7;   // years per second hovered
  const REV = 18;  // years per second rewinding — recover faster than dilate

  let current = BASE;
  let mode = 'idle';  // 'forward' | 'reverse' | 'idle'
  let rafId = 0;
  let lastTime = 0;

  function loop(now) {
    if (mode === 'idle') { rafId = 0; return; }
    if (!lastTime) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (mode === 'forward') {
      current += FWD * dt;
      yearNum.textContent = Math.floor(current);
    } else {
      current -= REV * dt;
      if (current <= BASE) {
        current = BASE;
        yearNum.textContent = BASE;
        mode = 'idle';
        rafId = 0;
        row.classList.remove('is-ticking');
        row.classList.remove('is-reversing');
        return;
      }
      yearNum.textContent = Math.floor(current);
    }
    rafId = requestAnimationFrame(loop);
  }

  row.addEventListener('mouseenter', () => {
    const wasIdle = mode === 'idle';
    mode = 'forward';
    lastTime = 0;
    row.classList.add('is-ticking');
    row.classList.remove('is-reversing');
    if (wasIdle && !rafId) rafId = requestAnimationFrame(loop);
  });

  row.addEventListener('mouseleave', () => {
    if (mode === 'idle') return;
    if (current <= BASE + 0.5) {
      current = BASE;
      yearNum.textContent = BASE;
      mode = 'idle';
      rafId = 0;
      row.classList.remove('is-ticking');
      row.classList.remove('is-reversing');
      return;
    }
    mode = 'reverse';
    lastTime = 0;
    row.classList.add('is-reversing'); // clock hand spins backward during rewind
  });
})();


// whiplash — play the video clip on hover, pause on leave
(function initWhiplash() {
  const row = document.querySelector('.film-whiplash');
  const video = row && row.querySelector('.whiplash-clip');
  if (!row || !video) return;

  row.addEventListener('mouseenter', () => {
    video.currentTime = 0;
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  });
  row.addEventListener('mouseleave', () => {
    video.pause();
  });
})();

// subtle konami nudge: type "marc" anywhere to flash the accent
let buffer = '';
document.addEventListener('keydown', (e) => {
  if (e.key.length !== 1) return;
  buffer = (buffer + e.key.toLowerCase()).slice(-4);
  if (buffer === 'marc') {
    document.documentElement.animate(
      [{ filter: 'hue-rotate(0deg)' }, { filter: 'hue-rotate(60deg)' }, { filter: 'hue-rotate(0deg)' }],
      { duration: 900, easing: 'ease-in-out' }
    );
  }
});

// helmet filter modal — lazy-load iframe on open, unload on close to stop the camera
(function initHelmetModal() {
  const modal = document.getElementById('helmet-modal');
  if (!modal) return;
  const iframe = modal.querySelector('.modal-iframe');
  const closeBtn = modal.querySelector('.modal-close');

  function open() {
    if (!iframe.getAttribute('src')) iframe.setAttribute('src', '/ironman/?v=3');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    iframe.removeAttribute('src');
  }

  document.querySelectorAll('[data-open-helmet]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open();
    });
  });
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
})();
