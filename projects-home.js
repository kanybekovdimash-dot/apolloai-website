import { OPEN_PROJECTS, formatCountdown, getOpenRolesCount, getProjectHref } from "./project-data.js";

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

function renderOpenProjects() {
  const grid = document.getElementById("openProjectsGrid");
  if (!grid) return;

  grid.innerHTML = OPEN_PROJECTS.map((project) => `
    <a class="open-project-card" href="${getProjectHref(project.id)}" aria-label="${escapeHtml(project.title)} жобасын ашу">
      <div class="open-project-card__media">
        <img src="${escapeHtml(project.banner)}" alt="${escapeHtml(project.title)}">
      </div>
      <div class="open-project-card__overlay"></div>
      <div class="open-project-card__content">
        <div class="open-project-card__meta">
          <span class="open-project-pill open-project-pill--genre">${escapeHtml(project.genre)}</span>
          <span class="open-project-pill open-project-pill--countdown" data-project-countdown="${escapeHtml(project.countdownDate)}"></span>
          <span class="open-project-pill open-project-pill--roles">Бос рөлдер: ${getOpenRolesCount(project)}</span>
        </div>
        <div class="open-project-card__layout">
          <div class="open-project-card__copy">
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(project.description)}</p>
          </div>
          <span class="open-project-card__arrow" aria-hidden="true">→</span>
        </div>
      </div>
    </a>
  `).join("");

  updateCountdowns();
  window.setInterval(updateCountdowns, 60000);
}

renderOpenProjects();
