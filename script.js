/**
 * PORTFOLIO SCRIPT — ADARSH KUMAR SINGH
 * B.Tech ECE, JECRC University, Jaipur | Digital Designer & Developer
 * 
 * Strict Vanilla JS:
 * - Single shared requestAnimationFrame loop for all pointer/cursor interactions
 * - Zero layout thrashing: batched cached rects, object pools for trail & confetti
 * - Adaptive quality / Lite mode auto-detection
 * - 100% works locally over file:// protocol
 */

(function () {
  'use strict';

  /* ===================================================================
     1. PERFORMANCE & DEVICE DETECTION CONSTANTS
     =================================================================== */
  const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;
  const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HARDWARE_CONCURRENCY = navigator.hardwareConcurrency || 4;
  const MAX_TRAIL_PARTICLES = 20;

  let isLiteMode = HARDWARE_CONCURRENCY <= 4 || window.innerWidth < 768;
  if (isLiteMode) {
    document.body.classList.add('lite-mode');
  }

  /* ===================================================================
     2. SHARED STATE FOR UNIFIED rAF LOOP
     =================================================================== */
  const pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    targetX: window.innerWidth / 2,
    targetY: window.innerHeight / 2,
    normalizedX: 0, // -1 to 1
    normalizedY: 0, // -1 to 1
    isActive: false,
    speed: 0,
    prevX: 0,
    prevY: 0
  };

  // Lerp smoothing factors
  const LERP_CURSOR = 0.16;
  const LERP_SPOTLIGHT = 0.12;

  // DOM Elements for Cursor
  const customCursor = document.getElementById('customCursor');
  const cursorDot = customCursor ? customCursor.querySelector('.cursor-dot') : null;
  const cursorRing = customCursor ? customCursor.querySelector('.cursor-ring') : null;
  const cursorLabel = document.getElementById('cursorLabel');
  const cursorSpotlight = document.getElementById('cursorSpotlight');
  const mouseTrailContainer = document.getElementById('mouseTrailContainer');

  // Smooth position caches
  const cursorState = {
    ringX: window.innerWidth / 2,
    ringY: window.innerHeight / 2,
    spotX: window.innerWidth / 2,
    spotY: window.innerHeight / 2
  };

  /* ===================================================================
     3. MOUSE TRAIL OBJECT POOL (Zero allocations per frame)
     =================================================================== */
  const trailPool = [];
  let trailIndex = 0;

  if (mouseTrailContainer && !IS_TOUCH && !PREFERS_REDUCED_MOTION) {
    for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
      const p = document.createElement('div');
      p.className = 'trail-particle';
      mouseTrailContainer.appendChild(p);
      trailPool.push({
        el: p,
        x: -100,
        y: -100,
        life: 0,
        decay: 0.05 + Math.random() * 0.04,
        size: 3 + Math.random() * 4
      });
    }
  }

  function spawnTrailParticle(x, y) {
    if (isLiteMode || IS_TOUCH || PREFERS_REDUCED_MOTION || !trailPool.length) return;
    const p = trailPool[trailIndex];
    trailIndex = (trailIndex + 1) % MAX_TRAIL_PARTICLES;
    p.x = x + (Math.random() - 0.5) * 12;
    p.y = y + (Math.random() - 0.5) * 12;
    p.life = 1.0;
  }

  function updateTrail() {
    if (isLiteMode || IS_TOUCH || PREFERS_REDUCED_MOTION) return;
    for (let i = 0; i < trailPool.length; i++) {
      const p = trailPool[i];
      if (p.life > 0) {
        p.life -= p.decay;
        if (p.life <= 0) {
          p.life = 0;
          p.el.style.opacity = '0';
        } else {
          p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) scale(${p.life})`;
          p.el.style.opacity = (p.life * 0.7).toFixed(2);
        }
      }
    }
  }

  /* ===================================================================
     4. HERO HEADLINE LETTER SPLITTING & REACTIVE HOVER
     =================================================================== */
  const heroHeadline = document.getElementById('heroReactiveHeadline');
  const headlineLetters = [];

  function initHeroLetters() {
    if (!heroHeadline) return;
    const lines = heroHeadline.querySelectorAll('.hero-name-line');
    lines.forEach(line => {
      const text = line.textContent.trim();
      line.textContent = '';
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const span = document.createElement('span');
        span.className = 'char-span';
        span.textContent = char;
        line.appendChild(span);

        headlineLetters.push({
          el: span,
          rect: null,
          targetX: 0,
          targetY: 0,
          currentX: 0,
          currentY: 0,
          scale: 1,
          targetScale: 1
        });
      }
    });
    cacheLetterRects();
  }

  function cacheLetterRects() {
    for (let i = 0; i < headlineLetters.length; i++) {
      const item = headlineLetters[i];
      const r = item.el.getBoundingClientRect();
      item.rect = {
        centerX: r.left + r.width / 2,
        centerY: r.top + r.height / 2
      };
    }
  }

  function updateHeroLetters() {
    if (IS_TOUCH || PREFERS_REDUCED_MOTION || !headlineLetters.length) return;
    const px = pointer.x;
    const py = pointer.y;
    const maxDist = 220; // 220px proximity limit

    for (let i = 0; i < headlineLetters.length; i++) {
      const item = headlineLetters[i];
      if (!item.rect) continue;

      const dx = px - item.rect.centerX;
      const dy = py - item.rect.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxDist) {
        const factor = (1 - dist / maxDist);
        // Push slightly away from mouse + scale up
        item.targetX = -dx * factor * 0.18;
        item.targetY = -dy * factor * 0.18;
        item.targetScale = 1 + factor * 0.28;
        item.el.style.color = factor > 0.4 ? 'var(--accent)' : '';
      } else {
        item.targetX = 0;
        item.targetY = 0;
        item.targetScale = 1;
        item.el.style.color = '';
      }

      // Smooth lerp
      item.currentX += (item.targetX - item.currentX) * 0.18;
      item.currentY += (item.targetY - item.currentY) * 0.18;
      item.scale += (item.targetScale - item.scale) * 0.18;

      if (Math.abs(item.currentX) > 0.05 || Math.abs(item.currentY) > 0.05 || Math.abs(item.scale - 1) > 0.01) {
        item.el.style.transform = `translate3d(${item.currentX.toFixed(2)}px, ${item.currentY.toFixed(2)}px, 0) scale(${item.scale.toFixed(3)})`;
      }
    }
  }

  /* ===================================================================
     5. 3D TILT CARDS & PARALLAX
     =================================================================== */
  const tiltCards = [];
  const parallaxElements = [];

  function initTiltAndParallax() {
    if (IS_TOUCH || PREFERS_REDUCED_MOTION) return;

    // 3D Tilt Cards
    document.querySelectorAll('.tilt-card').forEach(card => {
      const maxTilt = parseFloat(card.dataset.tilt || 10);
      tiltCards.push({
        el: card,
        maxTilt: maxTilt,
        rect: null,
        targetRx: 0,
        targetRy: 0,
        currentRx: 0,
        currentRy: 0
      });
    });

    // Parallax Elements
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const depth = parseFloat(el.dataset.parallax || 0.1);
      parallaxElements.push({
        el: el,
        depth: depth,
        targetX: 0,
        targetY: 0,
        currentX: 0,
        currentY: 0
      });
    });

    cacheTiltRects();
  }

  function cacheTiltRects() {
    for (let i = 0; i < tiltCards.length; i++) {
      tiltCards[i].rect = tiltCards[i].el.getBoundingClientRect();
    }
  }

  function updateTiltCards() {
    if (IS_TOUCH || PREFERS_REDUCED_MOTION || isLiteMode) return;
    const px = pointer.x;
    const py = pointer.y;

    for (let i = 0; i < tiltCards.length; i++) {
      const c = tiltCards[i];
      if (!c.rect) continue;

      const isInside = (
        px >= c.rect.left &&
        px <= c.rect.right &&
        py >= c.rect.top &&
        py <= c.rect.bottom
      );

      if (isInside) {
        const cx = c.rect.left + c.rect.width / 2;
        const cy = c.rect.top + c.rect.height / 2;
        const dx = (px - cx) / (c.rect.width / 2);
        const dy = (py - cy) / (c.rect.height / 2);

        c.targetRy = dx * c.maxTilt;
        c.targetRx = -dy * c.maxTilt;
      } else {
        c.targetRx = 0;
        c.targetRy = 0;
      }

      c.currentRx += (c.targetRx - c.currentRx) * 0.12;
      c.currentRy += (c.targetRy - c.currentRy) * 0.12;

      if (Math.abs(c.currentRx) > 0.05 || Math.abs(c.currentRy) > 0.05) {
        c.el.style.transform = `perspective(1000px) rotateX(${c.currentRx.toFixed(2)}deg) rotateY(${c.currentRy.toFixed(2)}deg)`;
      } else if (c.targetRx === 0 && c.targetRy === 0 && c.currentRx !== 0) {
        c.currentRx = 0;
        c.currentRy = 0;
        c.el.style.transform = '';
      }
    }
  }

  function updateParallax() {
    if (IS_TOUCH || PREFERS_REDUCED_MOTION || isLiteMode) return;
    const nx = pointer.normalizedX;
    const ny = pointer.normalizedY;

    for (let i = 0; i < parallaxElements.length; i++) {
      const p = parallaxElements[i];
      p.targetX = nx * p.depth * 80;
      p.targetY = ny * p.depth * 80;

      p.currentX += (p.targetX - p.currentX) * 0.1;
      p.currentY += (p.targetY - p.currentY) * 0.1;

      p.el.style.transform = `translate3d(${p.currentX.toFixed(2)}px, ${p.currentY.toFixed(2)}px, 0)`;
    }
  }

  /* ===================================================================
     6. MAGNETIC BUTTONS (Pull within 80px)
     =================================================================== */
  const magneticItems = [];

  function initMagneticButtons() {
    if (IS_TOUCH || PREFERS_REDUCED_MOTION) return;
    document.querySelectorAll('.magnetic').forEach(btn => {
      const strength = parseFloat(btn.dataset.magnetic || 0.2);
      magneticItems.push({
        el: btn,
        strength: strength,
        rect: null,
        curX: 0,
        curY: 0,
        tarX: 0,
        tarY: 0
      });
    });
    cacheMagneticRects();
  }

  function cacheMagneticRects() {
    for (let i = 0; i < magneticItems.length; i++) {
      magneticItems[i].rect = magneticItems[i].el.getBoundingClientRect();
    }
  }

  function updateMagneticItems() {
    if (IS_TOUCH || PREFERS_REDUCED_MOTION || isLiteMode) return;
    const px = pointer.x;
    const py = pointer.y;

    for (let i = 0; i < magneticItems.length; i++) {
      const m = magneticItems[i];
      if (!m.rect) continue;

      const cx = m.rect.left + m.rect.width / 2;
      const cy = m.rect.top + m.rect.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 80) {
        m.tarX = dx * m.strength;
        m.tarY = dy * m.strength;
      } else {
        m.tarX = 0;
        m.tarY = 0;
      }

      m.curX += (m.tarX - m.curX) * 0.16;
      m.curY += (m.tarY - m.curY) * 0.16;

      if (Math.abs(m.curX) > 0.05 || Math.abs(m.curY) > 0.05) {
        m.el.style.transform = `translate3d(${m.curX.toFixed(2)}px, ${m.curY.toFixed(2)}px, 0)`;
      } else if (m.tarX === 0 && m.curX !== 0) {
        m.curX = 0;
        m.curY = 0;
        m.el.style.transform = '';
      }
    }
  }

  /* ===================================================================
     7. UNIFIED TICK FUNCTION (Single Shared rAF)
     =================================================================== */
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fpsTimer = 0;

  function masterRafLoop(now) {
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    // Adaptive Frame-Rate Monitor (detect lag below 45fps for 1 second)
    frameCount++;
    fpsTimer += delta;
    if (fpsTimer >= 1000) {
      const fps = (frameCount * 1000) / fpsTimer;
      if (fps < 45 && !isLiteMode) {
        isLiteMode = true;
        document.body.classList.add('lite-mode');
      }
      frameCount = 0;
      fpsTimer = 0;
    }

    if (pointer.isActive && !IS_TOUCH) {
      // Smooth lerp pointer coords
      pointer.x += (pointer.targetX - pointer.x) * LERP_CURSOR;
      pointer.y += (pointer.targetY - pointer.y) * LERP_CURSOR;

      // Update Cursor Dot
      if (cursorDot) {
        cursorDot.style.transform = `translate3d(${pointer.targetX}px, ${pointer.targetY}px, 0)`;
      }

      // Update Cursor Ring (lerped trailing)
      if (cursorRing) {
        cursorState.ringX += (pointer.targetX - cursorState.ringX) * LERP_CURSOR;
        cursorState.ringY += (pointer.targetY - cursorState.ringY) * LERP_CURSOR;
        cursorRing.style.transform = `translate3d(${cursorState.ringX.toFixed(2)}px, ${cursorState.ringY.toFixed(2)}px, 0)`;
      }

      // Update Spotlight
      if (cursorSpotlight && !isLiteMode) {
        cursorState.spotX += (pointer.targetX - cursorState.spotX) * LERP_SPOTLIGHT;
        cursorState.spotY += (pointer.targetY - cursorState.spotY) * LERP_SPOTLIGHT;
        cursorSpotlight.style.transform = `translate3d(${(cursorState.spotX - 300).toFixed(1)}px, ${(cursorState.spotY - 300).toFixed(1)}px, 0)`;
      }

      // Calculate speed for particle emission
      const mdx = pointer.targetX - pointer.prevX;
      const mdy = pointer.targetY - pointer.prevY;
      pointer.speed = Math.sqrt(mdx * mdx + mdy * mdy);
      pointer.prevX = pointer.targetX;
      pointer.prevY = pointer.targetY;

      if (pointer.speed > 5) {
        spawnTrailParticle(pointer.targetX, pointer.targetY);
      }
    }

    // Call sub-updates
    updateTrail();
    updateHeroLetters();
    updateTiltCards();
    updateParallax();
    updateMagneticItems();

    requestAnimationFrame(masterRafLoop);
  }

  // Pointer Movement Listener (Passive, pointermove)
  window.addEventListener('pointermove', function (e) {
    if (IS_TOUCH) return;
    if (!pointer.isActive) {
      pointer.isActive = true;
      document.body.classList.add('has-cursor');
    }
    pointer.targetX = e.clientX;
    pointer.targetY = e.clientY;
    pointer.normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.normalizedY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  window.addEventListener('pointerleave', function () {
    pointer.isActive = false;
    document.body.classList.remove('has-cursor');
  }, { passive: true });

  // Contextual Custom Cursor Labels
  document.addEventListener('mouseover', function (e) {
    if (IS_TOUCH) return;
    const target = e.target.closest('[data-cursor], a, button, .project-card, .polaroid-card');
    if (!target) {
      document.body.classList.remove('cursor-hover', 'cursor-labeled');
      if (cursorLabel) cursorLabel.textContent = '';
      return;
    }

    const customText = target.dataset.cursor;
    if (customText) {
      document.body.classList.add('cursor-labeled');
      document.body.classList.remove('cursor-hover');
      if (cursorLabel) cursorLabel.textContent = customText;
    } else {
      document.body.classList.add('cursor-hover');
      document.body.classList.remove('cursor-labeled');
      if (cursorLabel) cursorLabel.textContent = '';
    }
  }, { passive: true });

  // Debounced resize and scroll for rect caches
  let resizeTimeout = null;
  function refreshAllRects() {
    cacheLetterRects();
    cacheTiltRects();
    cacheMagneticRects();
  }

  window.addEventListener('resize', function () {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(refreshAllRects, 200);
  }, { passive: true });

  /* ===================================================================
     8. SCROLL PROGRESS & TIMELINE LINE DRAW (Throttled via rAF)
     =================================================================== */
  const scrollProgressBar = document.getElementById('scrollProgressBar');
  const timelineProgressLine = document.getElementById('timelineProgressLine');
  const educationSection = document.getElementById('education');
  const siteHeader = document.getElementById('siteHeader');

  let isScrollScheduled = false;

  function onScrollThrottled() {
    if (!isScrollScheduled) {
      isScrollScheduled = true;
      requestAnimationFrame(function () {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;

        // Top progress bar
        if (scrollProgressBar && docHeight > 0) {
          const progress = Math.min(1, Math.max(0, scrollTop / docHeight));
          scrollProgressBar.style.transform = `scaleX(${progress})`;
        }

        // Header scrolled class
        if (siteHeader) {
          if (scrollTop > 40) {
            siteHeader.classList.add('is-scrolled');
          } else {
            siteHeader.classList.remove('is-scrolled');
          }
        }

        // Timeline SVG Draw
        if (timelineProgressLine && educationSection) {
          const eduRect = educationSection.getBoundingClientRect();
          const viewHeight = window.innerHeight;
          // Calculate progress through education section
          const start = eduRect.top - viewHeight * 0.6;
          const total = eduRect.height;
          let eduProgress = -start / total;
          eduProgress = Math.max(0, Math.min(1, eduProgress));

          // Stroke dash offset calculation
          const offset = 1000 - (eduProgress * 1000);
          timelineProgressLine.style.strokeDashoffset = offset.toFixed(1);
        }

        isScrollScheduled = false;
      });
    }
  }

  window.addEventListener('scroll', onScrollThrottled, { passive: true });

  /* ===================================================================
     9. INTERSECTION OBSERVER FOR VISIBILITY & ANIMATION PAUSING
     =================================================================== */
  // Pause offscreen sections to save battery & maintain 60fps
  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('is-paused');
      } else {
        entry.target.classList.add('is-paused');
      }
    });
  }, { threshold: 0.05 });

  document.querySelectorAll('section, .marquee-strip-section').forEach(sec => {
    visibilityObserver.observe(sec);
  });

  // Pause on Tab Visibility Change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      document.body.classList.add('is-paused');
    } else {
      document.body.classList.remove('is-paused');
    }
  });

  // Active Nav Link Spy
  const navLinks = document.querySelectorAll('.nav-link');
  const sectionIds = ['hero', 'about', 'education', 'projects', 'playground', 'skills', 'contact'];
  const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, { threshold: 0.35 });

  sections.forEach(sec => navObserver.observe(sec));

  /* ===================================================================
     10. INTRO PAGE LOADER (Under 1.5s, Skippable)
     =================================================================== */
  const pageLoader = document.getElementById('pageLoader');
  const loaderBar = document.getElementById('loaderBar');
  const loaderPercent = document.getElementById('loaderPercent');
  const loaderSkip = document.getElementById('loaderSkip');

  let loaderProgress = 0;
  let isLoaderFinished = false;

  function finishLoader() {
    if (isLoaderFinished) return;
    isLoaderFinished = true;
    if (pageLoader) {
      pageLoader.classList.add('is-loaded');
      setTimeout(() => pageLoader.remove(), 500);
    }
  }

  if (pageLoader) {
    const startTime = performance.now();
    const duration = 1100; // 1.1s total

    function stepLoader(now) {
      if (isLoaderFinished) return;
      const elapsed = now - startTime;
      loaderProgress = Math.min(100, Math.floor((elapsed / duration) * 100));

      if (loaderBar) loaderBar.style.width = `${loaderProgress}%`;
      if (loaderPercent) loaderPercent.textContent = `${loaderProgress}%`;

      if (elapsed < duration) {
        requestAnimationFrame(stepLoader);
      } else {
        finishLoader();
      }
    }
    requestAnimationFrame(stepLoader);

    // Skip on click or key
    if (loaderSkip) {
      loaderSkip.addEventListener('click', finishLoader);
    }
    window.addEventListener('keydown', finishLoader, { once: true });
  }

  /* ===================================================================
     11. HERO ROLE ROTATOR
     =================================================================== */
  const roleRotator = document.getElementById('roleRotator');
  if (roleRotator) {
    const roles = roleRotator.querySelectorAll('.role-item');
    let currentRoleIdx = 0;

    setInterval(() => {
      if (document.hidden) return;
      const prev = roles[currentRoleIdx];
      currentRoleIdx = (currentRoleIdx + 1) % roles.length;
      const next = roles[currentRoleIdx];

      prev.classList.remove('active');
      prev.classList.add('exiting');
      setTimeout(() => prev.classList.remove('exiting'), 500);

      next.classList.add('active');
    }, 2800);
  }

  /* ===================================================================
     12. THEME TOGGLE & ACCENT VIBE SWITCHER (Local Storage)
     =================================================================== */
  const themeToggle = document.getElementById('themeToggle');

  // Load saved theme
  try {
    const savedTheme = localStorage.getItem('aks_portfolio_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch (err) {
    console.warn('LocalStorage inaccessible:', err);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const target = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', target);
      try {
        localStorage.setItem('aks_portfolio_theme', target);
      } catch (err) {}
    });
  }

  // Pick Your Vibe Accent Switcher
  const vibeButtons = document.querySelectorAll('.vibe-btn');
  try {
    const savedAccent = localStorage.getItem('aks_portfolio_accent');
    const savedRgb = localStorage.getItem('aks_portfolio_accent_rgb');
    if (savedAccent && savedRgb) {
      document.documentElement.style.setProperty('--accent', savedAccent);
      document.documentElement.style.setProperty('--accent-rgb', savedRgb);
      vibeButtons.forEach(btn => {
        if (btn.dataset.color === savedAccent) {
          btn.classList.add('active');
          btn.setAttribute('aria-checked', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-checked', 'false');
        }
      });
    }
  } catch (err) {}

  vibeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      const rgb = btn.dataset.rgb;

      document.documentElement.style.setProperty('--accent', color);
      document.documentElement.style.setProperty('--accent-rgb', rgb);

      vibeButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');

      try {
        localStorage.setItem('aks_portfolio_accent', color);
        localStorage.setItem('aks_portfolio_accent_rgb', rgb);
      } catch (err) {}
    });
  });

  /* ===================================================================
     13. MOBILE MENU TOGGLE
     =================================================================== */
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  function toggleMobileMenu(open) {
    if (!mobileMenu) return;
    const shouldOpen = open !== undefined ? open : !mobileMenu.classList.contains('is-open');
    if (shouldOpen) {
      mobileMenu.classList.add('is-open');
      mobileMenu.setAttribute('aria-hidden', 'false');
      if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      mobileMenu.classList.remove('is-open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => toggleMobileMenu());
  }

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => toggleMobileMenu(false));
  });

  /* ===================================================================
     14. ABOUT SECTION: STAT COUNTERS & POLAROID LIGHTBOX
     =================================================================== */
  const statCounts = document.querySelectorAll('.stat-count');
  let hasAnimatedStats = false;

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimatedStats) {
        hasAnimatedStats = true;
        statCounts.forEach(el => {
          const target = parseInt(el.dataset.target, 10);
          const suffix = el.dataset.suffix || '';
          const duration = 1600;
          const start = performance.now();

          function step(now) {
            const progress = Math.min(1, (now - start) / duration);
            const val = Math.floor(progress * target);
            el.textContent = `${val}${suffix}`;
            if (progress < 1) {
              requestAnimationFrame(step);
            } else {
              el.textContent = `${target}${suffix}`;
            }
          }
          requestAnimationFrame(step);
        });
      }
    });
  }, { threshold: 0.3 });

  const statsGrid = document.getElementById('statsGrid');
  if (statsGrid) statsObserver.observe(statsGrid);

  // Photo Lightbox Modal
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
  const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
  const lightboxNextBtn = document.getElementById('lightboxNextBtn');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');

  const photosData = [
    { src: 'assets/adarsh-1.jpg', caption: 'Embedded Hardware Lab — Circuit testing & microcontrollers' },
    { src: 'assets/adarsh-2.jpg', caption: 'Web Dev & Creative Coding Workspace — Jaipur' },
    { src: 'assets/adarsh-3.jpg', caption: 'Design Systems & Wireframing Session' }
  ];
  let currentPhotoIdx = 0;

  function openLightbox(idx) {
    currentPhotoIdx = idx;
    const p = photosData[idx];
    if (lightboxImg) {
      lightboxImg.src = p.src;
      lightboxImg.alt = p.caption;
    }
    if (lightboxCaption) lightboxCaption.textContent = p.caption;
    if (lightboxModal) {
      lightboxModal.classList.add('is-active');
      lightboxModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeLightbox() {
    if (lightboxModal) {
      lightboxModal.classList.remove('is-active');
      lightboxModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  document.querySelectorAll('.polaroid-card').forEach((card, idx) => {
    card.addEventListener('click', () => openLightbox(idx));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(idx);
      }
    });
  });

  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);

  if (lightboxPrevBtn) {
    lightboxPrevBtn.addEventListener('click', () => {
      currentPhotoIdx = (currentPhotoIdx - 1 + photosData.length) % photosData.length;
      openLightbox(currentPhotoIdx);
    });
  }

  if (lightboxNextBtn) {
    lightboxNextBtn.addEventListener('click', () => {
      currentPhotoIdx = (currentPhotoIdx + 1) % photosData.length;
      openLightbox(currentPhotoIdx);
    });
  }

  /* ===================================================================
     15. EDUCATION TIMELINE CARD EXPANSION
     =================================================================== */
  document.querySelectorAll('.timeline-card').forEach(card => {
    const btn = card.querySelector('.edu-expand-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExp = card.classList.contains('is-expanded');
        card.classList.toggle('is-expanded');
        btn.setAttribute('aria-expanded', String(!isExp));
        refreshAllRects();
      });
    }

    card.addEventListener('click', () => {
      const isExp = card.classList.contains('is-expanded');
      card.classList.toggle('is-expanded');
      if (btn) btn.setAttribute('aria-expanded', String(!isExp));
      refreshAllRects();
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('is-expanded');
        if (btn) btn.setAttribute('aria-expanded', String(card.classList.contains('is-expanded')));
        refreshAllRects();
      }
    });
  });

  /* ===================================================================
     16. PROJECTS DATA, FLIP FILTERING & MODAL
     =================================================================== */
  const projectsData = {
    p1: {
      title: 'ESP32 Smart Home Automation Node',
      category: 'Electronics / IoT',
      year: '2026',
      badge: 'Electronics / IoT',
      summary: 'Industrial-grade IoT telemetry node connecting physical sensors to a cloud dashboard with ultra-low latency.',
      problem: 'Standard consumer smart home devices often rely on high-latency cloud servers, leak telemetry data, and fail completely when the local internet connection drops.',
      solution: 'Engineered a standalone ESP32 hardware device running FreeRTOS. Developed a custom dual-layer PCB schematic in KiCad, integrated MQTT over WebSockets for local LAN failover, and created a responsive dashboard for real-time relay control.',
      result: 'Achieved sub-20ms local command latency, reduced deep sleep power draw to 15µA, and established encrypted bidirectional telemetry with 99.98% reliability.',
      tags: ['ESP32', 'FreeRTOS', 'MQTT', 'KiCad EDA', 'C++', 'WebSocket', 'Hardware Design'],
      github: 'https://github.com/Adarshu0',
      live: '#projects'
    },
    p2: {
      title: 'RoboTrack Bluetooth Autonomous Rover',
      category: 'Robotics',
      year: '2026',
      badge: 'Electronics / Robotics',
      summary: 'Differential-drive robotic platform with ultrasonic obstacle evasion, sensor fusion, and low-latency BLE remote steering.',
      problem: 'Autonomous micro-rovers suffer from drift and sensor noise when traversing irregular indoor surfaces without closed-loop feedback.',
      solution: 'Designed an H-bridge motor driver interface on an Arduino/STM32 MCU. Implemented a predictive distance algorithm using ultrasonic pings and Kalman filtering, with an Android/Web Bluetooth Low Energy interface for manual override.',
      result: 'Successfully completed autonomous obstacle maze navigation with zero collisions and 30Hz continuous telemetry feedback.',
      tags: ['Arduino', 'STM32', 'BLE', 'Embedded C', 'H-Bridge', 'Robotics', 'Sensor Fusion'],
      github: 'https://github.com/Adarshu0',
      live: '#projects'
    },
    p3: {
      title: 'Aura UI Design System & Component Kit',
      category: 'Design System',
      year: '2026',
      badge: 'UI/UX & Web',
      summary: 'Comprehensive design token architecture with WCAG AAA accessibility, mathematical fluid clamp typography, and dark-first palette.',
      problem: 'Design system drift between Figma prototypes and actual CSS production components often leads to broken spacing and low contrast.',
      solution: 'Created an 8px atomic token hierarchy in Figma, mirrored with CSS custom properties. Built accessible keyboard-navigable components including modals, tabs, and interactive forms.',
      result: '100% WCAG AAA contrast ratio compliance, zero-dependency vanilla implementation, and seamless theme switching.',
      tags: ['Figma', 'Design Tokens', 'CSS Variables', 'Accessibility (WCAG)', 'Micro-Interactions'],
      github: 'https://github.com/Adarshu0',
      live: '#projects'
    },
    p4: {
      title: 'PulseFlow Real-Time Signal Visualizer',
      category: 'Web / ECE',
      year: '2026',
      badge: 'Web Audio / Signals',
      summary: 'High-performance audio spectral analyzer rendering real-time Fast Fourier Transforms (FFT) at 60 FPS.',
      problem: 'Visualizing complex communication signals and frequency spectra in browsers often bogs down the main JavaScript thread.',
      solution: 'Leveraged the Web Audio API AnalyserNode and an optimized HTML5 Canvas render loop. Implemented custom decibel scaling and logarithmic frequency bins for precise audio representation.',
      result: 'Maintained smooth 60 FPS playback on mid-tier hardware with sub-5% CPU utilization.',
      tags: ['Web Audio API', 'Canvas 2D', 'FFT Math', 'Signal Processing', 'Vanilla JS'],
      github: 'https://github.com/Adarshu0',
      live: '#projects'
    },
    p5: {
      title: 'NeuraBlog Minimalist Tech Journal',
      category: 'Web Architecture',
      year: '2026',
      badge: 'Web Architecture',
      summary: 'Blazing fast, zero-hydration markdown technical publication platform with in-memory full-text search.',
      problem: 'Modern blogging frameworks frequently ship 500KB+ of JavaScript for simple text articles, hurting performance and reading experience.',
      solution: 'Built a pure HTML/CSS/JS reader engine with syntax highlighting, instant fuzzy search, reading-time estimation, and offline bookmarking.',
      result: 'Achieved 100/100 Google Lighthouse scores across all metrics and instantaneous page loads.',
      tags: ['HTML5', 'Modern CSS', 'JavaScript', 'Performance', 'SEO', 'PWA'],
      github: 'https://github.com/Adarshu0',
      live: '#projects'
    },
    p6: {
      title: 'VoltCalc Circuit Impedance Suite',
      category: 'Electronics App',
      year: '2026',
      badge: 'ECE Utility App',
      summary: 'Engineering calculation tool for complex AC impedance, passive RLC filters, and 5-band resistor decoding.',
      problem: 'ECE students and hobbyists often need immediate offline circuit math without intrusive ads or bulky software.',
      solution: 'Engineered a lightweight PWA that handles complex number matrix math for passive high-pass/low-pass filter cutoffs, resonant frequencies, and component tolerances.',
      result: 'Used regularly by ECE classmates at JECRC University for lab experiment preparation and circuit debugging.',
      tags: ['PWA', 'Complex Numbers', 'Circuit Theory', 'RLC Resonance', 'Offline Tool'],
      github: 'https://github.com/Adarshu0',
      live: '#projects'
    }
  };

  // FLIP Animated Filter Chips
  const filterChips = document.querySelectorAll('.filter-chip');
  const projectCards = document.querySelectorAll('.project-card');

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');

      const filter = chip.dataset.filter;

      projectCards.forEach(card => {
        const cat = card.dataset.category;
        const matches = (filter === 'all' || cat === filter);

        if (matches) {
          card.classList.remove('is-hidden');
          card.style.opacity = '1';
          card.style.transform = '';
        } else {
          card.classList.add('is-hidden');
          card.style.opacity = '0';
          card.style.transform = 'scale(0.92)';
        }
      });
      refreshAllRects();
    });
  });

  // Project Modal Logic
  const projectModal = document.getElementById('projectModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalBadge = document.getElementById('modalBadge');
  const modalYear = document.getElementById('modalYear');
  const modalTitle = document.getElementById('modalTitle');
  const modalSummary = document.getElementById('modalSummary');
  const modalProblem = document.getElementById('modalProblem');
  const modalSolution = document.getElementById('modalSolution');
  const modalResult = document.getElementById('modalResult');
  const modalTags = document.getElementById('modalTags');
  const modalCover = document.getElementById('modalCover');
  const modalPrevBtn = document.getElementById('modalPrevBtn');
  const modalNextBtn = document.getElementById('modalNextBtn');

  const projectIds = Object.keys(projectsData);
  let currentProjectIdx = 0;

  function renderProjectModal(id) {
    const data = projectsData[id];
    if (!data) return;

    currentProjectIdx = projectIds.indexOf(id);

    if (modalBadge) modalBadge.textContent = data.badge;
    if (modalYear) modalYear.textContent = data.year;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalSummary) modalSummary.textContent = data.summary;
    if (modalProblem) modalProblem.textContent = data.problem;
    if (modalSolution) modalSolution.textContent = data.solution;
    if (modalResult) modalResult.textContent = data.result;

    if (modalTags) {
      modalTags.innerHTML = '';
      data.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tech-tag';
        span.textContent = tag;
        modalTags.appendChild(span);
      });
    }

    if (modalCover) {
      // Find source card SVG to clone into modal
      const sourceCard = document.querySelector(`.project-card[data-id="${id}"] .cover-svg`);
      if (sourceCard) {
        modalCover.innerHTML = '';
        modalCover.appendChild(sourceCard.cloneNode(true));
      }
    }

    if (projectModal) {
      projectModal.classList.add('is-active');
      projectModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (modalCloseBtn) modalCloseBtn.focus();
    }
  }

  function closeProjectModal() {
    if (projectModal) {
      projectModal.classList.remove('is-active');
      projectModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  projectCards.forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      renderProjectModal(id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        renderProjectModal(card.dataset.id);
      }
    });
  });

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeProjectModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeProjectModal);

  if (modalPrevBtn) {
    modalPrevBtn.addEventListener('click', () => {
      currentProjectIdx = (currentProjectIdx - 1 + projectIds.length) % projectIds.length;
      renderProjectModal(projectIds[currentProjectIdx]);
    });
  }

  if (modalNextBtn) {
    modalNextBtn.addEventListener('click', () => {
      currentProjectIdx = (currentProjectIdx + 1) % projectIds.length;
      renderProjectModal(projectIds[currentProjectIdx]);
    });
  }

  // Keyboard trap & Escape listener for both modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (projectModal && projectModal.classList.contains('is-active')) {
        closeProjectModal();
      }
      if (lightboxModal && lightboxModal.classList.contains('is-active')) {
        closeLightbox();
      }
    }
  });

  /* ===================================================================
     17. CASE STUDY DRAGGABLE SCROLL CAROUSEL
     =================================================================== */
  const caseStudyTrack = document.getElementById('caseStudyTrack');
  const galleryPrevBtn = document.getElementById('galleryPrevBtn');
  const galleryNextBtn = document.getElementById('galleryNextBtn');

  if (caseStudyTrack) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    caseStudyTrack.addEventListener('pointerdown', (e) => {
      isDown = true;
      startX = e.pageX - caseStudyTrack.offsetLeft;
      scrollLeft = caseStudyTrack.scrollLeft;
    });

    window.addEventListener('pointerup', () => {
      isDown = false;
    });

    caseStudyTrack.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - caseStudyTrack.offsetLeft;
      const walk = (x - startX) * 1.5;
      caseStudyTrack.scrollLeft = scrollLeft - walk;
    });

    if (galleryPrevBtn) {
      galleryPrevBtn.addEventListener('click', () => {
        caseStudyTrack.scrollBy({ left: -320, behavior: 'smooth' });
      });
    }

    if (galleryNextBtn) {
      galleryNextBtn.addEventListener('click', () => {
        caseStudyTrack.scrollBy({ left: 320, behavior: 'smooth' });
      });
    }
  }

  /* ===================================================================
     18. PLAYGROUND: KINETIC DRAGGABLE STICKER BOARD
     =================================================================== */
  const stickerBoard = document.getElementById('stickerBoard');
  const dragStickers = document.querySelectorAll('.drag-sticker');

  dragStickers.forEach(sticker => {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let posX = 0;
    let posY = 0;
    let velX = 0;
    let velY = 0;
    let lastTime = 0;

    sticker.addEventListener('pointerdown', (e) => {
      isDragging = true;
      sticker.setPointerCapture(e.pointerId);
      startX = e.clientX - posX;
      startY = e.clientY - posY;
      lastTime = performance.now();
      velX = 0;
      velY = 0;
      sticker.style.zIndex = '20';
    });

    sticker.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const newX = e.clientX - startX;
      const newY = e.clientY - startY;

      velX = (newX - posX) / dt;
      velY = (newY - posY) / dt;

      posX = newX;
      posY = newY;
      lastTime = now;

      sticker.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
    });

    function release(e) {
      if (!isDragging) return;
      isDragging = false;
      try {
        sticker.releasePointerCapture(e.pointerId);
      } catch (err) {}

      // Apply subtle coasting momentum
      let coast = 0;
      function coastStep() {
        if (coast++ < 12) {
          posX += velX * 8 * (1 - coast / 12);
          posY += velY * 8 * (1 - coast / 12);
          sticker.style.transform = `translate3d(${posX.toFixed(1)}px, ${posY.toFixed(1)}px, 0)`;
          requestAnimationFrame(coastStep);
        } else {
          sticker.style.zIndex = '5';
        }
      }
      requestAnimationFrame(coastStep);
    }

    sticker.addEventListener('pointerup', release);
    sticker.addEventListener('pointercancel', release);
  });

  /* ===================================================================
     19. PLAYGROUND: CANVAS DOODLE PAD (DPR capped at 2, paused offscreen)
     =================================================================== */
  const doodleCanvas = document.getElementById('doodleCanvas');
  const clearDoodleBtn = document.getElementById('clearDoodleBtn');
  const downloadDoodleBtn = document.getElementById('downloadDoodleBtn');

  if (doodleCanvas) {
    const ctx = doodleCanvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function resizeDoodle() {
      const rect = doodleCanvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      doodleCanvas.width = rect.width * dpr;
      doodleCanvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    resizeDoodle();
    window.addEventListener('resize', () => {
      // Retain drawing logic could be added; simple resize handles dimensions
      resizeDoodle();
    }, { passive: true });

    function getDoodleCoords(e) {
      const rect = doodleCanvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    doodleCanvas.addEventListener('pointerdown', (e) => {
      isDrawing = true;
      doodleCanvas.setPointerCapture(e.pointerId);
      const coords = getDoodleCoords(e);
      lastX = coords.x;
      lastY = coords.y;
    });

    doodleCanvas.addEventListener('pointermove', (e) => {
      if (!isDrawing) return;
      const coords = getDoodleCoords(e);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff4d2e';

      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();

      lastX = coords.x;
      lastY = coords.y;
    });

    function stopDrawing(e) {
      if (!isDrawing) return;
      isDrawing = false;
      try {
        doodleCanvas.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    doodleCanvas.addEventListener('pointerup', stopDrawing);
    doodleCanvas.addEventListener('pointercancel', stopDrawing);

    if (clearDoodleBtn) {
      clearDoodleBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
      });
    }

    if (downloadDoodleBtn) {
      downloadDoodleBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'adarsh-doodle.png';
        link.href = doodleCanvas.toDataURL('image/png');
        link.click();
      });
    }
  }

  /* ===================================================================
     20. PLAYGROUND: SKILL ORBIT INTERACTION
     =================================================================== */
  const orbitNodes = document.querySelectorAll('.orbit-node');
  const orbitActiveTitle = document.getElementById('orbitActiveTitle');
  const orbitActiveDesc = document.getElementById('orbitActiveDesc');

  orbitNodes.forEach(node => {
    node.addEventListener('mouseenter', () => {
      const name = node.dataset.name;
      const info = node.dataset.info;
      if (orbitActiveTitle) orbitActiveTitle.textContent = name;
      if (orbitActiveDesc) {
        orbitActiveDesc.textContent = info;
        orbitActiveDesc.style.display = 'block';
      }
    });

    node.addEventListener('click', () => {
      const name = node.dataset.name;
      const info = node.dataset.info;
      if (orbitActiveTitle) orbitActiveTitle.textContent = name;
      if (orbitActiveDesc) {
        orbitActiveDesc.textContent = info;
        orbitActiveDesc.style.display = 'block';
      }
    });
  });

  /* ===================================================================
     21. SKILLS ACCORDION (One open at a time)
     =================================================================== */
  const accordionItems = document.querySelectorAll('.accordion-item');

  accordionItems.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('is-open');

      // Close all others
      accordionItems.forEach(other => {
        other.classList.remove('is-open');
        const otherTrigger = other.querySelector('.accordion-trigger');
        if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
      });

      if (!isOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      refreshAllRects();
    });
  });

  /* ===================================================================
     22. TESTIMONIALS SLIDER (Swipe, Autoplay & Offscreen Pause)
     =================================================================== */
  const testimonialSlides = document.querySelectorAll('.testimonial-slide');
  const testimonialDots = document.querySelectorAll('#testimonialDots .dot-btn');
  const prevTestimonialBtn = document.getElementById('prevTestimonialBtn');
  const nextTestimonialBtn = document.getElementById('nextTestimonialBtn');
  const testimonialsSlider = document.getElementById('testimonialsSlider');

  let currentSlide = 0;
  let testimonialInterval = null;

  function showSlide(idx) {
    currentSlide = (idx + testimonialSlides.length) % testimonialSlides.length;
    testimonialSlides.forEach((s, i) => {
      if (i === currentSlide) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    testimonialDots.forEach((d, i) => {
      if (i === currentSlide) {
        d.classList.add('active');
        d.setAttribute('aria-selected', 'true');
      } else {
        d.classList.remove('active');
        d.setAttribute('aria-selected', 'false');
      }
    });
  }

  function nextSlide() {
    showSlide(currentSlide + 1);
  }

  function startAutoplay() {
    stopAutoplay();
    testimonialInterval = setInterval(nextSlide, 5000);
  }

  function stopAutoplay() {
    if (testimonialInterval) {
      clearInterval(testimonialInterval);
      testimonialInterval = null;
    }
  }

  if (prevTestimonialBtn) {
    prevTestimonialBtn.addEventListener('click', () => {
      showSlide(currentSlide - 1);
      startAutoplay();
    });
  }

  if (nextTestimonialBtn) {
    nextTestimonialBtn.addEventListener('click', () => {
      showSlide(currentSlide + 1);
      startAutoplay();
    });
  }

  testimonialDots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      showSlide(i);
      startAutoplay();
    });
  });

  if (testimonialsSlider) {
    testimonialsSlider.addEventListener('mouseenter', stopAutoplay);
    testimonialsSlider.addEventListener('mouseleave', startAutoplay);
    startAutoplay();
  }

  /* ===================================================================
     23. CONTACT FORM, VALIDATION & COPY EMAIL
     =================================================================== */
  const contactForm = document.getElementById('contactForm');
  const formSuccessState = document.getElementById('formSuccessState');
  const resetFormBtn = document.getElementById('resetFormBtn');
  const formMessage = document.getElementById('formMessage');
  const charCount = document.getElementById('charCount');

  // Character counter
  if (formMessage && charCount) {
    formMessage.addEventListener('input', () => {
      const len = formMessage.value.length;
      charCount.textContent = `${len} / 500`;
      if (len > 500) {
        charCount.style.color = 'var(--color-error)';
      } else {
        charCount.style.color = '';
      }
    });
  }

  // Live validation on submit
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameInput = document.getElementById('formName');
      const emailInput = document.getElementById('formEmail');
      const msgInput = document.getElementById('formMessage');

      let isValid = true;

      // Name check
      if (!nameInput.value.trim()) {
        nameInput.classList.add('is-invalid');
        isValid = false;
      } else {
        nameInput.classList.remove('is-invalid');
      }

      // Email check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        emailInput.classList.add('is-invalid');
        isValid = false;
      } else {
        emailInput.classList.remove('is-invalid');
      }

      // Message check
      if (!msgInput.value.trim()) {
        msgInput.classList.add('is-invalid');
        isValid = false;
      } else {
        msgInput.classList.remove('is-invalid');
      }

      if (isValid) {
        if (formSuccessState) {
          formSuccessState.classList.add('active');
          formSuccessState.setAttribute('aria-hidden', 'false');
        }
      }
    });
  }

  if (resetFormBtn && contactForm) {
    resetFormBtn.addEventListener('click', () => {
      contactForm.reset();
      if (formSuccessState) {
        formSuccessState.classList.remove('active');
        formSuccessState.setAttribute('aria-hidden', 'true');
      }
      if (charCount) charCount.textContent = '0 / 500';
    });
  }

  // Copy Email Button with Toast
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  const contactEmail = document.getElementById('contactEmail');
  const toastNotification = document.getElementById('toastNotification');
  const copyBtnText = document.getElementById('copyBtnText');

  let toastTimeout = null;
  function showToast(msg) {
    if (!toastNotification) return;
    const msgEl = document.getElementById('toastMessage');
    if (msgEl) msgEl.textContent = msg;
    toastNotification.classList.add('show');
    toastNotification.setAttribute('aria-hidden', 'false');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastNotification.classList.remove('show');
      toastNotification.setAttribute('aria-hidden', 'true');
    }, 2800);
  }

  if (copyEmailBtn && contactEmail) {
    copyEmailBtn.addEventListener('click', () => {
      const email = contactEmail.textContent.trim();
      navigator.clipboard.writeText(email).then(() => {
        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        showToast('Email address copied to clipboard!');
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = 'Copy';
        }, 2000);
      }).catch(() => {
        showToast('Email: adarsh.singh.ece@gmail.com');
      });
    });
  }

  /* ===================================================================
     24. FOOTER & KONAMI CODE CONFETTI EASTER EGG
     =================================================================== */
  // Auto-updating current year
  const currentYearSpan = document.getElementById('currentYear');
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  // Konami Code: Up, Up, Down, Down, Left, Right, Left, Right, B, A
  const konamiSequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];
  let konamiIdx = 0;

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const expected = konamiSequence[konamiIdx].toLowerCase();

    if (key === expected) {
      konamiIdx++;
      if (konamiIdx === konamiSequence.length) {
        triggerConfettiBlast();
        showToast('🎉 Konami Code Activated! Circuit power 100%!');
        konamiIdx = 0;
      }
    } else {
      konamiIdx = 0;
    }
  });

  // Confetti Particle Explosion
  const confettiCanvas = document.getElementById('confettiCanvas');
  function triggerConfettiBlast() {
    if (!confettiCanvas) return;
    const ctx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#ff4d2e', '#b9a7ff', '#22e58b', '#00f0ff', '#f59e0b', '#ffffff'];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.7) * 22,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5 + Math.random() * 6,
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }

    let frame = 0;
    function renderConfetti() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.rotation += p.vr;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }

      if (alive && frame++ < 120) {
        requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
    }
    requestAnimationFrame(renderConfetti);
  }

  /* ===================================================================
     25. INITIALIZE ALL SUBSYSTEMS & START MASTER rAF
     =================================================================== */
  initHeroLetters();
  initTiltAndParallax();
  initMagneticButtons();
  requestAnimationFrame(masterRafLoop);

})();
