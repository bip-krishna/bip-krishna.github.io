/* ═══════════════════════════════════════════════════════
   GITHUB API CONFIGURATION
   ═══════════════════════════════════════════════════════ */

const GITHUB_USERNAME = "bip-krishna";
const PINNED_REPOS = ["Repolens-AI", "IC-KIT", "Token-System", "GDSC-nitc"];
const INITIAL_SHOW_COUNT = 4;
const CACHE_KEY = `gh_projects_${GITHUB_USERNAME}`;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Fallback data if API fails
const FALLBACK_PROJECTS = [
  {
    name: "Token-System",
    language: "Python",
    description: "A physical reporting and token management system built with Flask for NIT Calicut — a practical full-stack utility prototype.",
    stars: 1, forks: 0, html_url: "https://github.com/bip-krishna/Token-System",
    homepage: "", updated_at: "2024-01-01", topics: ["Python", "Flask", "HTML", "Full Stack"], isPinned: true
  },
  {
    name: "IC-KIT",
    language: "JavaScript",
    description: "A project that mimics a real IC trainer kit using Arduino UNO, bridging interactive presentation with a more hands-on engineering concept.",
    stars: 1, forks: 0, html_url: "https://github.com/bip-krishna/IC-KIT",
    homepage: "", updated_at: "2024-01-01", topics: ["JavaScript", "Arduino UNO", "Educational Demo"], isPinned: true
  },
  {
    name: "cursor-follower-spline",
    language: "HTML",
    description: "A cursor-reactive HTML experiment published on GitHub Pages that directly showcases interest in motion, responsiveness, and playful depth.",
    stars: 0, forks: 0, html_url: "https://github.com/bip-krishna/cursor-follower-spline",
    homepage: "https://bip-krishna.github.io/cursor-follower-spline/", updated_at: "2024-01-01", topics: ["HTML", "CSS", "JavaScript"], isPinned: true
  },
  {
    name: "GDSC-nitc",
    language: "CSS",
    description: "A campus/community web project for event-facing presentation and UI work for an audience beyond a single personal experiment.",
    stars: 0, forks: 0, html_url: "https://github.com/bip-krishna/GDSC-nitc",
    homepage: "", updated_at: "2024-01-01", topics: ["CSS", "HTML", "Community Web"], isPinned: true
  }
];

// Language colors (GitHub style)
const LANG_COLORS = {
  JavaScript: "#f1e05a", Python: "#3572A5", HTML: "#e34c26", CSS: "#563d7c",
  TypeScript: "#3178c6", Java: "#b07219", "C++": "#f34b7d", C: "#555555",
  Ruby: "#701516", Go: "#00ADD8", Rust: "#dea584", Shell: "#89e051",
  PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB",
  Vue: "#41b883", SCSS: "#c6538c", Jupyter: "#DA5B0B", null: "#8b949e"
};

/* ═══════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════ */

let allProjects = [];
let showingAll = false;
let readmeCache = {};

const typedPhrases = [
  "cinematic.",
  "alive.",
  "tactile.",
  "futuristic.",
  "engineered."
];

const projectGrid = document.getElementById("project-grid");
const modal = document.getElementById("project-modal");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");
const typedText = document.getElementById("typed-text");
const canvas = document.getElementById("scene-canvas");

/* ═══════════════════════════════════════════════════════
   GITHUB API
   ═══════════════════════════════════════════════════════ */

async function fetchGitHubRepos() {
  // Check sessionStorage cache
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    } catch (_) { /* cache corrupted, refetch */ }
  }

  const response = await fetch(
    `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated&direction=desc`,
    { headers: { Accept: "application/vnd.github+json" } }
  );

  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);

  const repos = await response.json();

  // Filter out forks and process
  const processed = repos
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      name: repo.name,
      language: repo.language,
      description: repo.description || "",
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      html_url: repo.html_url,
      homepage: repo.homepage || "",
      updated_at: repo.updated_at,
      topics: repo.topics || [],
      isPinned: PINNED_REPOS.includes(repo.name)
    }));

  // Sort: pinned first (in order), then by updated_at
  processed.sort((a, b) => {
    const aPin = PINNED_REPOS.indexOf(a.name);
    const bPin = PINNED_REPOS.indexOf(b.name);
    if (a.isPinned && b.isPinned) return aPin - bPin;
    if (a.isPinned) return -1;
    if (b.isPinned) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  // Cache
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: processed, timestamp: Date.now() }));

  return processed;
}

async function fetchReadmeContent(repoName) {
  // Check readme cache
  if (readmeCache[repoName]) return readmeCache[repoName];

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}/readme`,
      { headers: { Accept: "application/vnd.github.raw+json" } }
    );
    if (!response.ok) return null;
    const text = await response.text();
    readmeCache[repoName] = text;
    return text;
  } catch (_) {
    return null;
  }
}

function extractDescriptionFromReadme(readmeText) {
  if (!readmeText) return null;
  const lines = readmeText.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headings, badges, blank lines, images, HTML tags
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("!")) continue; // images
    if (trimmed.startsWith("[!")) continue; // badge
    if (trimmed.startsWith("[![")) continue; // badge
    if (trimmed.startsWith("<")) continue; // HTML tags
    if (trimmed.startsWith("---") || trimmed.startsWith("===")) continue;
    if (trimmed.length < 20) continue; // too short to be a real description

    // Found a meaningful paragraph
    let desc = trimmed.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // strip markdown links
    desc = desc.replace(/[*_`~]/g, ""); // strip formatting
    if (desc.length > 200) desc = desc.slice(0, 197) + "…";
    return desc;
  }
  return null;
}

function markdownToHtml(md) {
  if (!md) return "<p>No README available.</p>";
  return md
    // Code blocks (``` ```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // Headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Horizontal rules
    .replace(/^---+$/gm, "<hr>")
    // Blockquotes
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Unordered lists
    .replace(/^[-*+] (.+)$/gm, "<li>$1</li>")
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
    // Paragraphs: wrap remaining standalone lines
    .replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, "<p>$1</p>")
    // Clean up empty lines
    .replace(/\n{3,}/g, "\n\n");
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getLangColor(lang) {
  return LANG_COLORS[lang] || LANG_COLORS[null];
}

/* ═══════════════════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════════════════ */

function renderSkeletons() {
  projectGrid.innerHTML = Array.from({ length: 4 }, () => `
    <div class="skeleton-card glass">
      <div class="skeleton-line skeleton-line--sm"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--xs"></div>
    </div>
  `).join("");
}

function renderProjects(projects, showAll = false) {
  const visible = showAll ? projects : projects.slice(0, INITIAL_SHOW_COUNT);
  const hiddenCount = projects.length - INITIAL_SHOW_COUNT;

  projectGrid.innerHTML = projects
    .map((project, index) => {
      const isHidden = !showAll && index >= INITIAL_SHOW_COUNT;
      const langColor = getLangColor(project.language);
      const pinnedBadge = project.isPinned
        ? `<span class="project-card__pinned">Pinned</span>`
        : "";
      const langDot = project.language
        ? `<span class="project-card__lang">
            <span class="project-card__lang-dot" style="background:${langColor}"></span>
            ${project.language}
           </span>`
        : "";

      return `
        <article class="project-card glass reveal ${isHidden ? "card-hidden" : ""}" data-project="${index}">
          <div class="project-card__eyebrow">
            <span>${langDot}</span>
            ${pinnedBadge}
          </div>
          <h3>${project.name}</h3>
          <p>${project.description || "No description available."}</p>
          <div class="pill-row">
            ${(project.topics.length > 0
              ? project.topics.slice(0, 4)
              : [project.language || "Code"]
            ).map((t) => `<span class="pill">${t}</span>`).join("")}
          </div>
          <div class="project-card__footer">
            <div class="project-card__stats">
              <span>⭐ ${project.stars}</span>
              <span>🍴 ${project.forks}</span>
              <span class="project-card__updated">Updated ${formatDate(project.updated_at)}</span>
            </div>
            <span class="project-card__cta">View details →</span>
          </div>
        </article>
      `;
    })
    .join("");

  // View More button
  const actionsEl = document.getElementById("projects-actions");
  if (hiddenCount > 0 && !showAll) {
    actionsEl.innerHTML = `
      <button class="view-more-btn magnetic" id="view-more-btn">
        <span>View More Projects</span>
        <span class="view-more-count">+${hiddenCount}</span>
        <span class="view-more-arrow">↓</span>
      </button>
    `;
    document.getElementById("view-more-btn").addEventListener("click", () => {
      showingAll = true;
      revealHiddenCards();
      actionsEl.innerHTML = "";
      attachMagnetic();
    });
    attachMagnetic();
  } else {
    actionsEl.innerHTML = "";
  }

  // Re-attach reveal observer for visible cards
  attachReveal();
}

function revealHiddenCards() {
  const hidden = projectGrid.querySelectorAll(".card-hidden");
  hidden.forEach((card, i) => {
    card.classList.remove("card-hidden");
    card.classList.add("card-revealing");
    card.style.animationDelay = `${i * 0.08}s`;
  });
}

function openModal(project) {
  const langColor = getLangColor(project.language);
  const langDot = project.language
    ? `<span class="project-card__lang">
        <span class="project-card__lang-dot" style="background:${langColor}"></span>
        ${project.language}
       </span>`
    : "";

  const demoLink = project.homepage
    ? `<a class="button button--ghost magnetic" href="${project.homepage}" target="_blank" rel="noreferrer">
        <span>Open Live Demo</span>
       </a>`
    : "";

  modalContent.innerHTML = `
    <div class="modal__content">
      <p class="eyebrow">${langDot} ${project.isPinned ? "· 📌 Pinned" : ""}</p>
      <h2>${project.name}</h2>
      <div class="modal__meta">
        ${(project.topics.length > 0
          ? project.topics
          : [project.language || "Code"]
        ).map((item) => `<span class="pill">${item}</span>`).join("")}
      </div>
      <div class="modal__stats-row">
        <span class="modal__stat">⭐ <strong>${project.stars}</strong> stars</span>
        <span class="modal__stat">🍴 <strong>${project.forks}</strong> forks</span>
        <span class="modal__stat">📅 Updated <strong>${formatDate(project.updated_at)}</strong></span>
      </div>
      <p>${project.description || "No description available."}</p>
      <h3>README</h3>
      <div class="modal__readme" id="modal-readme">
        <div class="readme-loading">Loading README…</div>
      </div>
      <div class="modal__links">
        <a class="button magnetic" href="${project.html_url}" target="_blank" rel="noreferrer">
          <span>View Repository</span>
        </a>
        ${demoLink}
      </div>
    </div>
  `;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  attachMagnetic();

  // Async load README
  fetchReadmeContent(project.name).then((readme) => {
    const readmeEl = document.getElementById("modal-readme");
    if (readmeEl) {
      readmeEl.innerHTML = readme
        ? markdownToHtml(readme)
        : "<p>No README found for this repository.</p>";
    }
  });
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function attachModalEvents() {
  projectGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".project-card");
    if (!card) return;
    const project = allProjects[Number(card.dataset.project)];
    if (project) openModal(project);
  });

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target.dataset.close === "true") closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function attachReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
}

function attachMagnetic() {
  document.querySelectorAll(".magnetic").forEach((button) => {
    button.addEventListener("mousemove", (event) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      button.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
    });

    button.addEventListener("mouseleave", () => {
      button.style.transform = "";
    });
  });
}

function attachParallax() {
  const cards = document.querySelectorAll(".floating-card");
  window.addEventListener("mousemove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 16;
    const y = (event.clientY / window.innerHeight - 0.5) * 16;
    cards.forEach((card, index) => {
      const factor = (index + 1) * 0.45;
      card.style.transform = `translate3d(${x * factor}px, ${y * factor}px, 0)`;
    });
  });
}

/* Intro removed — content loads instantly */

function startTypewriter() {
  if (!typedText) return;

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;
  let lastTime = 0;
  let waitUntil = 0;

  // Typing speed: ms per character
  const TYPE_SPEED = 72;
  const DELETE_SPEED = 40;
  const PAUSE_AFTER_TYPE = 1800;
  const PAUSE_AFTER_DELETE = 400;

  function tick(timestamp) {
    if (timestamp < waitUntil) {
      requestAnimationFrame(tick);
      return;
    }

    const phrase = typedPhrases[phraseIndex];

    if (!deleting) {
      charIndex++;
      typedText.textContent = phrase.slice(0, charIndex);

      if (charIndex >= phrase.length) {
        deleting = true;
        waitUntil = timestamp + PAUSE_AFTER_TYPE;
      } else {
        waitUntil = timestamp + TYPE_SPEED;
      }
    } else {
      charIndex--;
      typedText.textContent = phrase.slice(0, charIndex);

      if (charIndex <= 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % typedPhrases.length;
        waitUntil = timestamp + PAUSE_AFTER_DELETE;
      } else {
        waitUntil = timestamp + DELETE_SPEED;
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function startScene() {
  if (!canvas) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const pointer = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.35
  };

  const orbs = Array.from({ length: 10 }, (_, index) => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    z: Math.random() * 1 + 0.2,
    radius: 40 + Math.random() * 140,
    hue: index % 3 === 0 ? "255, 177, 95" : index % 2 === 0 ? "127, 214, 230" : "104, 145, 255",
    vx: (Math.random() - 0.5) * 0.18,
    vy: (Math.random() - 0.5) * 0.14
  }));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
  }

  function draw() {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const gradient = context.createLinearGradient(0, 0, 0, window.innerHeight);
    gradient.addColorStop(0, "rgba(4, 8, 14, 0.28)");
    gradient.addColorStop(1, "rgba(4, 8, 14, 0.7)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);

    orbs.forEach((orb, index) => {
      orb.x += orb.vx + (pointer.x - window.innerWidth / 2) * 0.0007 * orb.z;
      orb.y += orb.vy + (pointer.y - window.innerHeight / 2) * 0.0005 * orb.z;

      if (orb.x < -180) orb.x = window.innerWidth + 180;
      if (orb.x > window.innerWidth + 180) orb.x = -180;
      if (orb.y < -180) orb.y = window.innerHeight + 180;
      if (orb.y > window.innerHeight + 180) orb.y = -180;

      const parallaxX = (pointer.x - window.innerWidth / 2) * 0.045 * orb.z;
      const parallaxY = (pointer.y - window.innerHeight / 2) * 0.03 * orb.z;
      const x = orb.x + parallaxX;
      const y = orb.y + parallaxY;
      const radius = orb.radius * orb.z;

      const radial = context.createRadialGradient(x, y, 0, x, y, radius);
      radial.addColorStop(0, `rgba(${orb.hue}, ${0.18 + orb.z * 0.08})`);
      radial.addColorStop(0.45, `rgba(${orb.hue}, ${0.07 + orb.z * 0.05})`);
      radial.addColorStop(1, `rgba(${orb.hue}, 0)`);

      context.globalCompositeOperation = index % 4 === 0 ? "screen" : "lighter";
      context.fillStyle = radial;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    });

    context.globalCompositeOperation = "source-over";

    window.requestAnimationFrame(draw);
  }

  window.addEventListener("mousemove", (event) => {
    pointer.x += (event.clientX - pointer.x) * 0.18;
    pointer.y += (event.clientY - pointer.y) * 0.18;
  });

  window.addEventListener("touchmove", (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    pointer.x += (touch.clientX - pointer.x) * 0.18;
    pointer.y += (touch.clientY - pointer.y) * 0.18;
  });

  window.addEventListener("resize", resize);
  resize();
  draw();
}

function initWorkTabs() {
  const tabContainer = document.querySelector('.work__tabs');
  if (!tabContainer) return;

  const tabs = tabContainer.querySelectorAll('.work__tab');
  const panels = document.querySelectorAll('.work__panel');

  // Set CSS custom property for tab count
  tabContainer.style.setProperty('--tab-count', tabs.length);

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      // Update active tab
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      // Move the indicator
      tabContainer.style.setProperty('--active-index', index);

      // Switch panel
      panels.forEach((p) => p.classList.remove('is-active'));
      const targetPanel = document.querySelector(
        `.work__panel[data-panel="${tab.dataset.tab}"]`
      );
      if (targetPanel) {
        targetPanel.classList.add('is-active');
      }
    });
  });
}

function initMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('main-nav');
  if (!menuToggle || !nav) return;

  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.contains('is-open');
    nav.classList.toggle('is-open');
    menuToggle.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Close nav when a link is tapped
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Close nav on scroll (mobile UX pattern)
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - lastScroll) > 60 && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
    lastScroll = window.scrollY;
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════
   ASYNC INITIALIZATION
   ═══════════════════════════════════════════════════════ */

async function initProjects() {
  // Show skeleton loading state
  renderSkeletons();

  try {
    allProjects = await fetchGitHubRepos();

    // Enrich descriptions from README for projects missing a description
    const enrichPromises = allProjects.map(async (project) => {
      if (!project.description || project.description.length < 30) {
        try {
          const readme = await fetchReadmeContent(project.name);
          const extracted = extractDescriptionFromReadme(readme);
          if (extracted) project.description = extracted;
        } catch (_) { /* keep original description */ }
      }
    });

    // Fetch READMEs in parallel (limited to first 10 to avoid rate limits)
    await Promise.allSettled(enrichPromises.slice(0, 10));

    renderProjects(allProjects, false);
  } catch (error) {
    console.warn("GitHub API fetch failed, using fallback data:", error);
    allProjects = FALLBACK_PROJECTS;
    renderProjects(allProjects, false);
  }
}

// Non-project initialization runs immediately
attachModalEvents();
attachReveal();
attachMagnetic();
attachParallax();
startTypewriter();
startScene();
initWorkTabs();
initMobileMenu();

// Projects load async
initProjects();

/* ── Modern 3D Features (Retrofit) ───────────────── */

function initMarquee() {
  const row1 = document.getElementById('marquee-row-1');
  const row2 = document.getElementById('marquee-row-2');
  const section = document.getElementById('marquee');
  
  if (!row1 || !row2 || !section) return;

  // Duplicate items 2 times for seamless looping
  row1.innerHTML = row1.innerHTML + row1.innerHTML + row1.innerHTML;
  row2.innerHTML = row2.innerHTML + row2.innerHTML + row2.innerHTML;

  function onScroll() {
    const sectionTop = section.offsetTop;
    const offset = (window.scrollY - sectionTop + window.innerHeight) * 0.3;
    row1.style.transform = `translate3d(${offset - 200}px, 0, 0)`;
    row2.style.transform = `translate3d(${-(offset - 200)}px, 0, 0)`;
  }
  
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initAnimatedText() {
  const container = document.getElementById('animated-about-text');
  if (!container) return;

  const text = container.textContent.trim();
  container.innerHTML = '';
  
  // Split into spans
  const spans = text.split('').map(char => {
    const span = document.createElement('span');
    span.textContent = char;
    container.appendChild(span);
    return span;
  });

  function onScroll() {
    const rect = container.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    
    // Progress starts when element is 80% down the screen, ends when 20% down
    const start = windowHeight * 0.8;
    const end = windowHeight * 0.2;
    
    let progress = (start - rect.top) / (start - end);
    progress = Math.max(0, Math.min(1, progress));
    
    spans.forEach((span, i) => {
      const charStart = i / spans.length;
      const charEnd = charStart + (1 / spans.length);
      
      let charProgress = (progress - charStart) / (charEnd - charStart);
      charProgress = Math.max(0, Math.min(1, charProgress));
      
      const opacity = 0.2 + (0.8 * charProgress);
      span.style.opacity = opacity;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initScrollProgress() {
  const progressBar = document.getElementById('scroll-progress-bar');
  if (!progressBar) return;

  function updateScroll() {
    const scrollPos = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    // Prevent division by zero if docHeight is 0
    const scrollPercent = docHeight > 0 ? (scrollPos / docHeight) * 100 : 0;
    progressBar.style.width = scrollPercent + '%';
  }

  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();
}

initMarquee();
initAnimatedText();
initScrollProgress();
