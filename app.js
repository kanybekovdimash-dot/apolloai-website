const WHATSAPP_NUMBER = "+77758828516";
const HERO_AUTOPLAY_MS = 5000;
const SESSION_ENDPOINT = "/session";
const CHAT_ENDPOINT = "/chat";
const LEAD_ENDPOINT = "/lead";
const CHAT_STORAGE_KEY = "meyram-chat-widget-v2";
const CHAT_ARCHIVE_KEY = "meyram-chat-archive-v1";

const FIELD_DEFINITIONS = [
    {
        key: "childName",
        label: "Аты",
        question: "Баланың аты кім?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Баланың атын жазыңыз (кемінде 2 таңба)."
    },
    {
        key: "childAge",
        label: "Жасы",
        question: "Баланың жасы нешеде?",
        normalize: (value) => value.replace(/[^\d]/g, ""),
        validate: (value) => {
            const age = Number(value);
            return Number.isInteger(age) && age >= 4 && age <= 18;
        },
        error: "Жасын санмен жазыңыз, мысалы 9 немесе 13."
    },
    {
        key: "city",
        label: "Қала",
        question: "Қай қаладансыз?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Қалаңызды жазыңыз."
    },
    {
        key: "parentName",
        label: "Ата-ана",
        question: "Ата-анасының немесе заңды өкілінің аты кім?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Ата-ана немесе заңды өкілдің атын жазыңыз."
    },
    {
        key: "phone",
        label: "Байланыс",
        question: "Байланыс телефон нөміріңізді немесе WhatsApp жазыңыз.",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => /\d{10,}/.test(value.replace(/[^\d]/g, "")),
        error: "Телефон нөмірін жазыңыз, мысалы +7 777 123 45 67."
    },
    {
        key: "experience",
        label: "Тәжірибе",
        question: "Баланың тәжірибесі бар ма: түсірілім, сахна, курстар, TikTok немесе reels?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Қысқаша жазыңыз: тәжірибе жоқ, аз тәжірибе немесе түсірілген."
    },
    {
        key: "note",
        label: "Ескерту",
        question: "Не ескеру керек: түсірілуді армандайды, сахнаны жақсы көреді, курсқа барады немесе басқа пікіріңіз бар ма?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Менеджерге ыңғайлы болу үшін кемінде бірнеше сөз жазыңыз."
    }
];

const PROGRESS_MAP = {
    childName: 0,
    childAge: 1,
    city: 2,
    parentName: 3,
    phone: 4,
    experience: 5,
    note: 6
};

const FALLBACK_FAQ = {
    age: "Кастингке негізінен 4-18 жас аралығындағы балалар қатыса алады. Егер бала сәл кіші немесе үлкен болса, бәрібір өтінім қалдыруға болады — менеджер нақтылайды.",
    process: "Жазылу оңай: AI-көмекші қысқа анкета толтырады, содан кейін өтінімді кастинг жүйесіне сақтайды.",
    generic: "Мен кастингке жазылуға немесе жас, формат және келесі қадам туралы кеңес беруге көмектесе аламын."
};

const runtime = {
    publicBrand: readMetaContent("apollo-public-brand") || "Meyram Cinema",
    assistantBrand: readMetaContent("apollo-assistant-brand") || "",
    apiBase: resolveApiBase()
};

const state = {
    widgetOpen: false,
    initializedChat: false,
    sessionId: null,
    sessionPromise: null,
    usingLocalFallback: false,
    heroIndex: 0,
    heroTimer: null,
    pending: false,
    lead: {},
    leadActive: false,
    currentField: null,
    submittedAt: null,
    chatHistory: [],
    messageLog: [],
    archivedChats: [],
    historyPanelOpen: false
};

const elements = {
    heroSlides: Array.from(document.querySelectorAll(".hero-slide")),
    heroDots: document.getElementById("heroDots"),
    heroPrev: document.getElementById("heroPrev"),
    heroNext: document.getElementById("heroNext"),
    heroFrame: document.querySelector(".hero-frame"),
    widget: document.getElementById("castingWidget"),
    widgetMessages: document.getElementById("widgetMessages"),
    widgetInput: document.getElementById("widgetInput"),
    widgetSend: document.getElementById("widgetSend"),
    quickActions: document.getElementById("quickActions"),
    leadProgress: Array.from(document.querySelectorAll("#leadProgress span")),
    chatFab: document.getElementById("avatarFab"),
    closeWidget: document.getElementById("closeWidget"),
    newChatButton: document.getElementById("newChatButton"),
    chatHistoryButton: document.getElementById("chatHistoryButton"),
    chatHistoryPanel: document.getElementById("chatHistoryPanel"),
    chatHistoryList: document.getElementById("chatHistoryList"),
    openCastingTest: document.getElementById("openCastingTest"),
    openVideoRecord: document.getElementById("openVideoRecord"),
    openVideoModal: document.getElementById("openVideoModal"),
    videoCard: document.getElementById("videoCard"),
    videoModal: document.getElementById("videoModal"),
    videoFrame: document.getElementById("videoFrame"),
    navLinks: Array.from(document.querySelectorAll('.main-nav a[href^="#"], .mobile-dock a[href^="#"]')).filter((link) => !link.classList.contains("mobile-dock__center"))
};

function readMetaContent(name) {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
}

function resolveApiBase() {
    return (readMetaContent("apollo-api-base") || "").replace(/\/$/, "");
}

function init() {
    initHeroSlider();
    initNavigation();
    initWidget();
    initVideoModal();
    restoreWidgetState();
    syncLeadProgress();
}

function initNavigation() {
    if (!elements.navLinks.length) {
        return;
    }

    elements.navLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
            const href = link.getAttribute("href") || "";
            if (!href.startsWith("#")) {
                return;
            }

            const target = document.querySelector(href);
            if (!target) {
                return;
            }

            event.preventDefault();
            scrollToSection(target);
            setActiveNav(href);
            history.replaceState(null, "", href);
        });
    });

    window.addEventListener("scroll", syncNavToScroll, { passive: true });
    window.addEventListener("resize", syncNavToScroll);
    syncNavToScroll();
}

function scrollToSection(target) {
    const headerOffset = (document.querySelector(".site-header")?.offsetHeight || 84) + 16;
    const top = Math.max(target.getBoundingClientRect().top + window.scrollY - headerOffset, 0);
    window.scrollTo({ top, behavior: "smooth" });
}

function syncNavToScroll() {
    const sections = ["#home", "#casting", "#actors", "#projects", "#contact"]
        .map((selector) => document.querySelector(selector))
        .filter(Boolean);

    if (!sections.length) {
        return;
    }

    const threshold = (document.querySelector(".site-header")?.offsetHeight || 84) + 36;
    let current = sections[0].id;

    sections.forEach((section) => {
        if (window.scrollY + threshold >= section.offsetTop) {
            current = section.id;
        }
    });

    setActiveNav(`#${current}`);
}

function setActiveNav(href) {
    elements.navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === href);
    });
}

function initHeroSlider() {
    if (!elements.heroSlides.length || !elements.heroDots) {
        return;
    }

    elements.heroSlides.forEach((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Go to slide ${index + 1}`);
        dot.addEventListener("click", () => goToSlide(index));
        elements.heroDots.appendChild(dot);
    });

    elements.heroPrev?.addEventListener("click", () => goToSlide(state.heroIndex - 1));
    elements.heroNext?.addEventListener("click", () => goToSlide(state.heroIndex + 1));
    elements.heroFrame?.addEventListener("mouseenter", stopHeroAutoplay);
    elements.heroFrame?.addEventListener("mouseleave", startHeroAutoplay);

    goToSlide(0);
    startHeroAutoplay();
}

function goToSlide(nextIndex) {
    if (!elements.heroSlides.length) {
        return;
    }

    const total = elements.heroSlides.length;
    state.heroIndex = (nextIndex + total) % total;

    elements.heroSlides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === state.heroIndex);
    });

    Array.from(elements.heroDots.children).forEach((dot, index) => {
        dot.classList.toggle("is-active", index === state.heroIndex);
    });
}

function startHeroAutoplay() {
    stopHeroAutoplay();
    state.heroTimer = window.setInterval(() => {
        goToSlide(state.heroIndex + 1);
    }, HERO_AUTOPLAY_MS);
}

function stopHeroAutoplay() {
    if (state.heroTimer) {
        window.clearInterval(state.heroTimer);
        state.heroTimer = null;
    }
}

function initWidget() {
    elements.chatFab?.addEventListener("click", toggleWidget);
    elements.closeWidget?.addEventListener("click", closeWidget);
    elements.newChatButton?.addEventListener("click", () => {
        startNewChat();
    });
    elements.chatHistoryButton?.addEventListener("click", toggleChatHistoryPanel);
    elements.openCastingTest?.addEventListener("click", () => {
        if (typeof window.openCastingTest === "function") {
            window.openCastingTest();
        }
    });
    elements.openVideoRecord?.addEventListener("click", () => {
        if (typeof window.openVideoRecord === "function") {
            window.openVideoRecord();
        }
    });
    elements.widgetSend?.addEventListener("mousedown", (event) => {
        event.preventDefault();
        sendWidgetMessage();
    });

    elements.widgetInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendWidgetMessage();
        }
    });

    elements.widgetInput?.addEventListener("input", autoResizeTextarea);

    elements.quickActions?.addEventListener("click", (event) => {
        const target = event.target.closest("[data-action]");
        if (!target) {
            return;
        }

        const actionMap = {
            "start-lead": "Кастингке жазылғым келеді",
            "faq-age": "Жас шектеуі қандай?",
            "faq-process": "Қалай жазылуға болады?"
        };

        const message = actionMap[target.dataset.action];
        if (!message) {
            return;
        }

        elements.quickActions.hidden = true;
        elements.widgetInput.value = message;
        autoResizeTextarea({ currentTarget: elements.widgetInput });
        sendWidgetMessage();
    });

    renderChatHistoryList();
}

function toggleWidget() {
    if (state.widgetOpen) {
        closeWidget();
    } else {
        openWidget();
    }
}

async function openWidget() {
    state.widgetOpen = true;
    elements.widget?.classList.add("is-open");
    elements.widget?.setAttribute("aria-hidden", "false");
    elements.chatFab?.classList.add("is-hidden");

    await ensureSession();

    if (!state.initializedChat && !state.messageLog.length) {
        const greeting = buildGreetingMessages();
        greeting.forEach((line) => addAssistantMessage(line));
        state.initializedChat = true;
    } else if (state.messageLog.length) {
        state.initializedChat = true;
    }

    persistWidgetState();
    window.setTimeout(() => elements.widgetInput?.focus(), 80);
}

function closeWidget() {
    hideTypingIndicator();
    hideChatHistoryPanel();
    setPending(false);
    state.widgetOpen = false;
    elements.widget?.classList.remove("is-open");
    elements.widget?.setAttribute("aria-hidden", "true");
    elements.chatFab?.classList.remove("is-hidden");
    persistWidgetState();
}

function hideChatHistoryPanel() {
    state.historyPanelOpen = false;
    elements.chatHistoryPanel?.setAttribute("hidden", "hidden");
    elements.chatHistoryButton?.classList.remove("is-active");
}

function toggleChatHistoryPanel() {
    if (!elements.chatHistoryPanel) {
        return;
    }

    state.historyPanelOpen = !state.historyPanelOpen;
    elements.chatHistoryPanel.toggleAttribute("hidden", !state.historyPanelOpen);
    elements.chatHistoryButton?.classList.toggle("is-active", state.historyPanelOpen);
    renderChatHistoryList();
}

function normalizeSnapshot(snapshot) {
    return {
        sessionId: typeof snapshot?.sessionId === "string" && snapshot.sessionId ? snapshot.sessionId : null,
        usingLocalFallback: Boolean(snapshot?.usingLocalFallback),
        lead: snapshot?.lead && typeof snapshot.lead === "object" ? snapshot.lead : {},
        leadActive: Boolean(snapshot?.leadActive),
        currentField: snapshot?.currentField || null,
        submittedAt: snapshot?.submittedAt || null,
        chatHistory: Array.isArray(snapshot?.chatHistory)
            ? snapshot.chatHistory.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
            : [],
        messageLog: normalizeStoredMessageLog(snapshot?.messageLog),
        initializedChat: Boolean(snapshot?.initializedChat || (snapshot?.messageLog || []).length)
    };
}

function buildWidgetSnapshot() {
    return {
        sessionId: state.sessionId,
        usingLocalFallback: state.usingLocalFallback,
        lead: JSON.parse(JSON.stringify(state.lead || {})),
        leadActive: state.leadActive,
        currentField: state.currentField,
        submittedAt: state.submittedAt,
        chatHistory: state.chatHistory.slice(-30).map((item) => ({ role: item.role, content: item.content })),
        messageLog: JSON.parse(JSON.stringify(state.messageLog.slice(-40))),
        initializedChat: state.initializedChat
    };
}

function hasSnapshotContent(snapshot) {
    return Boolean(
        (snapshot?.messageLog || []).length ||
        (snapshot?.chatHistory || []).length ||
        snapshot?.initializedChat ||
        Object.values(snapshot?.lead || {}).some((value) => String(value || "").trim())
    );
}

function buildArchiveTitle(snapshot) {
    const userMessage = snapshot?.messageLog?.find((entry) => entry.kind === "text" && entry.author === "user")?.text
        || snapshot?.chatHistory?.find((entry) => entry.role === "user")?.content
        || "Алдыңғы чат";
    const normalized = userMessage.replace(/\s+/g, " ").trim();
    return normalized.length > 48 ? `${normalized.slice(0, 45)}...` : normalized;
}

function buildArchivePreview(snapshot) {
    const latestMessage = [...(snapshot?.messageLog || [])]
        .reverse()
        .find((entry) => entry.kind === "text")?.text || buildArchiveTitle(snapshot);
    const normalized = latestMessage.replace(/\s+/g, " ").trim();
    return normalized.length > 70 ? `${normalized.slice(0, 67)}...` : normalized;
}

function buildArchiveRecord(snapshot) {
    return {
        id: `chat-${crypto.randomUUID()}`,
        title: buildArchiveTitle(snapshot),
        preview: buildArchivePreview(snapshot),
        updatedAt: new Date().toISOString(),
        snapshot: normalizeSnapshot(snapshot)
    };
}

function loadArchivedChats(storage = getWidgetStorage()) {
    if (!storage) {
        state.archivedChats = [];
        return;
    }

    const raw = storage.getItem(CHAT_ARCHIVE_KEY);
    if (!raw) {
        state.archivedChats = [];
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        state.archivedChats = Array.isArray(parsed)
            ? parsed
                .filter((item) => item && typeof item === "object" && item.snapshot)
                .map((item) => ({
                    id: typeof item.id === "string" && item.id ? item.id : `chat-${crypto.randomUUID()}`,
                    title: typeof item.title === "string" && item.title ? item.title : buildArchiveTitle(item.snapshot),
                    preview: typeof item.preview === "string" && item.preview ? item.preview : buildArchivePreview(item.snapshot),
                    updatedAt: typeof item.updatedAt === "string" && item.updatedAt ? item.updatedAt : new Date().toISOString(),
                    snapshot: normalizeSnapshot(item.snapshot)
                }))
            : [];
    } catch (error) {
        state.archivedChats = [];
        storage.removeItem(CHAT_ARCHIVE_KEY);
    }
}

function persistArchivedChats() {
    const storage = getWidgetStorage();
    if (!storage) {
        return;
    }

    storage.setItem(CHAT_ARCHIVE_KEY, JSON.stringify(state.archivedChats.slice(0, 12)));
    renderChatHistoryList();
}

function archiveCurrentChat() {
    const snapshot = buildWidgetSnapshot();
    if (!hasSnapshotContent(snapshot)) {
        return;
    }

    state.archivedChats = [buildArchiveRecord(snapshot), ...state.archivedChats].slice(0, 12);
    persistArchivedChats();
}

function formatArchiveDate(value) {
    try {
        return new Intl.DateTimeFormat("kk-KZ", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(value));
    } catch (error) {
        return "Жақында";
    }
}

function renderChatHistoryList() {
    if (!elements.chatHistoryList) {
        return;
    }

    elements.chatHistoryList.innerHTML = "";

    if (!state.archivedChats.length) {
        const empty = document.createElement("div");
        empty.className = "chat-history-panel__empty";
        empty.textContent = "Әзірге бұрынғы чаттар жоқ.";
        elements.chatHistoryList.appendChild(empty);
        return;
    }

    state.archivedChats.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-history-item";
        button.dataset.chatId = item.id;
        button.innerHTML = `
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.preview)}</span>
            <time>${escapeHtml(formatArchiveDate(item.updatedAt))}</time>
        `;
        button.addEventListener("click", () => {
            openArchivedChat(item.id);
        });
        elements.chatHistoryList.appendChild(button);
    });
}

function applyWidgetSnapshot(snapshot) {
    const normalized = normalizeSnapshot(snapshot);
    state.sessionId = normalized.sessionId;
    state.usingLocalFallback = normalized.usingLocalFallback;
    state.lead = normalized.lead;
    state.leadActive = normalized.leadActive;
    state.currentField = normalized.currentField;
    state.submittedAt = normalized.submittedAt;
    state.chatHistory = normalized.chatHistory;
    state.messageLog = normalized.messageLog;
    state.initializedChat = normalized.initializedChat;
    hideTypingIndicator();
    clearWidgetMessages();
    renderMessageLog();
    syncLeadProgress();
    if (elements.widgetInput) {
        elements.widgetInput.value = "";
        elements.widgetInput.style.height = "auto";
    }
}

async function startNewChat() {
    archiveCurrentChat();
    state.lead = {};
    state.leadActive = false;
    state.currentField = null;
    state.submittedAt = null;
    state.chatHistory = [];
    state.messageLog = [];
    state.initializedChat = false;
    state.sessionId = null;
    state.sessionPromise = null;
    state.usingLocalFallback = false;
    clearWidgetMessages();
    hideTypingIndicator();
    hideChatHistoryPanel();
    syncLeadProgress();
    if (elements.widgetInput) {
        elements.widgetInput.value = "";
        elements.widgetInput.style.height = "auto";
    }

    await ensureSession();

    if (state.widgetOpen) {
        buildGreetingMessages().forEach((line) => addAssistantMessage(line));
        state.initializedChat = true;
    }

    persistWidgetState();
    window.setTimeout(() => elements.widgetInput?.focus(), 80);
}

function openArchivedChat(id) {
    const record = state.archivedChats.find((item) => item.id === id);
    if (!record) {
        return;
    }

    const currentSnapshot = buildWidgetSnapshot();
    state.archivedChats = state.archivedChats.filter((item) => item.id !== id);
    if (hasSnapshotContent(currentSnapshot)) {
        state.archivedChats.unshift(buildArchiveRecord(currentSnapshot));
    }
    state.archivedChats = state.archivedChats.slice(0, 12);
    applyWidgetSnapshot(record.snapshot);
    hideChatHistoryPanel();
    persistArchivedChats();
    persistWidgetState();
    window.setTimeout(() => elements.widgetInput?.focus(), 80);
}


async function ensureSession() {
    if (state.sessionPromise) {
        return state.sessionPromise;
    }

    if (state.sessionId) {
        return state.sessionId;
    }

    state.sessionPromise = bootstrapSession()
        .catch((error) => {
            console.error("Session bootstrap failed", error);
            bootstrapLocalSession();
        })
        .finally(() => {
            state.sessionPromise = null;
        });

    return state.sessionPromise;
}

async function bootstrapSession() {
    if (!runtime.apiBase) {
        bootstrapLocalSession();
        return;
    }

    const payload = await fetchJson(`${runtime.apiBase}${SESSION_ENDPOINT}`, {
        method: "POST",
        body: JSON.stringify({
            origin: window.location.origin,
            page: window.location.href,
            brand: runtime.publicBrand
        })
    });

    state.sessionId = payload.sessionId || `session-${crypto.randomUUID()}`;
    state.usingLocalFallback = false;
    persistWidgetState();
}

function bootstrapLocalSession() {
    if (!state.sessionId) {
        state.sessionId = `offline-${crypto.randomUUID()}`;
    }

    state.usingLocalFallback = true;
    persistWidgetState();
}

function buildGreetingMessages() {
    return [
        `Сәлем! ${runtime.publicBrand} кастингі туралы сұрақтарыңызға жауап беремін. Хабарлама жазыңыз!`
    ];
}

function getWidgetStorage() {
    try {
        return window.localStorage;
    } catch (error) {
        return null;
    }
}

function persistWidgetState() {
    const storage = getWidgetStorage();
    if (!storage) {
        return;
    }

    const snapshot = buildWidgetSnapshot();
    storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(snapshot));
    persistArchivedChats();
}

function restoreWidgetState() {
    const storage = getWidgetStorage();
    if (!storage) {
        return;
    }

    loadArchivedChats(storage);

    const raw = storage.getItem(CHAT_STORAGE_KEY);
    if (!raw) {
        renderChatHistoryList();
        return;
    }

    try {
        const snapshot = JSON.parse(raw);
        applyWidgetSnapshot(snapshot);
    } catch (error) {
        storage.removeItem(CHAT_STORAGE_KEY);
    }

    renderChatHistoryList();
}

function normalizeStoredMessageLog(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }

    return entries
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }

            if (entry.kind === "summary" && entry.summary?.lead) {
                return {
                    kind: "summary",
                    summary: entry.summary,
                    delivery: entry.delivery || null
                };
            }

            if (entry.kind === "text" && (entry.author === "assistant" || entry.author === "user") && typeof entry.text === "string") {
                return {
                    kind: "text",
                    author: entry.author,
                    text: entry.text
                };
            }

            return null;
        })
        .filter(Boolean);
}

function clearWidgetMessages() {
    if (elements.widgetMessages) {
        elements.widgetMessages.innerHTML = "";
    }
}

function renderMessageLog() {
    clearWidgetMessages();
    state.messageLog.forEach((entry) => appendStoredMessage(entry));
}

function appendStoredMessage(entry) {
    if (entry.kind === "summary") {
        renderLeadSummary(entry.summary, entry.delivery, { persist: false, store: false });
        return;
    }

    if (entry.kind === "text") {
        renderMessageEntry(entry.author, entry.text);
    }
}

function removeStoredSummary(options = {}) {
    const { persist = true, clearLog = true } = options;
    elements.widgetMessages?.querySelector(".summary-card[data-summary='latest']")?.closest(".message")?.remove();

    if (clearLog) {
        state.messageLog = state.messageLog.filter((entry) => entry.kind !== "summary");
    }

    if (persist) {
        persistWidgetState();
    }
}


function autoResizeTextarea(event) {
    const textarea = event.currentTarget;
    if (!textarea) {
        return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
}

async function sendWidgetMessage() {
    const value = elements.widgetInput?.value.trim();
    if (!value || state.pending) {
        return;
    }

    addUserMessage(value);
    state.chatHistory.push({ role: "user", content: value });
    elements.widgetInput.value = "";
    elements.widgetInput.style.height = "auto";
    persistWidgetState();

    await ensureSession();
    setPending(true);
    showTypingIndicator();

    try {
        const payload = state.usingLocalFallback
            ? runLocalFallbackChat(value)
            : await fetchJson(`${runtime.apiBase}${CHAT_ENDPOINT}`, {
                method: "POST",
                body: JSON.stringify({
                    sessionId: state.sessionId,
                    message: value,
                    history: state.chatHistory.slice(-20),
                    clientState: exportClientState()
                })
            });

        hideTypingIndicator();
        if (typeof payload.reply === "string" && payload.reply.trim()) {
            state.chatHistory.push({ role: "assistant", content: payload.reply.trim() });
        }
        applyAssistantPayload(payload);
    } catch (error) {
        console.error("Chat request failed", error);
        hideTypingIndicator();

        if (!state.usingLocalFallback) {
            addAssistantMessage("AI чат уақытша баяулап тұр. Қосалқы режимге ауысып, әңгімені жалғастырамын.");
            bootstrapLocalSession();
            const fallbackPayload = runLocalFallbackChat(value);
            if (typeof fallbackPayload.reply === "string" && fallbackPayload.reply.trim()) {
                state.chatHistory.push({ role: "assistant", content: fallbackPayload.reply.trim() });
            }
            applyAssistantPayload(fallbackPayload);
        } else {
            addAssistantMessage("Хабарламаны өңдеу мүмкін болмады. Қайталап көріңіз.");
        }
    } finally {
        hideTypingIndicator();
        setPending(false);
        persistWidgetState();
        elements.widgetInput?.focus();
    }
}


function exportClientState() {
    return {
        lead: state.lead,
        leadActive: state.leadActive,
        currentField: state.currentField,
        submittedAt: state.submittedAt
    };
}

function applyAssistantPayload(payload) {
    if (!payload) {
        return;
    }

    if (typeof payload.reply === "string" && payload.reply.trim()) {
        addAssistantMessage(payload.reply.trim());
    }

    state.lead = payload.lead ? { ...state.lead, ...payload.lead } : state.lead;
    state.leadActive = Boolean(payload.leadActive);
    state.currentField = payload.currentField || null;

    if (payload.submitted && !payload.submittedAt) {
        state.submittedAt = new Date().toISOString();
    } else if (payload.submittedAt) {
        state.submittedAt = payload.submittedAt;
    }

    syncLeadProgress();

    if (payload.summary) {
        renderLeadSummary(payload.summary, payload.delivery);
        return;
    }

    persistWidgetState();
}


function runLocalFallbackChat(message) {
    const normalized = normalize(message);

    if (state.submittedAt) {
        return {
            reply: "Өтінім дайын. Қажет болса, жаңа анкета бастап, тағы бір баланы қоса аламыз.",
            lead: state.lead,
            leadActive: false,
            currentField: null,
            submitted: false,
            submittedAt: state.submittedAt,
            summary: buildSummaryPayload(state.lead),
            delivery: {
                channel: "supabase",
                ok: false,
                error: "api.apolloai.biz is not connected yet"
            }
        };
    }

    if (state.leadActive || shouldStartLead(normalized)) {
        return advanceLocalLeadFlow(message);
    }

    if (normalized.includes("жас") || normalized.includes("возраст")) {
        return {
            reply: FALLBACK_FAQ.age,
            lead: state.lead,
            leadActive: false,
            currentField: null,
            submitted: false
        };
    }

    if (normalized.includes("қалай") || normalized.includes("жазылу") || normalized.includes("процесс")) {
        return {
            reply: FALLBACK_FAQ.process,
            lead: state.lead,
            leadActive: false,
            currentField: null,
            submitted: false
        };
    }

    return {
        reply: FALLBACK_FAQ.generic,
        lead: state.lead,
        leadActive: false,
        currentField: null,
        submitted: false
    };
}

function advanceLocalLeadFlow(message) {
    const lead = { ...state.lead };

    if (!state.leadActive) {
        const firstField = getNextMissingField(lead);
        state.leadActive = true;
        state.currentField = firstField;

        return {
            reply: `Жақсы, бастайық. Бірнеше қысқа сұрақ қоямын және өтінімді дайындаймын. ${getFieldDefinition(firstField).question}`,
            lead,
            leadActive: true,
            currentField: firstField,
            submitted: false
        };
    }

    const field = getFieldDefinition(state.currentField);
    const normalizedValue = typeof field.normalize === "function" ? field.normalize(message) : message.trim();

    if (!field.validate(normalizedValue)) {
        return {
            reply: field.error,
            lead,
            leadActive: true,
            currentField: field.key,
            submitted: false
        };
    }

    lead[field.key] = normalizedValue;
    const nextField = getNextMissingField(lead);

    if (nextField) {
        return {
            reply: `Қабылданды. ${getFieldDefinition(nextField).question}`,
            lead,
            leadActive: true,
            currentField: nextField,
            submitted: false
        };
    }

    const submittedAt = new Date().toISOString();
    state.submittedAt = submittedAt;

    return {
        reply: "Дайын! Өтінім жиналды. Ол кастинг жүйесіне автоматты түрде сақталады.",
        lead,
        leadActive: false,
        currentField: null,
        submitted: false,
        submittedAt,
        summary: buildSummaryPayload(lead),
        delivery: {
            channel: "supabase",
            ok: false,
            error: "local fallback"
        }
    };
}

function shouldStartLead(normalizedMessage) {
    return ["кастинг", "жазыл", "тіркел", "анкет", "запис"].some((needle) => normalizedMessage.includes(needle));
}

function getNextMissingField(lead) {
    return FIELD_DEFINITIONS.find((field) => !lead[field.key])?.key || null;
}

function getFieldDefinition(key) {
    return FIELD_DEFINITIONS.find((field) => field.key === key) || FIELD_DEFINITIONS[0];
}

function buildSummaryPayload(lead) {
    return {
        lead: {
            childName: lead.childName || "—",
            childAge: lead.childAge || "—",
            city: lead.city || "—",
            parentName: lead.parentName || "—",
            phone: lead.phone || "—",
            experience: lead.experience || "—",
            note: lead.note || "—"
        }
    };
}

function renderLeadSummary(summary, delivery, options = {}) {
    const { persist = true, store = true } = options;
    removeStoredSummary({ persist: false, clearLog: store });

    const message = document.createElement("div");
    message.className = "message message--assistant";

    const card = document.createElement("div");
    card.className = "summary-card";
    card.dataset.summary = "latest";

    const title = document.createElement("h4");
    title.textContent = delivery?.ok ? "Өтінім менеджерге жіберілді" : "Кастингке өтінім";
    card.appendChild(title);

    const note = document.createElement("p");
    note.className = "summary-card__note";
    note.textContent = delivery?.ok
        ? "AI-көмекші анкетаны кастинг жүйесіне сақтады."
        : "Өтінім дайын. Қажет болса, қайта ашып жалғастыра береміз.";
    card.appendChild(note);

    const list = document.createElement("ul");
    [
        `Бала: ${summary.lead.childName}`,
        `Жасы: ${summary.lead.childAge}`,
        `Қала: ${summary.lead.city}`,
        `Ата-ана: ${summary.lead.parentName}`,
        `Байланыс: ${summary.lead.phone}`,
        `Тәжірибе: ${summary.lead.experience}`,
        `Ескерту: ${summary.lead.note}`
    ].forEach((lineText) => {
        const line = document.createElement("li");
        line.textContent = lineText;
        list.appendChild(line);
    });
    card.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "summary-card__actions";

    const whatsappLink = document.createElement("a");
    whatsappLink.className = "btn btn--accent";
    whatsappLink.href = buildWhatsAppLink(summary.lead);
    whatsappLink.target = "_blank";
    whatsappLink.rel = "noreferrer";
    whatsappLink.textContent = "WhatsApp арқылы байланысу";
    actions.appendChild(whatsappLink);

    const resetButton = document.createElement("button");
    resetButton.className = "btn btn--ghost";
    resetButton.type = "button";
    resetButton.textContent = "Жаңа өтінім";
    resetButton.addEventListener("click", resetLeadFlow);
    actions.appendChild(resetButton);

    card.appendChild(actions);
    message.appendChild(card);
    elements.widgetMessages?.appendChild(message);

    if (store) {
        state.messageLog.push({ kind: "summary", summary, delivery: delivery || null });
    }

    if (persist) {
        persistWidgetState();
    }

    scrollMessagesToBottom();
}


function buildWhatsAppLink(lead = state.lead) {
    const text = [
        "Сәлеметсіз бе! Meyram Cinema кастингіне өтінім жіберемін.",
        "",
        `1. Баланың аты: ${lead.childName || "—"}`,
        `2. Жасы: ${lead.childAge || "—"}`,
        `3. Қала: ${lead.city || "—"}`,
        `4. Ата-ана: ${lead.parentName || "—"}`,
        `5. Телефон / WhatsApp: ${lead.phone || "—"}`,
        `6. Тәжірибе: ${lead.experience || "—"}`,
        `7. Ескерту: ${lead.note || "—"}`
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function resetLeadFlow() {
    state.lead = {};
    state.leadActive = false;
    state.currentField = null;
    state.submittedAt = null;
    removeStoredSummary({ persist: false });
    syncLeadProgress();

    addUserMessage("Жаңа өтінім толтырғым келеді");
    state.chatHistory.push({ role: "user", content: "Жаңа өтінім толтырғым келеді" });

    const payload = state.usingLocalFallback
        ? runLocalFallbackChat("Кастингке жазылғым келеді")
        : {
            reply: "Жақсы, жаңа анкета бастаймыз. Баланың аты кім?",
            lead: {},
            leadActive: true,
            currentField: "childName",
            submitted: false
        };

    if (typeof payload.reply === "string" && payload.reply.trim()) {
        state.chatHistory.push({ role: "assistant", content: payload.reply.trim() });
    }

    applyAssistantPayload(payload);
    persistWidgetState();
}


function syncLeadProgress() {
    const activeStage = state.leadActive && state.currentField ? PROGRESS_MAP[state.currentField] ?? 0 : -1;

    elements.leadProgress.forEach((chip, index) => {
        const done = state.submittedAt ? true : activeStage > index;
        chip.classList.toggle("is-active", activeStage === index && !state.submittedAt);
        chip.classList.toggle("is-done", done || (state.submittedAt && index <= elements.leadProgress.length - 1));
    });
}

function addAssistantMessage(text, options = {}) {
    addMessage(text, "assistant", options);
}

function addUserMessage(text, options = {}) {
    addMessage(text, "user", options);
}

function addMessage(text, author, options = {}) {
    const { persist = true, store = true } = options;
    const normalizedText = String(text || "").trim();
    if (!normalizedText) {
        return;
    }

    renderMessageEntry(author, normalizedText);

    if (store) {
        state.messageLog.push({ kind: "text", author, text: normalizedText });
    }

    if (persist) {
        persistWidgetState();
    }
}

function renderMessageEntry(author, text) {
    const message = document.createElement("div");
    message.className = `message message--${author}`;
    message.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
    elements.widgetMessages?.appendChild(message);
    scrollMessagesToBottom();
}

function showTypingIndicator() {
    hideTypingIndicator();

    const message = document.createElement("div");
    message.className = "message message--assistant message--typing";
    message.innerHTML = '<span class="typing-dots" aria-label="Жазып жатыр"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>';
    elements.widgetMessages?.appendChild(message);
    scrollMessagesToBottom();
}

function hideTypingIndicator() {
    elements.widgetMessages?.querySelector(".message--typing")?.remove();
}


function scrollMessagesToBottom() {
    elements.widgetMessages?.scrollTo({
        top: elements.widgetMessages.scrollHeight,
        behavior: "smooth"
    });
}

function setPending(isPending) {
    state.pending = isPending;
    elements.widgetSend?.toggleAttribute("disabled", isPending);
    elements.widgetInput?.toggleAttribute("disabled", isPending);
}


function initVideoModal() {
    const open = () => {
        elements.videoModal?.classList.add("is-open");
        elements.videoModal?.setAttribute("aria-hidden", "false");
        if (elements.videoFrame) {
            elements.videoFrame.src = "https://www.youtube.com/embed/e4S3HhWGpfE?autoplay=1";
        }
    };

    const close = () => {
        elements.videoModal?.classList.remove("is-open");
        elements.videoModal?.setAttribute("aria-hidden", "true");
        if (elements.videoFrame) {
            elements.videoFrame.src = "";
        }
    };

    elements.openVideoModal?.addEventListener("click", open);
    elements.videoCard?.addEventListener("click", open);

    document.querySelectorAll("[data-video-close]").forEach((button) => {
        button.addEventListener("click", close);
    });
}

async function fetchJson(url, options = {}, expectJson = true) {
    const init = {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        }
    };

    if (options.body && expectJson && !(options.body instanceof FormData)) {
        init.headers["Content-Type"] = "application/json; charset=utf-8";
    }

    const response = await fetch(url, init);
    const text = await response.text();
    const data = text ? safeParseJson(text) : {};

    if (!response.ok || data?.ok === false) {
        const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
    }

    return data;
}

function safeParseJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error("The server returned invalid JSON.");
    }
}

function escapeHtml(text) {
    return String(text ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalize(text) {
    return String(text || "").toLowerCase().trim();
}

init();


