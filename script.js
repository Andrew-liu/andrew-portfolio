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

const translations = {
  zh: {
    title: '雪瑜 — Builder of AI Tools',
    description: '雪瑜的个人作品集：AI 产品、系统工程与技术写作。',
    skip: '跳到主要内容',
    navLabel: '主导航',
    nav: ['项目', '博客', '关于', '联系'],
    languageLabel: '选择语言',
    homeLabel: '雪瑜首页',
    heroEyebrow: 'Backend engineer · AI builder',
    heroTitle: ['把想法做成', '能用的产品。'],
    heroIntro: '我是雪瑜，一名后端工程师。用 C++、Go 和 Python 构建系统，也把 AI Agent、信息聚合与开发者工具做成真正可用的产品。',
    viewWork: '查看作品',
    readBlog: '阅读 Snow Memory',
    heroStageLabel: '从信号到产品的工程路径',
    focusLabel: 'Current focus',
    focus: 'AI Agents × LLM',
    meta: ['Shenzhen · China', 'C++ / Go / Python / Swift', 'Open source since 2014'],
    workKicker: 'Selected work',
    workTitle: '四个正在生长的产品',
    workIntro: '从每天的信息筛选，到本地设备上的 AI 开发体验。每个项目都从一个真实问题开始。',
    projectLabels: ['访问 AI Signal', '访问 My AI Rank', '访问 AIStat GitHub 仓库', '访问 ListeningHub'],
    signalTitle: ['从信息洪流中，', '识别真正的信号。'],
    signalIntro: '聚合过去 24 小时 AI 动态，合并重复报道，保留原始信源，把新闻流变成可判断的信号。',
    signalStats: ['STORIES SCANNED', 'TRUSTED SOURCES', 'SIGNAL CLUSTERS'],
    consoleFeed: 'LIVE INTELLIGENCE FEED',
    velocity: 'SIGNAL VELOCITY',
    feedTitles: ['New model release', 'Agent ecosystem update', 'Open-source momentum'],
    feedMeta: ['8 sources · HIGH CONFIDENCE', '5 sources · RISING', '4 sources · WATCH'],
    consoleFoot: ['FILTERED 68% NOISE', 'UPDATED 2 MIN AGO'],
    ticker: ['MODEL RELEASES', 'AGENT WORKFLOWS', 'OPEN SOURCE', 'INFRASTRUCTURE', 'RESEARCH'],
    rankTitle: '拖一拖，排出你的 AI 榜单。',
    rankIntro: '排列常用模型与编程 Agent，并一键导出适合分享的 PNG。',
    aistatTitle: 'AI 用量与 Mac 状态，一眼掌握。',
    aistatIntro: '本地优先的 macOS 菜单栏仪表盘，集中展示额度、成本、系统指标与 Keep Awake。',
    listeningTitle: '听懂，而不只是听过。',
    listeningIntro: '把双语字幕、纯听模式与词汇复习放进同一个学习闭环。',
    aboutKicker: 'About',
    aboutTitle: ['工程是底色，', '好奇心是驱动。'],
    aboutLead: '多年后端与系统开发经验，让我习惯从可靠性、性能和边界条件出发；现在，我把这套方法带进 AI 产品。',
    aboutBody: '我关注 Agent 工作流、RAG、Coding Agent 和本地模型，也持续记录真实的部署过程与踩坑经验。我更喜欢先做出一个小而完整的闭环，再让它在使用中长大。',
    skillsLabel: 'Technical skills',
    principle: 'Working principle',
    quote: ['“从真实问题出发，', '把复杂留在系统里。”'],
    visitBlog: '访问个人博客',
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
    nav: ['Work', 'Blog', 'About', 'Contact'],
    languageLabel: 'Choose language',
    homeLabel: '雪瑜 home',
    heroEyebrow: 'Backend engineer · AI builder',
    heroTitle: ['Turning ideas into', 'useful products.'],
    heroIntro: 'I’m 雪瑜, a backend engineer building systems with C++, Go, and Python—and turning AI agents, information intelligence, and developer tools into useful products.',
    viewWork: 'View selected work',
    readBlog: 'Read Snow Memory',
    heroStageLabel: 'Engineering path from signal to product',
    focusLabel: 'Current focus',
    focus: 'AI Agents × LLM',
    meta: ['Shenzhen · China', 'C++ / Go / Python / Swift', 'Open source since 2014'],
    workKicker: 'Selected work',
    workTitle: 'Four products in progress',
    workIntro: 'From daily information filtering to local AI development tools. Every project starts with a real problem.',
    projectLabels: ['Visit AI Signal', 'Visit My AI Rank', 'Visit the AIStat GitHub repository', 'Visit ListeningHub'],
    signalTitle: ['Find the signal', 'inside the noise.'],
    signalIntro: 'AI updates from the past 24 hours, deduplicated and clustered with every original source preserved—turning a news stream into actionable intelligence.',
    signalStats: ['STORIES SCANNED', 'TRUSTED SOURCES', 'SIGNAL CLUSTERS'],
    consoleFeed: 'LIVE INTELLIGENCE FEED',
    velocity: 'SIGNAL VELOCITY',
    feedTitles: ['New model release', 'Agent ecosystem update', 'Open-source momentum'],
    feedMeta: ['8 sources · HIGH CONFIDENCE', '5 sources · RISING', '4 sources · WATCH'],
    consoleFoot: ['FILTERED 68% NOISE', 'UPDATED 2 MIN AGO'],
    ticker: ['MODEL RELEASES', 'AGENT WORKFLOWS', 'OPEN SOURCE', 'INFRASTRUCTURE', 'RESEARCH'],
    rankTitle: 'Drag, rank, and share your AI tier list.',
    rankIntro: 'Arrange the models and coding agents you use, then export a share-ready PNG in one click.',
    aistatTitle: 'AI usage and Mac health at a glance.',
    aistatIntro: 'A local-first macOS menu bar dashboard for quotas, costs, system metrics, and Keep Awake.',
    listeningTitle: 'Understand it—not just hear it.',
    listeningIntro: 'Bilingual subtitles, listening-only practice, and vocabulary review in one learning loop.',
    aboutKicker: 'About',
    aboutTitle: ['Engineering is the foundation.', 'Curiosity is the engine.'],
    aboutLead: 'Years of backend and systems work taught me to start with reliability, performance, and edge cases. Now I bring that discipline to AI products.',
    aboutBody: 'I explore agent workflows, RAG, coding agents, and local models while documenting real deployment lessons. I prefer building a small, complete loop first, then letting it grow through use.',
    skillsLabel: 'Technical skills',
    principle: 'Working principle',
    quote: ['“Start with a real problem.', 'Keep the complexity inside the system.”'],
    visitBlog: 'Visit my blog',
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
  setHeading('#hero-title', copy.heroTitle, true);
  setText('.hero-intro', copy.heroIntro);
  setDirectText('.hero-actions .button', copy.viewWork);
  setDirectText('.hero-actions .text-link', copy.readBlog);
  setAttribute('.hero-stage', 'aria-label', copy.heroStageLabel);
  setText('.hero-note span', copy.focusLabel);
  setText('.hero-note strong', copy.focus);
  setListText('.hero-meta span', copy.meta);
  setText('.work .section-kicker', copy.workKicker);
  setText('#work-title', copy.workTitle);
  setText('.section-heading > p', copy.workIntro);
  document.querySelectorAll('.project-card').forEach((card, index) => {
    if (copy.projectLabels[index]) card.setAttribute('aria-label', copy.projectLabels[index]);
  });
  setHeading('.signal-intro h3', copy.signalTitle);
  setText('.signal-intro > p:last-of-type', copy.signalIntro);
  setListText('.signal-stats small', copy.signalStats);
  setDirectText('.console-head span:first-child', copy.consoleFeed);
  setText('.chart-label span', copy.velocity);
  setListText('.signal-feed strong', copy.feedTitles);
  setListText('.signal-feed small', copy.feedMeta);
  setListText('.console-foot span', copy.consoleFoot);
  setListText('.signal-ticker span', copy.ticker);
  setText('.project-rank .project-copy h3', copy.rankTitle);
  setText('.project-rank .project-copy > p:last-child', copy.rankIntro);
  setText('.project-aistat .project-copy h3', copy.aistatTitle);
  setText('.project-aistat .project-copy > p:last-child', copy.aistatIntro);
  setText('.project-listening .project-copy h3', copy.listeningTitle);
  setText('.project-listening .project-copy > p:last-child', copy.listeningIntro);
  setText('.about .section-kicker', copy.aboutKicker);
  setHeading('#about-title', copy.aboutTitle, true);
  setText('.about-lead', copy.aboutLead);
  setText('.about-body > p:nth-of-type(2)', copy.aboutBody);
  setAttribute('.skill-row', 'aria-label', copy.skillsLabel);
  setText('.aside-label', copy.principle);
  setHeading('.about-aside blockquote', copy.quote);
  setDirectText('.about-aside .text-link', copy.visitBlog);
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
