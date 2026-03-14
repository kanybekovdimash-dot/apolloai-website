const WHATSAPP_NUMBER = "77757350968";
const HERO_AUTOPLAY_MS = 5000;
const SESSION_ENDPOINT = "/session";
const CHAT_ENDPOINT = "/chat";
const LEAD_ENDPOINT = "/lead";
const TTS_ENDPOINT = "/tts";

const FIELD_DEFINITIONS = [
    {
        key: "childName",
        label: "Имя",
        question: "Как зовут ребёнка?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Нужно имя ребёнка хотя бы из 2 символов."
    },
    {
        key: "childAge",
        label: "Возраст",
        question: "Сколько лет ребёнку?",
        normalize: (value) => value.replace(/[^\d]/g, ""),
        validate: (value) => {
            const age = Number(value);
            return Number.isInteger(age) && age >= 4 && age <= 18;
        },
        error: "Введите возраст цифрами, например 9 или 13."
    },
    {
        key: "city",
        label: "Город",
        question: "Из какого вы города?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Напишите, пожалуйста, город."
    },
    {
        key: "parentName",
        label: "Родитель",
        question: "Как зовут родителя или законного представителя?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Нужно имя родителя или законного представителя."
    },
    {
        key: "phone",
        label: "Контакт",
        question: "Оставьте номер телефона или WhatsApp для связи.",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => /\d{10,}/.test(value.replace(/[^\d]/g, "")),
        error: "Введите телефон или WhatsApp в понятном формате, например +7 777 123 45 67."
    },
    {
        key: "experience",
        label: "Опыт",
        question: "Есть ли у ребёнка опыт: съёмки, сцена, курсы, TikTok или reels?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Напишите коротко: нет опыта, немного опыта или уже снимался."
    },
    {
        key: "note",
        label: "Комментарий",
        question: "Что важно учесть: мечтает сниматься, любит сцену, уже ходит на курсы или есть другой комментарий?",
        normalize: (value) => value.replace(/\s+/g, " ").trim(),
        validate: (value) => value.length >= 2,
        error: "Напишите хотя бы пару слов, чтобы менеджеру было проще сориентироваться."
    }
];

const PROGRESS_MAP = {
    childName: 0,
    childAge: 1,
    city: 2,
    parentName: 3,
    phone: 3,
    experience: 3,
    note: 3
};

const FALLBACK_FAQ = {
    age: "Кастингке негізінен 6-15 жас аралығындағы балалар қатыса алады. Если ребёнок чуть младше или старше, всё равно можно оставить заявку, а менеджер уточнит детали.",
    process: "Запись проходит просто: AI-ассистент собирает короткую анкету, а затем отправляет заявку менеджеру в Telegram.",
    generic: "Я могу сразу помочь записаться на кастинг или подсказать по возрасту, формату и следующему шагу."
};

const runtime = {
    publicBrand: readMetaContent("apollo-public-brand") || "Meyram Cinema",
    assistantBrand: readMetaContent("apollo-assistant-brand") || "Meyram AI",
    apiBase: resolveApiBase(),
    avatarProvider: readMetaContent("apollo-avatar-provider") || "PersonaLive",
    avatarDemoUrl: readMetaContent("apollo-avatar-demo-url")
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
    avatar: null,
    microphonePermission: "idle",
    microphoneError: "",
    speechRequestId: 0,
    speechObjectUrl: ""
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
    avatarStatusText: document.getElementById("avatarStatusText"),
    quickActions: document.getElementById("quickActions"),
    leadProgress: Array.from(document.querySelectorAll("#leadProgress span")),
    avatarFab: document.getElementById("avatarFab"),
    closeWidget: document.getElementById("closeWidget"),
    openVideoModal: document.getElementById("openVideoModal"),
    videoCard: document.getElementById("videoCard"),
    videoModal: document.getElementById("videoModal"),
    videoFrame: document.getElementById("videoFrame"),
    avatarVideo: document.getElementById("avatarVideo"),
    avatarAudio: document.getElementById("avatarAudio"),
    avatarDemoPanel: document.getElementById("avatarDemoPanel"),
    avatarDemoFrame: document.getElementById("avatarDemoFrame"),
    avatarDemoLink: document.getElementById("avatarDemoLink")
};

function init() {
    initHeroSlider();
    initWidget();
    initVideoModal();
    syncLeadProgress();
    syncAvatarDemo();
    syncAvatarStatus();
    openWidget();
    window.setTimeout(() => {
        requestMicrophoneAccess();
    }, 180);
}

async function requestMicrophoneAccess(force = false) {
    if (!navigator.mediaDevices?.getUserMedia) {
        state.microphonePermission = "unsupported";
        state.microphoneError = "browser";
        syncAvatarStatus();
        return;
    }

    if (!window.isSecureContext) {
        state.microphonePermission = "blocked";
        state.microphoneError = "secure-context";
        syncAvatarStatus();
        return;
    }

    if (!force && ["granted", "pending"].includes(state.microphonePermission)) {
        return;
    }

    state.microphonePermission = "pending";
    state.microphoneError = "";
    syncAvatarStatus();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        stream.getTracks().forEach((track) => track.stop());
        state.microphonePermission = "granted";
        syncAvatarStatus();
    } catch (error) {
        state.microphonePermission = "denied";
        state.microphoneError = error?.name || "unknown";
        syncAvatarStatus();
    }
}
function readMetaContent(name) {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
}

function resolveApiBase() {
    const storedOverride = window.localStorage.getItem("apollo-api-base");
    if (storedOverride) {
        return storedOverride.replace(/\/$/, "");
    }

    if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
        return "http://127.0.0.1:8787";
    }

    return (readMetaContent("apollo-api-base") || "").replace(/\/$/, "");
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
    document.querySelectorAll("[data-avatar-open]").forEach((button) => {
        button.addEventListener("click", openWidget);
    });

    elements.avatarFab?.addEventListener("click", openWidget);
    elements.closeWidget?.addEventListener("click", closeWidget);
    elements.widgetSend?.addEventListener("click", sendWidgetMessage);

    elements.widgetInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendWidgetMessage();
        }
    });

    elements.widgetInput?.addEventListener("input", autoResizeTextarea);

    elements.quickActions?.addEventListener("click", (event) => {
        const target = event.target.closest("[data-quick-action]");
        if (!target) {
            return;
        }

        const actionMap = {
            "start-lead": "Хочу записаться на кастинг",
            "faq-age": "Подскажите по возрасту",
            "faq-process": "Как проходит запись?"
        };

        const message = actionMap[target.dataset.quickAction];
        if (!message) {
            return;
        }

        elements.widgetInput.value = message;
        autoResizeTextarea({ currentTarget: elements.widgetInput });
        sendWidgetMessage();
    });

    elements.widget?.addEventListener("click", () => {
        if (state.microphonePermission !== "granted") {
            requestMicrophoneAccess(true);
        }
    });
}

async function openWidget() {
    state.widgetOpen = true;
    elements.widget?.classList.add("is-open");
    elements.widget?.setAttribute("aria-hidden", "false");
    syncAvatarStatus();

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
    elements.widget?.classList.remove("is-open");
    elements.widget?.setAttribute("aria-hidden", "true");
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
    state.avatar = payload.avatar || null;
    syncAvatarMedia(payload.avatar);
    syncAvatarStatus();
}

function bootstrapLocalSession() {
    if (!state.sessionId) {
        state.sessionId = `demo-${crypto.randomUUID()}`;
    }

    state.usingLocalFallback = true;
    syncAvatarStatus();
}

function buildGreetingMessages() {
    if (state.usingLocalFallback) {
        return [
            `Сәлем! Я AI-ассистент ${runtime.publicBrand}. Пока работаю в demo-режиме, но уже могу собрать заявку на кастинг.`,
            "Нажмите «Хочу на кастинг» или напишите сообщение. Когда backend на api.apolloai.biz будет подключён, заявки начнут автоматически улетать менеджеру в Telegram."
        ];
    }

    return [
        `Сәлем! Я AI-ассистент ${runtime.publicBrand}. Помогу быстро записать ребёнка на кастинг и отвечу на основные вопросы.`,
        `Напишите сообщение, и я проведу вас по анкете. Дальше заявка автоматически уйдёт менеджеру в Telegram, а живой аватар подключается через ${runtime.avatarProvider}.`
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
                    clientState: exportClientState()
                })
            });

        applyAssistantPayload(payload);
    } catch (error) {
        console.error("Chat request failed", error);

        if (!state.usingLocalFallback) {
            addAssistantMessage("AI backend временно недоступен. Переключаюсь на резервный сценарий записи.");
            bootstrapLocalSession();
            applyAssistantPayload(runLocalFallbackChat(value));
        } else {
            addAssistantMessage("Не получилось обработать сообщение. Попробуйте ещё раз.");
        }
    } finally {
        setPending(false);
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
    state.submittedAt = payload.submittedAt || (payload.submitted ? new Date().toISOString() : null);

    state.avatar = payload.avatar || state.avatar;
    syncAssistantMedia(payload);
    syncLeadProgress();
    syncAvatarStatus(payload.delivery);

    if (payload.summary) {
        renderLeadSummary(payload.summary, payload.delivery);
    }
}

function runLocalFallbackChat(message) {
    const normalized = normalize(message);

    if (state.submittedAt) {
        return {
            reply: "Заявка уже собрана. В demo-режиме автоматическая Telegram-отправка недоступна, но WhatsApp-кнопки на сайте продолжают работать.",
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

    if (normalized.includes("возраст") || normalized.includes("жас")) {
        return {
            reply: FALLBACK_FAQ.age,
            lead: state.lead,
            leadActive: false,
            currentField: null,
            submitted: false
        };
    }

    if (normalized.includes("как") || normalized.includes("проходит") || normalized.includes("процесс")) {
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
            reply: `Отлично, начнём. Я задам несколько коротких вопросов и подготовлю заявку. ${getFieldDefinition(firstField).question}`,
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
            reply: `Принято. ${getFieldDefinition(nextField).question}`,
            lead,
            leadActive: true,
            currentField: nextField,
            submitted: false
        };
    }

    const submittedAt = new Date().toISOString();
    state.submittedAt = submittedAt;

    return {
        reply: "Готово. Заявка собрана. Как только api.apolloai.biz будет подключён, такие заявки будут автоматически уходить менеджеру в Telegram.",
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
    return ["кастинг", "запис", "тіркел", "анкет", "хочу на кастинг"].some((needle) => normalizedMessage.includes(needle));
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
    title.textContent = delivery?.ok ? "Заявка отправлена менеджеру" : "Заявка на кастинг";
    card.appendChild(title);

    const note = document.createElement("p");
    note.className = "summary-card__note";
    note.textContent = delivery?.ok
        ? "AI-ассистент уже отправил анкету в Telegram менеджеру."
        : "Автоматическая Telegram-отправка включится после подключения api.apolloai.biz."
        ;
    card.appendChild(note);

    const list = document.createElement("ul");
    [
        `Ребёнок: ${summary.lead.childName}`,
        `Возраст: ${summary.lead.childAge}`,
        `Город: ${summary.lead.city}`,
        `Родитель: ${summary.lead.parentName}`,
        `Контакт: ${summary.lead.phone}`,
        `Опыт: ${summary.lead.experience}`,
        `Комментарий: ${summary.lead.note}`
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
    whatsappLink.textContent = "Связаться в WhatsApp";
    actions.appendChild(whatsappLink);

    const resetButton = document.createElement("button");
    resetButton.className = "btn btn--ghost";
    resetButton.type = "button";
    resetButton.textContent = "Новая заявка";
    resetButton.addEventListener("click", resetLeadFlow);
    actions.appendChild(resetButton);

    card.appendChild(actions);
    message.appendChild(card);
    elements.widgetMessages?.appendChild(message);
    scrollMessagesToBottom();
}

function buildWhatsAppLink(lead = state.lead) {
    const text = [
        "Здравствуйте! Отправляю заявку на кастинг Meyram Cinema.",
        "",
        `1. Имя ребёнка: ${lead.childName || "—"}`,
        `2. Возраст: ${lead.childAge || "—"}`,
        `3. Город: ${lead.city || "—"}`,
        `4. Родитель: ${lead.parentName || "—"}`,
        `5. Телефон / WhatsApp: ${lead.phone || "—"}`,
        `6. Опыт: ${lead.experience || "—"}`,
        `7. Комментарий: ${lead.note || "—"}`
    ].join("\n");

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function resetLeadFlow() {
    state.lead = {};
    state.leadActive = false;
    state.currentField = null;
    state.submittedAt = null;
    syncLeadProgress();
    syncAvatarStatus();
    addUserMessage("Хочу заполнить новую заявку");
    applyAssistantPayload(state.usingLocalFallback
        ? runLocalFallbackChat("Хочу записаться на кастинг")
        : {
            reply: "Готово. Начинаем новую анкету. Как зовут ребёнка?",
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

function syncAvatarStatus(delivery) {
    if (!elements.avatarStatusText) {
        return;
    }

    if (state.microphonePermission === "pending") {
        elements.avatarStatusText.textContent = "Проверяю микрофон и готовлю голосовой режим...";
        return;
    }

    if (state.microphonePermission === "denied") {
        elements.avatarStatusText.textContent = "Нажмите на аватар и дайте доступ к микрофону.";
        return;
    }

    if (state.microphonePermission === "blocked") {
        elements.avatarStatusText.textContent = "Для микрофона откройте сайт по HTTPS.";
        return;
    }

    if (state.microphonePermission === "unsupported") {
        elements.avatarStatusText.textContent = "Браузер не поддерживает голосовой доступ к микрофону.";
        return;
    }

    if (delivery?.ok) {
        elements.avatarStatusText.textContent = "Заявка отправлена. Жду следующего клиента.";
        return;
    }

    if (state.pending) {
        elements.avatarStatusText.textContent = "Слушаю и готовлю ответ...";
        return;
    }

    if (state.leadActive) {
        elements.avatarStatusText.textContent = "Записываю клиента на кастинг.";
        return;
    }

    elements.avatarStatusText.textContent = "Онлайн. Жду клиента. Микрофон готов к разговору.";
}

function syncAssistantMedia(payload) {
    if (!payload) {
        return;
    }

    if (payload.avatar) {
        syncAvatarMedia(payload.avatar);
    }

    const speech = payload.speech || payload.audio;
    if (speech) {
        syncSpeechMedia(speech);
        if (speech.audioUrl || speech.streamUrl) {
            return;
        }
    }

    if (typeof payload.reply === "string" && payload.reply.trim()) {
        requestGeneratedSpeech(payload.reply.trim(), speech || {});
    }
}

function resolveAvatarDemoUrl(avatar = state.avatar) {
    return avatar?.demoUrl || avatar?.embedUrl || avatar?.frameUrl || runtime.avatarDemoUrl || "";
}

function syncAvatarDemo(avatar = state.avatar) {
    if (!elements.avatarDemoPanel || !elements.avatarDemoFrame || !elements.avatarDemoLink) {
        return;
    }

    const demoUrl = resolveAvatarDemoUrl(avatar);
    if (!demoUrl) {
        elements.avatarDemoPanel.hidden = true;
        elements.avatarDemoLink.href = "#";
        if (elements.avatarDemoFrame.dataset.mediaUrl) {
            elements.avatarDemoFrame.dataset.mediaUrl = "";
            elements.avatarDemoFrame.src = "";
        }
        return;
    }

    elements.avatarDemoPanel.hidden = false;
    elements.avatarDemoLink.href = demoUrl;
    if (elements.avatarDemoFrame.dataset.mediaUrl !== demoUrl) {
        elements.avatarDemoFrame.dataset.mediaUrl = demoUrl;
        elements.avatarDemoFrame.src = demoUrl;
    }
}

function syncAvatarMedia(avatar) {
    syncAvatarDemo(avatar);

    if (!avatar) {
        return;
    }

    if (elements.avatarVideo && avatar.posterUrl) {
        elements.avatarVideo.poster = avatar.posterUrl;
    }

    const videoUrl = avatar.videoUrl || avatar.previewUrl || avatar.streamUrl || "";
    if (elements.avatarVideo && videoUrl && elements.avatarVideo.dataset.mediaUrl !== videoUrl) {
        elements.avatarVideo.dataset.mediaUrl = videoUrl;
        elements.avatarVideo.src = videoUrl;
        elements.avatarVideo.play().catch(() => undefined);
    }
}

function syncSpeechMedia(speech) {
    const audioUrl = speech?.audioUrl || speech?.streamUrl || "";
    if (!elements.avatarAudio || !audioUrl) {
        return;
    }

    if (elements.avatarAudio.dataset.mediaUrl === audioUrl) {
        return;
    }

    releaseSpeechObjectUrl(audioUrl);
    elements.avatarAudio.dataset.mediaUrl = audioUrl;
    elements.avatarAudio.src = audioUrl;
    elements.avatarAudio.play().catch(() => undefined);
}

async function requestGeneratedSpeech(text, speech = {}) {
    if (!text || state.usingLocalFallback || !runtime.apiBase || speech.enabled === false) {
        return;
    }

    const provider = (speech.provider || "yandex").toLowerCase();
    if (!["azure", "yandex"].includes(provider)) {
        return;
    }

    const requestId = ++state.speechRequestId;

    try {
        const response = await fetch(`${runtime.apiBase}${speech.endpoint || TTS_ENDPOINT}`, {
            method: "POST",
            headers: {
                Accept: "audio/mpeg, audio/*, application/json",
                "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify({
                text,
                provider,
                voice: speech.voice,
                format: speech.format
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `TTS request failed with status ${response.status}`);
        }

        const blob = await response.blob();
        if (!blob.size || requestId != state.speechRequestId) {
            return;
        }

        playSpeechBlob(blob);
    } catch (error) {
        console.error("TTS request failed", error);
    }
}

function playSpeechBlob(blob) {
    if (!elements.avatarAudio) {
        return;
    }

    releaseSpeechObjectUrl();
    const objectUrl = URL.createObjectURL(blob);
    state.speechObjectUrl = objectUrl;
    elements.avatarAudio.dataset.mediaUrl = objectUrl;
    elements.avatarAudio.src = objectUrl;
    elements.avatarAudio.play().catch(() => undefined);
}

function releaseSpeechObjectUrl(nextUrl = "") {
    if (state.speechObjectUrl && state.speechObjectUrl != nextUrl) {
        URL.revokeObjectURL(state.speechObjectUrl);
        state.speechObjectUrl = "";
    }
}

function setPending(isPending) {
    state.pending = isPending;
    elements.widgetSend?.toggleAttribute("disabled", isPending);
    elements.widgetInput?.toggleAttribute("disabled", isPending);
    syncAvatarStatus();
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

