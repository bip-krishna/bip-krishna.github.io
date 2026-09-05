/* ═══════════════════════════════════════════════════════
   GITHUB & AI API CONFIGURATION
   ═══════════════════════════════════════════════════════ */

const GITHUB_USERNAME = "bip-krishna";
const PINNED_REPOS = ["Repolens-AI", "IC-KIT", "Token-System", "GDSC-nitc"];
const INITIAL_SHOW_COUNT = 4;
const CACHE_KEY = `gh_projects_${GITHUB_USERNAME}`;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// IMPORTANT: Update this to your deployed Vercel URL once you deploy portfolio-ai-backend
const BACKEND_URL = "https://portfolio-ai-backend-nine-woad.vercel.app";

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

const projectGrid = document.getElementById("project-grid");
const modal = document.getElementById("project-modal");
const modalContent = document.getElementById("modal-content");
const modalClose = document.getElementById("modal-close");

/* ═══════════════════════════════════════════════════════
   GITHUB API
   ═══════════════════════════════════════════════════════ */

async function fetchGitHubRepos() {
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

  processed.sort((a, b) => {
    const aPin = PINNED_REPOS.indexOf(a.name);
    const bPin = PINNED_REPOS.indexOf(b.name);
    if (a.isPinned && b.isPinned) return aPin - bPin;
    if (a.isPinned) return -1;
    if (b.isPinned) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: processed, timestamp: Date.now() }));

  return processed;
}

async function fetchReadmeContent(repoName) {
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
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("!")) continue; // images
    if (trimmed.startsWith("[!")) continue; // badge
    if (trimmed.startsWith("[![")) continue; // badge
    if (trimmed.startsWith("<")) continue; // HTML tags
    if (trimmed.startsWith("---") || trimmed.startsWith("===")) continue;
    if (trimmed.length < 20) continue;

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
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^---+$/gm, "<hr>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^[-*+] (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
    .replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, "<p>$1</p>")
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
    <div class="skeleton-card">
      <div class="skeleton-line skeleton-line--sm"></div>
      <div class="skeleton-line skeleton-line--lg"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--md"></div>
      <div class="skeleton-line skeleton-line--xs"></div>
    </div>
  `).join("");
}

function renderProjects(projects, showAll = false) {
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
        <article class="project-card reveal ${isHidden ? "card-hidden" : ""}" data-project="${index}">
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
              <span>${project.stars} stars</span>
              <span>${project.forks} forks</span>
              <span class="project-card__updated">Updated ${formatDate(project.updated_at)}</span>
            </div>
            <span class="project-card__cta">View details →</span>
          </div>
        </article>
      `;
    })
    .join("");

  const actionsEl = document.getElementById("projects-actions");
  if (hiddenCount > 0 && !showAll) {
    actionsEl.innerHTML = `
      <button class="view-more-btn" id="view-more-btn">
        <span>View More Projects</span>
        <span class="view-more-count">+${hiddenCount}</span>
        <span class="view-more-arrow">↓</span>
      </button>
    `;
    document.getElementById("view-more-btn").addEventListener("click", () => {
      showingAll = true;
      revealHiddenCards();
      actionsEl.innerHTML = "";
    });
  } else {
    actionsEl.innerHTML = "";
  }

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

let currentChatHistory = [];
let currentRepoTreeStr = "";
let currentRepoSummary = "";

function renderFileTree(nodes) {
  if (!nodes || nodes.length === 0) return "<li>No files found</li>";
  let html = "<ul>";
  for (const node of nodes) {
    html += `<li class="${node.type === 'folder' ? 'is-folder' : 'is-file'}">${node.name}</li>`;
    if (node.children && node.children.length > 0) {
      html += renderFileTree(node.children);
    }
  }
  html += "</ul>";
  return html;
}

function switchTab(tabId) {
  document.querySelectorAll(".modal__tab").forEach(t => t.classList.remove("is-active"));
  document.querySelectorAll(".modal__tab-content").forEach(c => c.classList.remove("is-active"));
  document.querySelector(`[data-modal-tab="${tabId}"]`).classList.add("is-active");
  document.getElementById(`tab-${tabId}`).classList.add("is-active");
}

async function sendChatMessage(repoName) {
  const input = document.getElementById("chat-input");
  const submitBtn = document.getElementById("chat-submit");
  const messagesContainer = document.getElementById("chat-messages");

  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  submitBtn.disabled = true;

  messagesContainer.innerHTML += `<div class="chat-message user">${text}</div>`;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  currentChatHistory.push({ role: "user", content: text });

  const id = "msg-" + Date.now();
  messagesContainer.innerHTML += `<div class="chat-message assistant" id="${id}">…</div>`;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  const msgEl = document.getElementById(id);

  try {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoName: repoName,
        messages: currentChatHistory,
        treeStr: currentRepoTreeStr,
        summary: currentRepoSummary
      })
    });

    if (!response.ok) throw new Error("Failed to send message");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let assistantMessage = "";
    msgEl.innerHTML = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.content) {
              assistantMessage += data.content;
              msgEl.innerHTML = markdownToHtml(assistantMessage);
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          } catch (e) { /* ignore parse error for incomplete chunks */ }
        }
      }
    }
    currentChatHistory.push({ role: "assistant", content: assistantMessage });
  } catch (error) {
    msgEl.innerHTML = `<em>Error: ${error.message}</em>`;
    currentChatHistory.pop();
  } finally {
    submitBtn.disabled = false;
    input.focus();
  }
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
    ? `<a class="button button--ghost" href="${project.homepage}" target="_blank" rel="noreferrer">
        Open Live Demo
       </a>`
    : "";

  currentChatHistory = [];
  currentRepoTreeStr = "";
  currentRepoSummary = "";

  modalContent.innerHTML = `
    <div class="modal__content">
      <p class="eyebrow">${langDot} ${project.isPinned ? "· Pinned" : ""}</p>
      <h2>${project.name}</h2>
      <div class="modal__meta">
        ${(project.topics.length > 0 ? project.topics : [project.language || "Code"])
      .map((item) => `<span class="pill">${item}</span>`).join("")}
      </div>
      <div class="modal__stats-row">
        <span class="modal__stat"><strong>${project.stars}</strong> stars</span>
        <span class="modal__stat"><strong>${project.forks}</strong> forks</span>
        <span class="modal__stat">Updated <strong>${formatDate(project.updated_at)}</strong></span>
      </div>
      <p>${project.description || "No description available."}</p>

      <div class="modal__tabs">
        <button class="modal__tab is-active" data-modal-tab="readme" onclick="switchTab('readme')">README</button>
        <button class="modal__tab" data-modal-tab="structure" onclick="switchTab('structure')">Project Structure</button>
        <button class="modal__tab" data-modal-tab="chat" onclick="switchTab('chat')">Code Chat</button>
      </div>

      <div class="modal__tab-content is-active" id="tab-readme">
        <div id="ai-summary-container"></div>
        <div class="modal__readme" id="modal-readme">
          <div class="readme-loading">Loading README…</div>
        </div>
      </div>

      <div class="modal__tab-content" id="tab-structure">
        <div class="file-tree" id="modal-file-tree">
          <div class="readme-loading">Analyzing repository…</div>
        </div>
      </div>

      <div class="modal__tab-content" id="tab-chat">
        <div class="chat-container">
          <div class="chat-messages" id="chat-messages">
            <div class="chat-message assistant">Hi! Ask me anything about the <strong>${project.name}</strong> repository.</div>
          </div>
          <div class="chat-input-area">
            <input type="text" class="chat-input" id="chat-input" placeholder="Ask about this repo…" onkeypress="if(event.key==='Enter') sendChatMessage('${project.name}')">
            <button class="chat-submit" id="chat-submit" onclick="sendChatMessage('${project.name}')">Send</button>
          </div>
        </div>
      </div>

      <div class="modal__links">
        <a class="button" href="${project.html_url}" target="_blank" rel="noreferrer">View Repository</a>
        ${demoLink}
      </div>
    </div>
  `;

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  fetchReadmeContent(project.name).then((readme) => {
    const readmeEl = document.getElementById("modal-readme");
    if (readmeEl) {
      readmeEl.innerHTML = readme
        ? markdownToHtml(readme)
        : "<p>No README found for this repository.</p>";
    }
  });

  fetch(`${BACKEND_URL}/api/analyze?owner=bip-krishna&repo=${project.name}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.data) {
        if (data.data.summary) {
          currentRepoSummary = data.data.summary;
          const summaryContainer = document.getElementById("ai-summary-container");
          if (summaryContainer) {
            let mdStr = "";
            if (typeof data.data.summary === "object") {
              const s = data.data.summary;
              if (s.overview) mdStr += `**Overview:** ${s.overview}\n\n`;
              if (s.architecture) mdStr += `**Architecture:** ${s.architecture}\n\n`;
              if (s.techStack && s.techStack.length) mdStr += `**Tech Stack:** ${s.techStack.join(", ")}\n\n`;
            } else {
              mdStr = String(data.data.summary);
            }
            summaryContainer.innerHTML = `
              <div class="ai-summary">
                <span class="ai-summary-title">AI Summary</span>
                ${markdownToHtml(mdStr)}
              </div>
            `;
          }
        }

        if (data.data.tree) {
          const treeContainer = document.getElementById("modal-file-tree");
          if (treeContainer) {
            treeContainer.innerHTML = renderFileTree(data.data.tree);
            currentRepoTreeStr = JSON.stringify(data.data.tree.slice(0, 50));
          }
        }
      } else {
        document.getElementById("modal-file-tree").innerHTML = "<p>Could not analyze repository structure.</p>";
      }
    })
    .catch(err => {
      console.error("AI Analysis failed:", err);
      const treeContainer = document.getElementById("modal-file-tree");
      if (treeContainer) treeContainer.innerHTML = "<p>Failed to load analysis. Error: " + err.message + "</p>";
    });
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function attachModalEvents() {
  if (!projectGrid || !modal || !modalClose) return;

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

  document.querySelectorAll(".reveal:not(.is-visible)").forEach((node) => observer.observe(node));
  // Fallback: if IntersectionObserver is unavailable, reveal everything
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((node) => node.classList.add("is-visible"));
  }
}

function initWorkTabs() {
  const tabContainer = document.querySelector('.work__tabs');
  if (!tabContainer) return;

  const tabs = tabContainer.querySelectorAll('.work__tab');
  const panels = document.querySelectorAll('.work__panel');

  tabContainer.style.setProperty('--tab-count', tabs.length);

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      tabContainer.style.setProperty('--active-index', index);

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

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });

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

function initScrollProgress() {
  const progressBar = document.getElementById('scroll-progress-bar');
  if (!progressBar) return;

  function updateScroll() {
    const scrollPos = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? (scrollPos / docHeight) * 100 : 0;
    progressBar.style.width = scrollPercent + '%';
  }

  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();
}

function initFooterYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
}

/* ═══════════════════════════════════════════════════════
   SOCIAL PREVIEW HOVERCARDS (GITHUB & LINKEDIN)
   ═══════════════════════════════════════════════════════ */

const USER_CACHE_KEY = `gh_user_${GITHUB_USERNAME}`;

async function fetchGitHubUserProfile() {
  let userData = null;
  const cached = sessionStorage.getItem(USER_CACHE_KEY);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        userData = data;
      }
    } catch (_) { /* refetch if cached data corrupted */ }
  }

  if (!userData) {
    try {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}`, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (res.ok) {
        userData = await res.json();
        sessionStorage.setItem(
          USER_CACHE_KEY,
          JSON.stringify({ data: userData, timestamp: Date.now() })
        );
      }
    } catch (e) {
      console.warn("GitHub user profile fetch failed, using fallback data:", e);
    }
  }

  if (userData) {
    updateGitHubHovercards(userData);
  }
}

function updateGitHubHovercards(user) {
  if (!user) return;
  document.querySelectorAll(".gh-card-name").forEach((el) => {
    if (user.name) el.textContent = user.name;
  });
  document.querySelectorAll(".gh-card-handle").forEach((el) => {
    if (user.login) el.textContent = `@${user.login}`;
  });
  document.querySelectorAll(".gh-card-bio").forEach((el) => {
    if (user.bio) el.textContent = user.bio;
  });
  document.querySelectorAll(".gh-card-location").forEach((el) => {
    if (user.location) el.textContent = user.location;
  });
  document.querySelectorAll(".gh-card-repos").forEach((el) => {
    if (typeof user.public_repos === "number") el.textContent = String(user.public_repos);
  });
  document.querySelectorAll(".gh-card-followers").forEach((el) => {
    if (typeof user.followers === "number") el.textContent = String(user.followers);
  });
  if (user.avatar_url) {
    document.querySelectorAll(".hovercard--github .hovercard__avatar").forEach((img) => {
      img.src = user.avatar_url;
    });
  }
}

function updateGitHubHovercardStars(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return;
  const totalStars = projects.reduce((acc, p) => acc + (p.stars || 0), 0);
  document.querySelectorAll(".gh-card-stars").forEach((el) => {
    el.textContent = `★ ${totalStars}`;
  });
}

function initSocialHovercards() {
  const wrappers = document.querySelectorAll(".social-preview-wrapper");
  if (!wrappers.length) return;

  wrappers.forEach((wrapper) => {
    const btn = wrapper.querySelector(".social-btn");
    const card = wrapper.querySelector(".hovercard");
    if (!btn || !card) return;

    const isTop = card.classList.contains("hovercard--top");

    function setCardPlacement() {
      if (isTop) {
        card.style.setProperty("bottom", "calc(100% + 14px)", "important");
        card.style.setProperty("top", "auto", "important");
      } else {
        card.style.setProperty("top", "calc(100% + 14px)", "important");
        card.style.setProperty("bottom", "auto", "important");
      }
      card.style.setProperty("z-index", "9999999", "important");
    }

    setCardPlacement();

    function adjustPosition() {
      card.style.left = "";
      card.style.right = "";
      setCardPlacement();
      wrapper.style.setProperty("z-index", "999999", "important");

      const rect = card.getBoundingClientRect();
      const padding = 16;

      // Smart collision adjustment: keep card inside viewport bounds
      if (rect.right > window.innerWidth - padding) {
        const overflow = rect.right - (window.innerWidth - padding);
        card.style.left = `calc(0px - ${overflow}px)`;
      } else if (rect.left < padding) {
        const underflow = padding - rect.left;
        card.style.left = `${underflow}px`;
      }
    }

    wrapper.addEventListener("mouseenter", adjustPosition);
    btn.addEventListener("focus", adjustPosition);

    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        wrapper.classList.remove("is-open");
        btn.focus();
      }
    });

    btn.addEventListener("touchstart", () => {
      adjustPosition();
    }, { passive: true });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".social-preview-wrapper")) {
      wrappers.forEach((w) => w.classList.remove("is-open"));
    }
  });
}

/* ═══════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════ */

async function initProjects() {
  if (!projectGrid) return;

  renderSkeletons();

  try {
    allProjects = await fetchGitHubRepos();

    const enrichPromises = allProjects.map(async (project) => {
      if (!project.description || project.description.length < 30) {
        try {
          const readme = await fetchReadmeContent(project.name);
          const extracted = extractDescriptionFromReadme(readme);
          if (extracted) project.description = extracted;
        } catch (_) { /* keep original description */ }
      }
    });

    await Promise.allSettled(enrichPromises.slice(0, 10));

    renderProjects(allProjects, false);
    updateGitHubHovercardStars(allProjects);
  } catch (error) {
    console.warn("GitHub API fetch failed, using fallback data:", error);
    allProjects = FALLBACK_PROJECTS;
    renderProjects(allProjects, false);
    updateGitHubHovercardStars(allProjects);
  }
}

attachModalEvents();
attachReveal();
initWorkTabs();
initMobileMenu();
initScrollProgress();
initFooterYear();
initSocialHovercards();
fetchGitHubUserProfile();
initProjects();