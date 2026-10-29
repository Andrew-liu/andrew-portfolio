const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if (reduceMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px' });

  revealItems.forEach((item) => revealObserver.observe(item));
}

const progressBar = document.querySelector('#progressBar');
const backToTop = document.querySelector('#backToTop');
let ticking = false;

function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
  progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
  backToTop?.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.65);
  document.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * 0.55);
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  window.requestAnimationFrame(updateProgress);
}, { passive: true });

backToTop?.addEventListener('click', () => {
  backToTop.classList.remove('is-visible');
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
});

// Decorative contribution heatmap for the open-source card (deterministic pseudo-random levels).
const heatmap = document.querySelector('.heatmap');
if (heatmap) {
  const columns = 22;
  let seed = 2014;
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < columns * 7; index += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const value = seed / 233280;
    const level = value > 0.88 ? 4 : value > 0.7 ? 3 : value > 0.48 ? 2 : value > 0.24 ? 1 : 0;
    const cell = document.createElement('i');
    cell.className = `l${level}`;
    cell.style.setProperty('--d', `${(Math.floor(index / 7) * 0.12).toFixed(2)}s`);
    fragment.appendChild(cell);
  }
  heatmap.appendChild(fragment);
}

// Pixel-matrix hero title, same method as the reference site:
// rasterise each line with the 12px Fusion Pixel font, then redraw every lit pixel as a square.
const pixelTitle = document.querySelector('.hero-title');
if (pixelTitle && document.fonts) {
  const MATRIX_FONT = '12px "Fusion Pixel 12px Proportional SC"';
  const lines = [...pixelTitle.querySelectorAll('.hero-title-line')];
  const rasterise = (text) => {
    const probe = document.createElement('canvas');
    const ctx = probe.getContext('2d');
    ctx.font = MATRIX_FONT;
    probe.width = Math.ceil(ctx.measureText(text).width) + 8;
    probe.height = 24;
    ctx.fillStyle = '#fff';
    ctx.font = MATRIX_FONT;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 4, 18);
    const data = ctx.getImageData(0, 0, probe.width, probe.height).data;
    const pixels = [];
    let minX = probe.width, maxX = -1, minY = probe.height, maxY = -1;
    for (let y = 0; y < probe.height; y += 1) {
      for (let x = 0; x < probe.width; x += 1) {
        if (data[(y * probe.width + x) * 4 + 3] < 96) continue;
        pixels.push([x, y]);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    if (maxX < minX) return { columns: 0, rows: 0, pixels: [] };
    return { columns: maxX - minX + 1, rows: maxY - minY + 1, pixels: pixels.map(([x, y]) => [x - minX, y - minY]) };
  };
  let lastWidth = -1;
  let shapes = null;
  const render = async () => {
    try { await document.fonts.load(MATRIX_FONT); } catch { return; }
    if (!document.fonts.check(MATRIX_FONT)) return;
    const boxWidth = Math.floor(pixelTitle.getBoundingClientRect().width);
    if (boxWidth <= 0 || boxWidth === lastWidth) return;
    lastWidth = boxWidth;
    shapes ||= lines.map((canvas) => rasterise(canvas.dataset.text));
    const maxColumns = Math.max(...shapes.map((shape) => shape.columns));
    const fontSize = Number.parseFloat(getComputedStyle(pixelTitle).fontSize);
    const unit = Math.min(Math.max(2, Math.round(fontSize / 12)), Math.max(2, Math.floor((boxWidth + 1) / maxColumns)));
    const gap = unit >= 6 ? 2 : 1;
    const dot = Math.max(1, unit - gap);
    const dpr = window.devicePixelRatio || 1;
    shapes.forEach((shape, index) => {
      const canvas = lines[index];
      const w = shape.columns * unit - gap;
      const h = shape.rows * unit - gap;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = canvas.dataset.accent ? '#ff9fda' : '#fff';
      shape.pixels.forEach(([x, y]) => ctx.fillRect(x * unit, y * unit, dot, dot));
    });
    pixelTitle.classList.add('is-pixel');
  };
  render();
  window.addEventListener('resize', render);
}

// Hero scene: dusk sky, drifting ASCII rain and dunes, painted on one canvas behind the header and hero.
const sceneCanvas = document.querySelector('#heroScene');
if (sceneCanvas) {
  const context = sceneCanvas.getContext('2d');
  const CHARSET = ' ..::-=+08S$#%';
  const FRAME_MS = 1000 / 24;
  let width = 0, height = 0, ratio = 1, frame = 0, running = false, last = 0;
  let sky = null, grain = null, cellW = 11, cellH = 15;

  const hash = (a, b) => {
    const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const smooth = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  function buildSky() {
    sky = document.createElement('canvas');
    sky.width = Math.max(1, Math.round(width));
    sky.height = Math.max(1, Math.round(height));
    const g = sky.getContext('2d');
    const v = g.createLinearGradient(0, 0, 0, height);
    v.addColorStop(0, '#77738f');
    v.addColorStop(0.14, '#9f9ab3');
    v.addColorStop(0.22, '#c6bfc9');
    v.addColorStop(0.28, '#d9c0c6');
    v.addColorStop(0.33, '#d99aab');
    v.addColorStop(0.38, '#cf8466');
    v.addColorStop(0.44, '#94504e');
    v.addColorStop(0.52, '#3d1f33');
    v.addColorStop(1, '#09090b');
    g.fillStyle = v;
    g.fillRect(0, 0, width, height);
    const sides = g.createRadialGradient(width / 2, height * 0.4, width * 0.1, width / 2, height * 0.4, width * 0.75);
    sides.addColorStop(0, 'rgba(0,0,0,0)');
    sides.addColorStop(1, 'rgba(46,30,62,0.45)');
    g.fillStyle = sides;
    g.fillRect(0, 0, width, height);

    grain = document.createElement('canvas');
    grain.width = 180;
    grain.height = 180;
    const n = grain.getContext('2d');
    const image = n.createImageData(180, 180);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.random() * 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    n.putImageData(image, 0, 0);
  }

  function resizeScene() {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = sceneCanvas.clientWidth;
    height = sceneCanvas.clientHeight;
    sceneCanvas.width = Math.round(width * ratio);
    sceneCanvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    cellW = width < 640 ? 9 : 11;
    cellH = width < 640 ? 12 : 15;
    buildSky();
  }

  function dune(baseY, shape, fillStops, rim) {
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width + 8; x += 8) context.lineTo(x, baseY + shape(x));
    context.lineTo(width, height);
    context.closePath();
    const top = baseY - height * 0.2;
    const fill = context.createLinearGradient(0, top, 0, height);
    fillStops.forEach(([stop, color]) => fill.addColorStop(stop, color));
    context.fillStyle = fill;
    context.fill();
    if (!rim) return;
    context.save();
    context.beginPath();
    for (let x = 0; x <= width + 8; x += 8) {
      const y = baseY + shape(x);
      if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.strokeStyle = rim;
    context.lineWidth = 2;
    context.shadowColor = rim;
    context.shadowBlur = 18;
    context.stroke();
    context.restore();
  }

  function drawScene(time) {
    const t = time * 0.001;
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.drawImage(sky, 0, 0, width, height);

    // Warm light drifting across the horizon.
    const glowX = width * (0.5 + Math.sin(t * 0.12) * 0.18);
    const glow = context.createRadialGradient(glowX, height * 0.36, 0, glowX, height * 0.36, width * 0.42);
    glow.addColorStop(0, 'rgba(255,214,200,0.35)');
    glow.addColorStop(1, 'rgba(255,214,200,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    // ASCII rain, dense at the top and dissolving toward the horizon.
    context.font = `600 ${cellW}px Consolas, "SFMono-Regular", monospace`;
    context.textBaseline = 'top';
    context.fillStyle = '#ffffff';
    const rows = Math.ceil((height * 0.46) / cellH);
    const cols = Math.ceil(width / cellW);
    const tick = Math.floor(t * 4);
    for (let row = 0; row < rows; row += 1) {
      const y = row * cellH;
      const fade = 1 - smooth(height * 0.06, height * 0.42, y);
      if (fade <= 0) continue;
      for (let col = 0; col < cols; col += 1) {
        const n = Math.sin(col * 0.035 + t * 0.35) * 0.25 + 0.2
          + Math.sin(row * 0.21 - t * 0.9 + col * 0.03) * 0.35
          + Math.sin((col + row) * 0.05 + t * 0.22) * 0.3;
        const v = (n + 1.1) / 2.2;
        const flicker = hash(col, row + tick * 0.37);
        const level = v * fade * (0.7 + flicker * 0.5);
        if (level < 0.36) continue;
        const index = Math.min(CHARSET.length - 1, Math.floor(level * CHARSET.length));
        const char = CHARSET[index];
        if (char === ' ') continue;
        context.globalAlpha = Math.min(0.72, 0.12 + level * 0.55);
        context.fillText(char, col * cellW, y);
      }
    }
    context.globalAlpha = 1;

    // Dunes: a far ridge, a central hill with a lit rim, and dark foreground slopes.
    const drift = Math.sin(t * 0.08) * width * 0.03;
    context.filter = 'blur(1.5px)';
    dune(height * 0.4, (x) => Math.sin(x * 0.004 + t * 0.05) * height * 0.018 + Math.sin(x * 0.011 - t * 0.04) * height * 0.008,
      [[0, '#6e4256'], [0.35, '#3a1d2e'], [1, '#120b10']], null);
    dune(height * 0.6, (x) => {
      const d = (x - width / 2 - drift) / Math.max(width * 0.3, 320);
      return -height * 0.26 * Math.exp(-d * d) + Math.sin(x * 0.006 + t * 0.07) * height * 0.012;
    }, [[0, '#4e2a3d'], [0.16, '#2a1422'], [0.55, '#110a0e'], [1, '#09090b']], 'rgba(255,190,205,0.28)');
    dune(height * 0.8, (x) => {
      const d = Math.abs(x - width / 2) / (width / 2);
      return -height * 0.12 * Math.pow(d, 1.6) + Math.sin(x * 0.009 - t * 0.06) * height * 0.01;
    }, [[0, '#1c0f17'], [0.3, '#0c080b'], [1, '#09090b']], 'rgba(214,140,160,0.14)');
    context.filter = 'none';

    // Film grain.
    context.globalAlpha = 0.07;
    const pattern = context.createPattern(grain, 'repeat');
    const ox = Math.floor(hash(tick, 1) * 180);
    const oy = Math.floor(hash(tick, 2) * 180);
    context.save();
    context.translate(-ox, -oy);
    context.fillStyle = pattern;
    context.fillRect(0, 0, width + 180, height + 180);
    context.restore();
    context.globalAlpha = 1;

    // Narrow screens: dim the sky behind the title so the pixel text stays readable.
    if (width < 640) {
      const scrim = context.createRadialGradient(width / 2, height * 0.3, 0, width / 2, height * 0.3, width * 0.75);
      scrim.addColorStop(0, 'rgba(24,12,22,0.5)');
      scrim.addColorStop(1, 'rgba(24,12,22,0)');
      context.fillStyle = scrim;
      context.fillRect(0, 0, width, height * 0.6);
    }

    // Fade into the page background.
    const fadeOut = context.createLinearGradient(0, height * 0.7, 0, height);
    fadeOut.addColorStop(0, 'rgba(9,9,11,0)');
    fadeOut.addColorStop(1, 'rgba(9,9,11,1)');
    context.fillStyle = fadeOut;
    context.fillRect(0, height * 0.7, width, height * 0.3);
  }

  function loop(time) {
    if (!running) return;
    if (time - last >= FRAME_MS) {
      last = time;
      drawScene(time);
    }
    frame = window.requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduceMotion || videoReady) return;
    running = true;
    frame = window.requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    window.cancelAnimationFrame(frame);
  }

  // The looping video (with its first frame as poster) is the background from the first paint.
  // Reduced motion / Save-Data keep the poster still. The canvas only appears if the video fails.
  const heroVideo = document.querySelector('#heroVideo');
  const stillPoster = heroVideo?.dataset.still === 'true';
  let videoReady = false;
  let fallbackOn = false;
  const showFallback = () => {
    if (videoReady || fallbackOn) return;
    fallbackOn = true;
    resizeScene();
    drawScene(performance.now());
    sceneCanvas.classList.add('is-active');
    start();
  };
  if (heroVideo && heroVideo.getAttribute('src') && !reduceMotion) {
    const markReady = () => {
      if (videoReady) return;
      videoReady = true;
      stop();
      sceneCanvas.classList.remove('is-active');
    };
    heroVideo.addEventListener('playing', markReady, { once: true });
    heroVideo.addEventListener('error', showFallback);
    if (heroVideo.readyState >= 3 && !heroVideo.paused) markReady();
    heroVideo.play?.().catch(() => {});
    window.setTimeout(() => { if (!videoReady && heroVideo.readyState < 2) showFallback(); }, 6000);
  } else if (!heroVideo) {
    showFallback();
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (!fallbackOn) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { resizeScene(); drawScene(performance.now()); }, 120);
  });

  if (!reduceMotion && !stillPoster) {
    let sceneVisible = true;
    const resume = () => {
      if (videoReady) heroVideo.play().catch(() => {}); else if (fallbackOn) start();
    };
    const pause = () => {
      stop();
      if (videoReady) heroVideo.pause();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        sceneVisible = entry.isIntersecting;
        if (sceneVisible) resume(); else pause();
      }, { threshold: 0.01 }).observe(sceneCanvas.parentElement);
    } else {
      start();
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause(); else if (sceneVisible) resume();
    });
  }
}

const translations = {
  zh: {
    title: '雪瑜 — Builder of AI Tools',
    description: '雪瑜的个人作品集：AI 产品、系统工程与技术写作。',
    skip: '跳到主要内容',
    navLabel: '主导航',
    nav: ['项目', '博客', '联系'],
    languageLabel: '选择语言',
    homeLabel: '雪瑜首页',
    heroEyebrow: 'Backend engineer · Shenzhen',
    heroIntro: '我是雪瑜，一名后端工程师。用 C++、Go 和 Python 构建系统，也把 AI Agent、信息聚合与开发者工具做成真正可用的产品。',
    viewWork: '查看作品',
    readBlog: '阅读 Snow Memory',
    meta: ['Shenzhen · China', 'C++ / Go / Python / Swift', 'Open source since 2014'],
    workKicker: 'Selected work',
    workTitle: '六个正在生长的产品',
    workIntro: '从每天的信息筛选，到本地设备上的 AI 开发体验。每个项目都从一个真实问题开始。',
    projectLabels: ['查看 AI Signal 产品介绍', '查看 My AI Rank 产品介绍', '查看 AIStat 产品介绍', '查看 ListeningHub 产品介绍', '查看 Snow X Assistant 产品介绍', '查看 XMemory 产品介绍', '在 GitHub 查看更多开源项目'],
    projectTitles: ['AI Signal', 'My AI Rank', 'AIStat', 'ListeningHub', 'Snow X Assistant', 'XMemory', '更多开源项目'],
    projectDescs: [
      '从信息洪流中，识别真正的信号。',
      '拖一拖，排出你的 AI 榜单。',
      'AI 用量与 Mac 状态，一眼掌握。',
      '听懂，而不只是听过。',
      '看清哪条推文正在起飞。',
      '记录灵感，积累记忆，展开长文。',
      '工具、实验和写过的代码，都在 GitHub 上。'
    ],
    projectMore: ['详情', '详情', '详情', '详情', '详情', '详情', '访问'],
    contactKicker: 'Contact',
    contactTitle: ['有值得做的事？', '一起聊聊。'],
    footer: 'Building useful things with code and curiosity.',
    backToTop: '回到页面顶部'
  },
  en: {
    title: '雪瑜 — Builder of AI Tools',
    description: '雪瑜’s portfolio: AI products, systems engineering, and technical writing.',
    skip: 'Skip to main content',
    navLabel: 'Primary navigation',
    nav: ['Work', 'Blog', 'Contact'],
    languageLabel: 'Choose language',
    homeLabel: '雪瑜 home',
    heroEyebrow: 'Backend engineer · Shenzhen',
    heroIntro: 'I’m 雪瑜, a backend engineer building systems with C++, Go, and Python—and turning AI agents, information intelligence, and developer tools into useful products.',
    viewWork: 'View selected work',
    readBlog: 'Read Snow Memory',
    meta: ['Shenzhen · China', 'C++ / Go / Python / Swift', 'Open source since 2014'],
    workKicker: 'Selected work',
    workTitle: 'Six products in progress',
    workIntro: 'From daily information filtering to local AI development tools. Every project starts with a real problem.',
    projectLabels: ['View the AI Signal product page', 'View the My AI Rank product page', 'View the AIStat product page', 'View the ListeningHub product page', 'View the Snow X Assistant product page', 'View the XMemory product page', 'See more open-source projects on GitHub'],
    projectTitles: ['AI Signal', 'My AI Rank', 'AIStat', 'ListeningHub', 'Snow X Assistant', 'XMemory', 'More open source'],
    projectDescs: [
      'Find the signal inside the noise.',
      'Drag, rank, and share your AI tier list.',
      'AI usage and Mac health at a glance.',
      'Understand it—not just hear it.',
      'Spot the posts taking off—at a glance.',
      'Capture ideas, keep what you save, write it long.',
      'Tools, experiments, and everything else I’ve shipped.'
    ],
    projectMore: ['Details', 'Details', 'Details', 'Details', 'Details', 'Details', 'Visit'],
    contactKicker: 'Contact',
    contactTitle: ['Working on something worthwhile?', 'Let’s talk.'],
    footer: 'Building useful things with code and curiosity.',
    backToTop: 'Back to top'
  }
};

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setDirectText(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  const textNode = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.nodeValue = `${value} `;
}

function setHeading(selector, lines, accentSecond = false) {
  const element = document.querySelector(selector);
  if (!element) return;
  const breakElement = document.createElement('br');
  const secondLine = accentSecond ? document.createElement('span') : document.createTextNode(lines[1]);
  if (accentSecond) secondLine.textContent = lines[1];
  element.replaceChildren(document.createTextNode(lines[0]), breakElement, secondLine);
}

function setListText(selector, values) {
  document.querySelectorAll(selector).forEach((element, index) => {
    if (values[index] !== undefined) element.textContent = values[index];
  });
}

function setAttribute(selector, attribute, value) {
  document.querySelectorAll(selector).forEach((element) => element.setAttribute(attribute, value));
}

function readStoredLanguage() {
  try {
    return localStorage.getItem('andrew-portfolio-language');
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem('andrew-portfolio-language', language);
  } catch {
    // The language still changes when storage is unavailable.
  }
}

function applyLanguage(language, persist = true) {
  const normalizedLanguage = language === 'en' ? 'en' : 'zh';
  const copy = translations[normalizedLanguage];
  document.documentElement.lang = normalizedLanguage === 'zh' ? 'zh-CN' : 'en';
  document.title = copy.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', copy.description);

  setText('.skip-link', copy.skip);
  setAttribute('.main-nav', 'aria-label', copy.navLabel);
  setListText('.main-nav a', copy.nav);
  setAttribute('.language-switch', 'aria-label', copy.languageLabel);
  setAttribute('.brand', 'aria-label', copy.homeLabel);
  setDirectText('.eyebrow', copy.heroEyebrow);
  setText('.hero-intro', copy.heroIntro);
  setDirectText('.hero-actions .button-primary', copy.viewWork);
  setDirectText('.hero-actions .text-link', copy.readBlog);
  setListText('.hero-meta > span', copy.meta);
  setText('.work .section-kicker', copy.workKicker);
  setText('#work-title', copy.workTitle);
  setText('.section-heading > p', copy.workIntro);
  document.querySelectorAll('.project-card').forEach((card, index) => {
    if (copy.projectLabels[index]) card.setAttribute('aria-label', copy.projectLabels[index]);
  });
  setListText('.project-copy h3', copy.projectTitles);
  setListText('.project-desc', copy.projectDescs);
  setListText('.project-more', copy.projectMore);
  setText('.contact .section-kicker', copy.contactKicker);
  setHeading('#contact-title', copy.contactTitle, true);
  setText('.site-footer > p', copy.footer);
  setAttribute('#backToTop', 'aria-label', copy.backToTop);

  document.querySelectorAll('[data-language]').forEach((button) => {
    const isActive = button.dataset.language === normalizedLanguage;
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (persist) storeLanguage(normalizedLanguage);
  window.requestAnimationFrame(updateProgress);
}

const savedLanguage = readStoredLanguage();
const initialLanguage = savedLanguage === 'zh' || savedLanguage === 'en'
  ? savedLanguage
  : (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');

applyLanguage(initialLanguage, false);

document.querySelectorAll('[data-language]').forEach((button) => {
  button.addEventListener('click', () => applyLanguage(button.dataset.language));
});

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

updateProgress();
