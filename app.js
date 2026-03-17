const WHATSAPP_NUMBER = "+77758828516";
const HERO_AUTOPLAY_MS = 5000;
const SESSION_ENDPOINT = "/session";
const CHAT_ENDPOINT = "/chat";
const LEAD_ENDPOINT = "/lead";

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
    process: "Жазылу оңай: AI-көмекші қысқа анкета толтырады, содан кейін өтінімді менеджерге Telegram арқылы жібереді.",
    generic: "Мен кастингке жазылуға немесе жас, формат және келесі қадам туралы кеңес беруге көмектесе аламын."
};

const runtime = {
    publicBrand: readMetaContent("apollo-public-brand") || "Meyram Cinema",
    assistantBrand: readMetaContent("apollo-assistant-brand") || "Meyram AI",
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
    chatHistory: []
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
    openCastingTest: document.getElementById("openCastingTest"),
    openVideoRecord: document.getElementById("openVideoRecord"),
    openVideoModal: document.getElementById("openVideoModal"),
    videoCard: document.getElementById("videoCard"),
    videoModal: document.getElementById("videoModal"),
    videoFrame: document.getElementById("videoFrame")
};

function readMetaContent(name) {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
}

function resolveApiBase() {
    return (readMetaContent("apollo-api-base") || "").replace(/\/$/, "");
}

function init() {
    initHeroSlider();
    initWidget();
    initVideoModal();
    syncLeadProgress();
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

    if (!state.initializedChat) {
        const greeting = buildGreetingMessages();
        greeting.forEach((line) => addAssistantMessage(line));
        state.initializedChat = true;
    }

    window.setTimeout(() => elements.widgetInput?.focus(), 80);
}

function closeWidget() {
    state.widgetOpen = false;
    state.initializedChat = false;
    state.chatHistory = [];
    state.lead = {};
    state.leadActive = false;
    state.currentField = null;
    state.submittedAt = null;
    elements.widget?.classList.remove("is-open");
    elements.widget?.setAttribute("aria-hidden", "true");
    elements.chatFab?.classList.remove("is-hidden");
    if (elements.widgetMessages) {
        elements.widgetMessages.innerHTML = "";
    }
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
}

function bootstrapLocalSession() {
    if (!state.sessionId) {
        state.sessionId = `demo-${crypto.randomUUID()}`;
    }

    state.usingLocalFallback = true;
}

function buildGreetingMessages() {
    return [
        `Сәлем! Мен ${runtime.publicBrand} AI-көмекшісімін. Кастинг туралы сұрақтарыңызға жауап беремін. Хабарлама жазыңыз!`
    ];
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

    await ensureSession();
    setPending(true);

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

        if (typeof payload.reply === "string" && payload.reply.trim()) {
            state.chatHistory.push({ role: "assistant", content: payload.reply.trim() });
        }
        applyAssistantPayload(payload);
    } catch (error) {
        console.error("Chat request failed", error);

        if (!state.usingLocalFallback) {
            addAssistantMessage("AI backend уақытша қол жетімсіз. Қосалқы режимге ауысамын.");
            bootstrapLocalSession();
            applyAssistantPayload(runLocalFallbackChat(value));
        } else {
            addAssistantMessage("Хабарламаны өңдеу мүмкін болмады. Қайталап көріңіз.");
        }
    } finally {
        setPending(false);
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

    state.lead = payload.lead || state.lead;
    state.leadActive = Boolean(payload.leadActive);
    state.currentField = payload.currentField || null;
    if (payload.submitted) {
        state.submittedAt = new Date().toISOString();
    } else if (payload.submittedAt) {
        state.submittedAt = payload.submittedAt;
    }

    syncLeadProgress();

    if (payload.summary) {
        renderLeadSummary(payload.summary, payload.delivery);
    }
}

function runLocalFallbackChat(message) {
    const normalized = normalize(message);

    if (state.submittedAt) {
        return {
            reply: "Өтінім жиналды. Менеджерге Telegram арқылы жіберілді. Сайттағы WhatsApp батырмалары да жұмыс істейді.",
            lead: state.lead,
            leadActive: false,
            currentField: null,
            submitted: false,
            submittedAt: state.submittedAt,
            summary: buildSummaryPayload(state.lead),
            delivery: {
                channel: "telegram",
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
        reply: "Дайын! Өтінім жиналды. Менеджерге Telegram арқылы жіберіледі.",
        lead,
        leadActive: false,
        currentField: null,
        submitted: false,
        submittedAt,
        summary: buildSummaryPayload(lead),
        delivery: {
            channel: "telegram",
            ok: false,
            error: "demo mode"
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

function renderLeadSummary(summary, delivery) {
    const existing = elements.widgetMessages?.querySelector(".summary-card[data-summary='latest']");
    existing?.closest(".message")?.remove();

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
        ? "AI-көмекші анкетаны Telegram арқылы менеджерге жіберді."
        : "Менеджерге Telegram арқылы автоматты жіберіледі."
        ;
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
    syncLeadProgress();
    addUserMessage("Жаңа өтінім толтырғым келеді");
    applyAssistantPayload(state.usingLocalFallback
        ? runLocalFallbackChat("Кастингке жазылғым келеді")
        : {
            reply: "Дайын. Жаңа анкета бастаймыз. Баланың аты кім?",
            lead: {},
            leadActive: true,
            currentField: "childName",
            submitted: false
        });
}

function syncLeadProgress() {
    const activeStage = state.leadActive && state.currentField ? PROGRESS_MAP[state.currentField] ?? 0 : -1;

    elements.leadProgress.forEach((chip, index) => {
        const done = state.submittedAt ? true : activeStage > index;
        chip.classList.toggle("is-active", activeStage === index && !state.submittedAt);
        chip.classList.toggle("is-done", done || (state.submittedAt && index <= elements.leadProgress.length - 1));
    });
}

function addAssistantMessage(text) {
    addMessage(text, "assistant");
}

function addUserMessage(text) {
    addMessage(text, "user");
}

function addMessage(text, author) {
    const message = document.createElement("div");
    message.className = `message message--${author}`;
    message.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
    elements.widgetMessages?.appendChild(message);
    scrollMessagesToBottom();
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
