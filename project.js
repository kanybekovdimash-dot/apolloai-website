
import { getProjectById, getProjectHref, getOpenRolesCount, formatCountdown, OPEN_PROJECTS } from "./project-data.js";

const runtime = {
  apiBase: (document.querySelector('meta[name="apollo-api-base"]')?.getAttribute("content") || "").replace(/\/$/, "")
};

const state = {
  project: null,
  activeRoleId: null,
  notice: "",
  applied: loadAppliedState(),
  countdownTimer: null
};

const root = document.getElementById("projectPage");

function loadAppliedState() {
  try {
    return JSON.parse(localStorage.getItem("meyram-project-applications") || "[]");
  } catch {
    return [];
  }
}

function saveAppliedState() {
  localStorage.setItem("meyram-project-applications", JSON.stringify(state.applied));
}

function getAppliedKey(roleId) {
  return `${state.project.id}:${roleId}`;
}

function formatDateLong(dateString) {
  const months = [
    "қаңтар",
    "ақпан",
    "наурыз",
    "сәуір",
    "мамыр",
    "маусым",
    "шілде",
    "тамыз",
    "қыркүйек",
    "қазан",
    "қараша",
    "желтоқсан"
  ];

  const date = new Date(dateString);
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("id");
  state.project = getProjectById(projectId) || OPEN_PROJECTS[0];
  renderPage();
  bindPageEvents();
  updateCountdownLabels();
  state.countdownTimer = window.setInterval(updateCountdownLabels, 60000);
}

function renderPage() {
  if (!root || !state.project) {
    return;
  }

  const openRoles = getOpenRolesCount(state.project);
  const deadline = formatDateLong(state.project.countdownDate);

  root.innerHTML = `
    <section class="project-hero">
      <div class="project-hero__media"><img src="${escapeHtml(state.project.banner)}" alt="${escapeHtml(state.project.title)}"></div>
      <div class="project-hero__overlay"></div>
      <div class="project-hero__content">
        <a class="project-back-link" href="/">← Басты бетке оралу</a>
        <div class="project-hero__chips">
          <span class="project-chip project-chip--gold">${escapeHtml(state.project.genre)}</span>
          <span class="project-chip project-chip--danger" data-project-countdown="${escapeHtml(state.project.countdownDate)}"></span>
          <span class="project-chip project-chip--info">Бос рөлдер: ${openRoles}</span>
        </div>
        <h1>${escapeHtml(state.project.title)}</h1>
        <p>${escapeHtml(state.project.description)}</p>
      </div>
    </section>

    <section class="project-page__section">
      ${state.notice ? `<div class="project-notice">${escapeHtml(state.notice)}</div>` : ""}
      <div class="project-layout">
        <aside class="project-sidebar">
          <div class="project-poster-card">
            <img src="${escapeHtml(state.project.poster)}" alt="${escapeHtml(state.project.title)} постері">
          </div>
          <div class="project-info-card">
            <p class="project-info-card__eyebrow">Жоба туралы</p>
            <div class="project-info-list">
              <div><span>Режиссер</span><strong>${escapeHtml(state.project.director)}</strong></div>
              <div><span>Жас санаты</span><strong>${escapeHtml(state.project.ageRange)}</strong></div>
              <div><span>Дедлайн</span><strong>${escapeHtml(deadline)}</strong></div>
              <div><span>Барлық рөлдер</span><strong>${state.project.roles.length}</strong></div>
            </div>
            <button class="project-secondary-link" type="button" data-copy-project-link>Жоба сілтемесін көшіру</button>
          </div>
        </aside>

        <div class="project-main">
          <div class="project-main__header">
            <p class="eyebrow">Ашық рөлдер</p>
            <h2>Қолжетімді кейіпкерлер</h2>
          </div>
          <div class="project-roles">
            ${state.project.roles.map(renderRoleCard).join("")}
          </div>
        </div>
      </div>
    </section>

    <div class="project-modal${state.activeRoleId ? " is-open" : ""}" id="projectApplicationModal" aria-hidden="${state.activeRoleId ? "false" : "true"}">
      <div class="project-modal__backdrop" data-close-modal></div>
      <div class="project-modal__dialog" role="dialog" aria-modal="true" aria-label="Жобаға өтінім беру">
        <button class="project-modal__close" type="button" data-close-modal aria-label="Жабу">×</button>
        ${renderModalInner()}
      </div>
    </div>
  `;
}

function renderRoleCard(role) {
  const applied = state.applied.includes(getAppliedKey(role.id));
  const isOpen = role.status === "open";
  const applicants = Array.isArray(role.applicants) ? role.applicants.slice(0, 3) : [];
  const applicantsPreview = applicants.length
    ? `
        <div class="project-role-avatars" aria-label="Үміткерлер превьюі">
          ${applicants
            .map((avatar, index) => `<img src="${escapeHtml(avatar)}" alt="Үміткер ${index + 1}">`)
            .join("")}
          <span>+${Math.max(role.applicantsCount - applicants.length, 0)}</span>
        </div>`
    : "";
  const selectedActor = role.selectedActor && typeof role.selectedActor === "object"
    ? `
        <div class="project-selected-actor">
          <img src="${escapeHtml(role.selectedActor.avatar)}" alt="${escapeHtml(role.selectedActor.name)}">
          <div>
            <strong>${escapeHtml(role.selectedActor.name)}</strong>
            <span>Рөл бекітілді</span>
          </div>
        </div>`
    : "";

  return `
    <article class="project-role-card ${isOpen ? "" : "is-filled"}">
      <div class="project-role-card__head">
        <div>
          <h3>${escapeHtml(role.title)}</h3>
          <p>${escapeHtml(role.description)}</p>
        </div>
        <span class="project-role-badge ${isOpen ? "is-open" : "is-filled"}">${isOpen ? "Кастинг жүріп жатыр" : "Актер таңдалды"}</span>
      </div>
      <div class="project-role-meta">
        <span>${escapeHtml(role.ageRange)}</span>
        <span>${escapeHtml(role.gender)}</span>
        <span>${role.applicantsCount} өтінім</span>
      </div>
      <div class="project-role-card__footer">
        <div class="project-role-summary-wrap">
          <div class="project-role-summary">${isOpen ? `Қазір ${role.applicantsCount} үміткер осы рөлге өтінім жіберген.` : "Рөл бойынша шешім қабылданды."}</div>
          ${isOpen ? applicantsPreview : selectedActor}
        </div>
        ${isOpen ? `<button class="project-role-action" type="button" data-role-id="${escapeHtml(role.id)}" ${applied ? "disabled" : ""}>${applied ? "Өтінім жіберілді" : "Өтінім беру"}</button>` : `<span class="project-role-closed">Кастинг жабық</span>`}
      </div>
    </article>
  `;
}

function renderModalInner() {
  if (!state.activeRoleId) {
    return "";
  }

  const role = state.project.roles.find((item) => item.id === state.activeRoleId);
  if (!role) {
    return "";
  }

  return `
    <div class="project-modal__content">
      <p class="eyebrow">Өтінім</p>
      <h3>${escapeHtml(role.title)}</h3>
      <p class="project-modal__lead">${escapeHtml(state.project.title)} жобасына қатысу үшін қысқа анкетаны толтырыңыз. Өтінім менеджерге Telegram арқылы жіберіледі.</p>
      <form id="projectApplicationForm" class="project-form">
        <input type="hidden" name="roleId" value="${escapeHtml(role.id)}">
        <div class="project-form__grid">
          <label><span>Бала / актер аты *</span><input name="fullName" type="text" required placeholder="Аты-жөні"></label>
          <label><span>Жасы *</span><input name="age" type="number" min="8" max="18" required placeholder="14"></label>
          <label><span>Қала *</span><input name="city" type="text" required placeholder="Алматы"></label>
          <label><span>Ата-ана аты *</span><input name="parentName" type="text" required placeholder="Ата-ана немесе өкіл"></label>
          <label><span>Телефон / WhatsApp *</span><input name="phone" type="tel" required placeholder="+7 777 123 45 67"></label>
          <label><span>Портфолио сілтемесі</span><input name="portfolioUrl" type="url" placeholder="Instagram / Drive / YouTube"></label>
        </div>
        <label><span>Тәжірибе</span><textarea name="experience" rows="3" placeholder="Сахна, түсірілім, би, вокал немесе басқа тәжірибе"></textarea></label>
        <label><span>Неге дәл осы рөлге лайықсыз? *</span><textarea name="note" rows="4" required placeholder="Қысқаша өзіңіздің ерекшелігіңізді жазыңыз"></textarea></label>
        <div class="project-form__actions">
          <button class="project-form__ghost" type="button" data-close-modal>Бас тарту</button>
          <button class="project-form__submit" type="submit">Өтінімді жіберу</button>
        </div>
        <p class="project-form__help">Жіберу арқылы дербес деректерді өңдеуге келісім бересіз.</p>
      </form>
    </div>
  `;
}
function bindPageEvents() {
  document.querySelector("[data-copy-project-link]")?.addEventListener("click", async () => {
    const target = `${window.location.origin}${getProjectHref(state.project.id)}`;

    try {
      await navigator.clipboard.writeText(target);
      showNotice("Жоба сілтемесі көшірілді.");
    } catch {
      showNotice("Сілтемені көшіру мүмкін болмады.");
    }
  });

  document.querySelectorAll("[data-role-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRoleId = button.getAttribute("data-role-id");
      renderPage();
      bindPageEvents();
      bindModalEvents();
      updateCountdownLabels();
    });
  });

  bindModalEvents();
}

function bindModalEvents() {
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  const form = document.getElementById("projectApplicationForm");
  form?.addEventListener("submit", submitApplication);
}

function closeModal() {
  state.activeRoleId = null;
  renderPage();
  bindPageEvents();
  updateCountdownLabels();
}

async function submitApplication(event) {
  event.preventDefault();
  if (!state.activeRoleId) return;

  const form = event.currentTarget;
  const submitButton = form.querySelector('[type="submit"]');
  const role = state.project.roles.find((item) => item.id === state.activeRoleId);
  if (!role) return;

  const formData = new FormData(form);
  const applicant = {
    fullName: String(formData.get("fullName") || "").trim(),
    age: String(formData.get("age") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    parentName: String(formData.get("parentName") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    portfolioUrl: String(formData.get("portfolioUrl") || "").trim(),
    experience: String(formData.get("experience") || "").trim(),
    note: String(formData.get("note") || "").trim()
  };

  if (!applicant.fullName || !applicant.age || !applicant.city || !applicant.parentName || !applicant.phone || !applicant.note) {
    showNotice("Барлық міндетті өрістерді толтырыңыз.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Жіберілуде...";

  try {
    await fetchJson(`${runtime.apiBase}/project-application`, {
      method: "POST",
      body: JSON.stringify({
        projectId: state.project.id,
        projectTitle: state.project.title,
        roleId: role.id,
        roleTitle: role.title,
        applicant
      })
    });

    state.applied.push(getAppliedKey(role.id));
    saveAppliedState();
    state.notice = `${role.title} рөліне өтінім сәтті жіберілді.`;
    closeModal();
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => {
      state.notice = "";
      renderPage();
      bindPageEvents();
      updateCountdownLabels();
    }, 5000);
  } catch (error) {
    showNotice(error.message || "Өтінімді жіберу мүмкін болмады.");
    submitButton.disabled = false;
    submitButton.textContent = "Өтінімді жіберу";
  }
}

function showNotice(message) {
  state.notice = message;
  renderPage();
  bindPageEvents();
  updateCountdownLabels();
}

function updateCountdownLabels() {
  document.querySelectorAll("[data-project-countdown]").forEach((node) => {
    node.textContent = formatCountdown(node.getAttribute("data-project-countdown"));
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || data?.message || "Сервер уақытша жауап бермеді.");
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
