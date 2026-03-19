import { OPEN_PROJECTS, formatCountdown, getOpenRolesCount, getProjectHref, loadProjects } from "./project-data.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateCountdowns() {
  document.querySelectorAll("[data-project-countdown]").forEach((node) => {
    node.textContent = formatCountdown(node.getAttribute("data-project-countdown"));
  });
}

const runtime = {
  apiBase: (document.querySelector('meta[name="apollo-api-base"]')?.getAttribute("content") || "").replace(/\/$/, "")
};

let currentProjects = OPEN_PROJECTS;
let countdownIntervalStarted = false;

function renderSummary(projects = currentProjects) {
  const summary = document.getElementById("openProjectsSummary");
  if (!summary) return;

  const projectCount = projects.length;
  const roleCount = projects.reduce((total, project) => total + getOpenRolesCount(project), 0);
  const nearest = [...projects]
    .sort((a, b) => new Date(a.countdownDate) - new Date(b.countdownDate))[0];

  summary.innerHTML = `
    <div class="open-projects-stat">
      <span class="open-projects-stat__value">${projectCount}</span>
      <span class="open-projects-stat__label">Белсенді жоба</span>
    </div>
    <div class="open-projects-stat">
      <span class="open-projects-stat__value">${roleCount}</span>
      <span class="open-projects-stat__label">Ашық рөл</span>
    </div>
    <div class="open-projects-stat open-projects-stat--deadline">
      <span class="open-projects-stat__value" data-project-countdown="${escapeHtml(nearest?.countdownDate || "")}"></span>
      <span class="open-projects-stat__label">Ең жақын дедлайн</span>
    </div>
  `;
}

function renderOpenProjects(projects = currentProjects) {
  const grid = document.getElementById("openProjectsGrid");
  if (!grid) return;

  renderSummary(projects);

  grid.innerHTML = projects.map((project, index) => `
    <a class="open-project-card" href="${getProjectHref(project.id)}" aria-label="${escapeHtml(project.title)} жобасын ашу">
      <div class="open-project-card__media">
        <img src="${escapeHtml(project.banner)}" alt="${escapeHtml(project.title)}">
      </div>
      <div class="open-project-card__overlay"></div>
      <div class="open-project-card__glow" aria-hidden="true"></div>
      <div class="open-project-card__content">
        <div class="open-project-card__meta">
          <span class="open-project-pill open-project-pill--genre">${escapeHtml(project.genre)}</span>
          <span class="open-project-pill open-project-pill--countdown" data-project-countdown="${escapeHtml(project.countdownDate)}"></span>
          <span class="open-project-pill open-project-pill--roles">Бос рөлдер: ${getOpenRolesCount(project)}</span>
          <span class="open-project-pill open-project-pill--age">${escapeHtml(project.ageRange)}</span>
        </div>
        <div class="open-project-card__layout">
          <div class="open-project-card__copy">
            <span class="open-project-card__index">Жоба ${String(index + 1).padStart(2, "0")}</span>
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(project.description)}</p>
          </div>
          <div class="open-project-card__aside">
            <div class="open-project-card__director">
              <span>Режиссер</span>
              <strong>${escapeHtml(project.director)}</strong>
            </div>
            <span class="open-project-card__arrow" aria-hidden="true">→</span>
          </div>
        </div>
      </div>
    </a>
  `).join("");

  updateCountdowns();
  if (!countdownIntervalStarted) {
    window.setInterval(updateCountdowns, 60000);
    countdownIntervalStarted = true;
  }
}

async function initProjectsHome() {
  currentProjects = await loadProjects(runtime.apiBase);
  renderOpenProjects(currentProjects);
}

initProjectsHome();
