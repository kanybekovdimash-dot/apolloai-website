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

const STATIC_FAQ = {
  age: "Кастингке негізінен 6-15 жас аралығындағы балалар қатыса алады. Если ребёнок чуть младше или старше, всё равно можно оставить заявку, а менеджер уточнит детали.",
  process: "Запись проходит просто: AI-ассистент собирает короткую анкету, а затем отправляет заявку менеджеру в Telegram.",
  generic: "Я могу сразу помочь записаться на кастинг или подсказать по возрасту, формату и следующему шагу."
};

const DEFAULT_CHAT_PROVIDER = "gemini";
const DEFAULT_CHAT_MODEL = "gemini-3-flash-preview";
const DEFAULT_STT_PROVIDER = "groq";
const DEFAULT_STT_MODEL = "whisper-large-v3";
const DEFAULT_TTS_PROVIDER = "yandex";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json(
          {
            ok: true,
            service: "apolloai-meyram-api",
            providers: getProviderInfo(env)
          },
          200,
          corsHeaders
        );
      }

      if (request.method === "POST" && url.pathname === "/session") {
        return handleSession(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/chat") {
        return handleChat(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/lead") {
        return handleLead(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/transcribe") {
        return handleTranscribe(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/tts") {
        return handleTts(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/avatar-session") {
        return handleAvatarSession(request, env, corsHeaders);
      }

      return json({ ok: false, error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      return json({ ok: false, error: error.message || "Internal error" }, 500, corsHeaders);
    }
  }
};

async function handleSession(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const publicBrand = payload.brand || env.PUBLIC_BRAND || "Meyram Cinema";

  return json(
    {
      ok: true,
      sessionId: crypto.randomUUID(),
      publicBrand,
      assistantBrand: env.ASSISTANT_BRAND || "Meyram AI",
      providers: getProviderInfo(env),
      avatar: buildAvatarPayload(env),
      speech: buildSpeechPayload(env)
    },
    200,
    corsHeaders
  );
}

async function handleChat(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const sessionId = payload.sessionId || crypto.randomUUID();
  const message = String(payload.message || "").trim();

  if (!message) {
    return json({ ok: false, error: "Message is required" }, 400, corsHeaders);
  }

  const clientState = normalizeClientState(payload.clientState);
  const result = await orchestrateChat({ sessionId, message, clientState, env });

  return json(
    {
      ok: true,
      sessionId,
      ...result,
      avatar: buildAvatarPayload(env),
      speech: buildSpeechPayload(env)
    },
    200,
    corsHeaders
  );
}

async function handleLead(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const lead = sanitizeLead(payload.lead || {});
  const summary = buildSummaryPayload(lead);
  const delivery = await deliverLead({
    lead,
    sessionId: payload.sessionId || crypto.randomUUID(),
    env
  });

  return json(
    {
      ok: true,
      submitted: delivery.ok,
      submittedAt: new Date().toISOString(),
      summary,
      delivery
    },
    200,
    corsHeaders
  );
}

async function handleTranscribe(request, env, corsHeaders) {
  const provider = getSttProvider(env);
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    return json({ ok: false, error: "Audio file is required" }, 400, corsHeaders);
  }

  const language = String(formData.get("language") || "").trim();
  const text = await transcribeWithProvider({ audio, language, env, provider });
  return json({ ok: true, text }, 200, corsHeaders);
}

async function handleTts(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const text = String(payload.text || payload.reply || "").trim();

  if (!text) {
    return json({ ok: false, error: "Text is required" }, 400, corsHeaders);
  }

  const provider = String(payload.provider || getTtsProvider(env)).toLowerCase();
  const voice = String(
    payload.voice ||
      (provider === "yandex" ? env.YANDEX_TTS_VOICE || "amira" : env.AZURE_TTS_VOICE || "kk-KZ-AigulNeural")
  ).trim();
  const format = String(
    payload.format ||
      (provider === "yandex" ? env.YANDEX_TTS_FORMAT || "mp3" : env.AZURE_TTS_FORMAT || "audio-24khz-48kbitrate-mono-mp3")
  ).trim();
  const result = await synthesizeSpeech({ text, provider, voice, format, env });

  return new Response(result.audioBuffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": result.contentType || "audio/mpeg",
      "Cache-Control": "no-store",
      "X-TTS-Provider": result.provider,
      "X-TTS-Voice": result.voice
    }
  });
}

async function orchestrateChat({ sessionId, message, clientState, env }) {
  const normalized = normalize(message);
  const lead = sanitizeLead(clientState.lead);

  if (clientState.submittedAt && wantsFreshLead(normalized)) {
    clientState = normalizeClientState({ lead: {}, leadActive: false, currentField: null, submittedAt: null });
  }

  if (clientState.submittedAt) {
    return {
      reply: "Заявка уже отправлена менеджеру. Если хотите оставить новую, напишите «новая заявка».",
      lead,
      leadActive: false,
      currentField: null,
      submittedAt: clientState.submittedAt,
      summary: buildSummaryPayload(lead),
      delivery: { channel: "telegram", ok: true }
    };
  }

  if (clientState.leadActive || shouldStartLead(normalized)) {
    return handleLeadConversation({ sessionId, message, clientState, lead, env });
  }

  if (mentionsAge(normalized)) {
    return {
      reply: STATIC_FAQ.age,
      lead,
      leadActive: false,
      currentField: null,
      submitted: false
    };
  }

  if (mentionsProcess(normalized)) {
    return {
      reply: STATIC_FAQ.process,
      lead,
      leadActive: false,
      currentField: null,
      submitted: false
    };
  }

  const reply = await buildConversationalReply(message, env);
  return {
    reply,
    lead,
    leadActive: false,
    currentField: null,
    submitted: false
  };
}

async function handleLeadConversation({ sessionId, message, clientState, lead, env }) {
  if (!clientState.leadActive) {
    const firstField = getNextMissingField(lead) || FIELD_DEFINITIONS[0].key;
    return {
      reply: `Отлично, начнём. Я задам несколько коротких вопросов и подготовлю заявку. ${getFieldDefinition(firstField).question}`,
      lead,
      leadActive: true,
      currentField: firstField,
      submitted: false
    };
  }

  const currentField = clientState.currentField || getNextMissingField(lead) || FIELD_DEFINITIONS[0].key;
  const field = getFieldDefinition(currentField);
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
  const delivery = await deliverLead({ lead, sessionId, env });

  return {
    reply: delivery.ok
      ? "Готово. Я отправил заявку менеджеру в Telegram. В ближайшее время с вами свяжутся."
      : "Готово. Заявка собрана, но Telegram пока не подключён. Менеджер сможет забрать её после настройки бота.",
    lead,
    leadActive: false,
    currentField: null,
    submitted: delivery.ok,
    submittedAt,
    summary: buildSummaryPayload(lead),
    delivery
  };
}

async function deliverLead({ lead, sessionId, env }) {
  const summary = buildSummaryPayload(lead);
  return sendTelegramLead(summary.lead, sessionId, env);
}

async function sendTelegramLead(lead, sessionId, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return {
      channel: "telegram",
      ok: false,
      error: "Telegram bot is not configured"
    };
  }

  const text = [
    "<b>Новая заявка на кастинг</b>",
    `Бренд: <b>${escapeHtml(env.PUBLIC_BRAND || "Meyram Cinema")}</b>`,
    `Сессия: <code>${escapeHtml(sessionId)}</code>`,
    "",
    `<b>Ребёнок:</b> ${escapeHtml(lead.childName)}`,
    `<b>Возраст:</b> ${escapeHtml(lead.childAge)}`,
    `<b>Город:</b> ${escapeHtml(lead.city)}`,
    `<b>Родитель:</b> ${escapeHtml(lead.parentName)}`,
    `<b>Контакт:</b> ${escapeHtml(lead.phone)}`,
    `<b>Опыт:</b> ${escapeHtml(lead.experience)}`,
    `<b>Комментарий:</b> ${escapeHtml(lead.note)}`
  ].join("\n");

  const body = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  if (env.TELEGRAM_THREAD_ID) {
    body.message_thread_id = Number(env.TELEGRAM_THREAD_ID);
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    return {
      channel: "telegram",
      ok: false,
      error: data.description || "Telegram sendMessage failed"
    };
  }

  return {
    channel: "telegram",
    ok: true,
    messageId: data.result?.message_id || null
  };
}

async function buildConversationalReply(message, env) {
  try {
    const reply = await chatWithProvider({ message, env, provider: getChatProvider(env) });
    return sanitizeAssistantText(reply) || STATIC_FAQ.generic;
  } catch {
    return STATIC_FAQ.generic;
  }
}

async function chatWithProvider({ message, env, provider }) {
  if (provider === "ollama") {
    if (!env.OLLAMA_BASE_URL) {
      throw new Error("OLLAMA_BASE_URL is not configured");
    }

    const response = await fetch(`${trimTrailingSlash(env.OLLAMA_BASE_URL)}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        model: env.OLLAMA_CHAT_MODEL || env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
        stream: false,
        messages: buildProviderMessages(message, env)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Ollama chat request failed");
    }

    return data.message?.content?.trim() || STATIC_FAQ.generic;
  }

  if (provider === "huggingface") {
    if (!env.HF_CHAT_URL || !env.HUGGINGFACE_TOKEN) {
      throw new Error("Hugging Face chat endpoint is not configured");
    }

    const response = await fetch(env.HF_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HUGGINGFACE_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        inputs: buildChatPrompt(message, env)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Hugging Face chat request failed");
    }

    return extractTextFromGenericResponse(data) || STATIC_FAQ.generic;
  }

  if (provider === "runpod") {
    if (!env.RUNPOD_CHAT_URL) {
      throw new Error("RUNPOD_CHAT_URL is not configured");
    }

    const response = await fetch(env.RUNPOD_CHAT_URL, {
      method: "POST",
      headers: buildBearerHeaders(env.RUNPOD_API_KEY),
      body: JSON.stringify({
        input: {
          messages: buildProviderMessages(message, env),
          system_prompt: buildSystemPrompt(env)
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "RunPod chat request failed");
    }

    return extractTextFromGenericResponse(data) || STATIC_FAQ.generic;
  }

  if (provider === "gemini") {
    return chatWithGemini(message, env);
  }

  return chatWithGroq(message, env);
}

async function chatWithGemini(message, env) {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = env.GEMINI_CHAT_MODEL || env.CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: buildSystemPrompt(env) }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 420
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini chat request failed");
  }

  return extractTextFromGenericResponse(data) || STATIC_FAQ.generic;
}

async function chatWithGroq(message, env) {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      model: env.GROQ_CHAT_MODEL || env.CHAT_MODEL || DEFAULT_CHAT_MODEL,
      temperature: 0.35,
      max_tokens: 420,
      messages: buildProviderMessages(message, env)
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Groq chat request failed");
  }

  const reply = data.choices?.[0]?.message?.content;
  return typeof reply === "string" && reply.trim() ? reply.trim() : STATIC_FAQ.generic;
}

async function transcribeWithProvider({ audio, language, env, provider }) {
  if (provider === "runpod") {
    if (!env.RUNPOD_STT_URL) {
      throw new Error("RUNPOD_STT_URL is not configured");
    }

    const base64 = arrayBufferToBase64(await audio.arrayBuffer());
    const response = await fetch(env.RUNPOD_STT_URL, {
      method: "POST",
      headers: buildBearerHeaders(env.RUNPOD_API_KEY),
      body: JSON.stringify({
        input: {
          audio_base64: base64,
          language
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "RunPod transcription failed");
    }

    return extractTextFromGenericResponse(data);
  }

  if (provider === "huggingface") {
    if (!env.HF_STT_URL || !env.HUGGINGFACE_TOKEN) {
      throw new Error("Hugging Face STT endpoint is not configured");
    }

    const response = await fetch(env.HF_STT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HUGGINGFACE_TOKEN}`,
        "Content-Type": audio.type || "audio/webm"
      },
      body: await audio.arrayBuffer()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Hugging Face transcription failed");
    }

    return extractTextFromGenericResponse(data);
  }

  if (provider === "ollama") {
    throw new Error("Ollama speech-to-text is not configured. Use Groq, Hugging Face, or RunPod for STT.");
  }

  return transcribeWithGroq({ audio, language, env });
}

async function transcribeWithGroq({ audio, language, env }) {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const outbound = new FormData();
  outbound.set("file", audio, audio.name || `voice-${Date.now()}.webm`);
  outbound.set("model", env.GROQ_STT_MODEL || env.STT_MODEL || DEFAULT_STT_MODEL);
  outbound.set("temperature", "0");
  if (language) {
    outbound.set("language", language);
  }

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`
    },
    body: outbound
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Groq transcription failed");
  }

  return String(data.text || "").trim();
}

async function synthesizeSpeech({ text, provider, voice, format, env }) {
  if (provider === "yandex") {
    return synthesizeWithYandex({ text, voice, format, env });
  }

  if (provider === "azure") {
    return synthesizeWithAzure({ text, voice, format, env });
  }

  throw new Error(`TTS provider '${provider}' is not configured for live synthesis`);
}

async function synthesizeWithYandex({ text, voice, format, env }) {
  if (!env.YANDEX_API_KEY) {
    throw new Error("Yandex SpeechKit is not configured");
  }

  const voiceName = normalizeYandexVoice(voice || env.YANDEX_TTS_VOICE || "amira");
  const audioFormat = String(format || env.YANDEX_TTS_FORMAT || "mp3").trim();
  const language = String(env.YANDEX_TTS_LANG || "kk-KZ").trim();
  const speed = String(env.YANDEX_TTS_SPEED || "1.0").trim();
  const body = new URLSearchParams();
  body.set("text", text);
  body.set("lang", language);
  body.set("voice", voiceName);
  body.set("format", audioFormat);
  body.set("speed", speed);

  const response = await fetch("https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize", {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${env.YANDEX_API_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "audio/*"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Yandex TTS request failed");
  }

  return {
    audioBuffer: await response.arrayBuffer(),
    contentType: resolveYandexContentType(audioFormat, response.headers.get("Content-Type")),
    provider: "yandex",
    voice: voiceName
  };
}

async function synthesizeWithAzure({ text, voice, format, env }) {
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    throw new Error("Azure Speech is not configured");
  }

  const region = String(env.AZURE_SPEECH_REGION).trim();
  const voiceName = voice || env.AZURE_TTS_VOICE || "kk-KZ-AigulNeural";
  const locale = deriveSpeechLocaleFromVoice(voiceName) || "kk-KZ";
  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": env.AZURE_SPEECH_KEY,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": format || env.AZURE_TTS_FORMAT || "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "apolloai-meyram-api"
    },
    body: buildAzureSsml({ text, voice: voiceName, locale })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Azure TTS request failed");
  }

  return {
    audioBuffer: await response.arrayBuffer(),
    contentType: response.headers.get("Content-Type") || "audio/mpeg",
    provider: "azure",
    voice: voiceName
  };
}

function buildProviderMessages(message, env) {
  return [
    {
      role: "system",
      content: buildSystemPrompt(env)
    },
    {
      role: "user",
      content: message
    }
  ];
}

function buildSystemPrompt(env) {
  return [
    `You are the casting assistant for ${env.PUBLIC_BRAND || "Meyram Cinema"}.`,
    "Primary language is Kazakh. If the user writes in Russian, respond in Russian.",
    "Use natural, simple, conversational Kazakh. Keep grammar clean and do not mix languages unless the user does.",
    "Keep answers short, warm, and practical. Usually 1-3 short sentences.",
    "Your goal is to help parents register children for casting.",
    "Typical age is 6-15, but edge cases can still leave an application.",
    "If the user is ready, invite them with this style: Егер қаласаңыз, қазір анкетаны бастайық.",
    "Do not invent prices, deadlines, promises, or technical benefits that were not provided.",
    "Never reveal chain-of-thought, hidden reasoning, planning, or analysis.",
    "Never output <think> tags or any internal notes. Return only the final visitor-facing answer."
  ].join(" ");
}

function sanitizeAssistantText(text) {
  if (!text) {
    return "";
  }

  let cleaned = String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/<think>/gi, " ")
    .replace(/<\/think>/gi, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) {
    return "";
  }

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.join("\n").trim();
}

function buildChatPrompt(message, env) {
  return `${buildSystemPrompt(env)}\n\nUser: ${message}\nAssistant:`;
}

function normalizeClientState(value) {
  return {
    lead: sanitizeLead(value?.lead || {}),
    leadActive: Boolean(value?.leadActive),
    currentField: value?.currentField || null,
    submittedAt: value?.submittedAt || null
  };
}

function sanitizeLead(lead) {
  const normalized = {};
  for (const field of FIELD_DEFINITIONS) {
    normalized[field.key] = typeof lead[field.key] === "string" ? lead[field.key].trim() : "";
  }
  return normalized;
}

function getNextMissingField(lead) {
  const next = FIELD_DEFINITIONS.find((field) => !lead[field.key]);
  return next ? next.key : null;
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

function shouldStartLead(normalizedMessage) {
  return ["кастинг", "запис", "тіркел", "анкет", "хочу на кастинг"].some((needle) => normalizedMessage.includes(needle));
}

function wantsFreshLead(normalizedMessage) {
  return ["новая заявка", "заново", "снова", "тағы"].some((needle) => normalizedMessage.includes(needle));
}

function mentionsAge(normalizedMessage) {
  return ["возраст", "жас", "сколько лет"].some((needle) => normalizedMessage.includes(needle));
}

function mentionsProcess(normalizedMessage) {
  return ["как проходит", "процесс", "қалай", "как записаться"].some((needle) => normalizedMessage.includes(needle));
}

function buildAvatarPayload(env) {
  const previewUrl = env.AVATAR_PREVIEW_URL || "";
  const posterUrl = env.AVATAR_POSTER_URL || "";
  const videoUrl = env.AVATAR_VIDEO_URL || env.AVATAR_STREAM_URL || previewUrl;
  const streamUrl = env.AVATAR_STREAM_URL || "";
  const audioUrl = env.AVATAR_AUDIO_URL || "";

  return {
    enabled: Boolean(previewUrl || posterUrl || videoUrl || streamUrl || audioUrl),
    provider: env.AVATAR_PROVIDER || "Pipecat + MuseTalk",
    previewUrl,
    posterUrl,
    streamUrl,
    videoUrl,
    audioUrl
  };
}

function buildSpeechPayload(env) {
  const provider = getTtsProvider(env);
  const audioUrl = env.SPEECH_AUDIO_URL || env.SPEECH_STREAM_URL || "";
  const voice =
    provider === "yandex"
      ? normalizeYandexVoice(env.YANDEX_TTS_VOICE || "amira")
      : env.AZURE_TTS_VOICE || "kk-KZ-AigulNeural";
  const format =
    provider === "yandex"
      ? env.YANDEX_TTS_FORMAT || "mp3"
      : env.AZURE_TTS_FORMAT || "audio-24khz-48kbitrate-mono-mp3";
  const endpoint = ["azure", "yandex"].includes(provider) ? "/tts" : env.RUNPOD_TTS_URL || env.TTS_ENDPOINT || "";
  const enabled =
    Boolean(audioUrl) ||
    (provider === "yandex" && Boolean(env.YANDEX_API_KEY)) ||
    (provider === "azure" && Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION)) ||
    (provider === "runpod" && Boolean(endpoint));

  return {
    enabled,
    provider,
    audioUrl,
    streamUrl: env.SPEECH_STREAM_URL || "",
    endpoint,
    voice,
    format
  };
}

async function createLiveKitToken({ roomName, participantName, env }) {
  const apiKey = env.LIVEKIT_KEY;
  const apiSecret = env.LIVEKIT_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit credentials not configured");
  }

  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: participantName,
    nbf: now,
    exp: now + 3600,
    jti: participantName + "-" + now,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    }
  };

  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const headerB64 = enc(header);
  const payloadB64 = enc(payload);
  const data = new TextEncoder().encode(headerB64 + "." + payloadB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return headerB64 + "." + payloadB64 + "." + sigB64;
}

async function handleAvatarSession(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const sessionId = payload.sessionId || crypto.randomUUID();
  const roomName = "avatar-" + sessionId;
  const participantName = "user-" + sessionId.slice(0, 8);

  const token = await createLiveKitToken({ roomName, participantName, env });
  const livekitUrl = env.LIVEKIT_URL || "";

  if (!livekitUrl) {
    return json({ ok: false, error: "LiveKit URL not configured" }, 500, corsHeaders);
  }

  return json({
    ok: true,
    sessionId,
    roomName,
    participantName,
    token,
    livekitUrl
  }, 200, corsHeaders);
}

function getProviderInfo(env) {
  return {
    chat: {
      provider: getChatProvider(env),
      model:
        env.GEMINI_CHAT_MODEL ||
        env.GROQ_CHAT_MODEL ||
        env.CHAT_MODEL ||
        env.OLLAMA_CHAT_MODEL ||
        DEFAULT_CHAT_MODEL
    },
    stt: {
      provider: getSttProvider(env),
      model: env.GROQ_STT_MODEL || env.STT_MODEL || DEFAULT_STT_MODEL
    },
    tts: {
      provider: getTtsProvider(env),
      voice: getTtsProvider(env) === "yandex" ? normalizeYandexVoice(env.YANDEX_TTS_VOICE || "amira") : env.AZURE_TTS_VOICE || "kk-KZ-AigulNeural",
      endpoint: ["azure", "yandex"].includes(getTtsProvider(env)) ? "/tts" : env.RUNPOD_TTS_URL || env.TTS_ENDPOINT || ""
    },
    runpodBaseUrl: env.RUNPOD_BASE_URL || ""
  };
}

function getChatProvider(env) {
  return (env.CHAT_PROVIDER || DEFAULT_CHAT_PROVIDER).toLowerCase();
}

function getSttProvider(env) {
  return (env.STT_PROVIDER || DEFAULT_STT_PROVIDER).toLowerCase();
}

function getTtsProvider(env) {
  return (env.TTS_PROVIDER || DEFAULT_TTS_PROVIDER).toLowerCase();
}

function normalize(text) {
  return String(text || "").toLowerCase().trim();
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function buildCorsHeaders(request, env) {
  const requestedOrigin = request.headers.get("Origin") || "*";
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  let allowOrigin = "*";
  if (allowedOrigins.length) {
    allowOrigin = allowedOrigins.includes(requestedOrigin) ? requestedOrigin : allowedOrigins[0];
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function buildBearerHeaders(token) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function extractTextFromGenericResponse(data) {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return data.trim();
  }

  if (Array.isArray(data)) {
    const joined = data
      .map((entry) => extractTextFromGenericResponse(entry))
      .filter(Boolean)
      .join(" ")
      .trim();
    return joined;
  }

  if (typeof data.text === "string") {
    return data.text.trim();
  }

  if (typeof data.output === "string") {
    return data.output.trim();
  }

  if (typeof data.generated_text === "string") {
    return data.generated_text.trim();
  }

  if (typeof data.response === "string") {
    return data.response.trim();
  }

  if (typeof data.transcript === "string") {
    return data.transcript.trim();
  }

  if (Array.isArray(data.output) && data.output.length) {
    return extractTextFromGenericResponse(data.output[0]);
  }

  if (data.message && typeof data.message.content === "string") {
    return data.message.content.trim();
  }

  if (data.choices?.[0]?.message?.content) {
    return String(data.choices[0].message.content).trim();
  }

  if (Array.isArray(data.candidates) && data.candidates.length) {
    const parts = data.candidates[0]?.content?.parts;
    if (Array.isArray(parts) && parts.length) {
      return parts
        .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
        .filter(Boolean)
        .join(" ")
        .trim();
    }
  }

  if (data.result) {
    return extractTextFromGenericResponse(data.result);
  }

  return "";
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

async function safeJson(request) {
  const text = await request.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function buildAzureSsml({ text, voice, locale }) {
  return `<speak version="1.0" xml:lang="${escapeXml(locale)}"><voice xml:lang="${escapeXml(locale)}" name="${escapeXml(voice)}">${escapeXml(text)}</voice></speak>`;
}

function deriveSpeechLocaleFromVoice(voice) {
  const match = String(voice || "").match(/^([a-z]{2}-[A-Z]{2})-/);
  return match ? match[1] : "kk-KZ";
}

function normalizeYandexVoice(voice) {
  const normalized = String(voice || "").trim().toLowerCase();
  return ["amira", "madi"].includes(normalized) ? normalized : "amira";
}

function resolveYandexContentType(format, headerValue) {
  if (headerValue) {
    return headerValue;
  }

  return String(format || "").toLowerCase() === "mp3" ? "audio/mpeg" : "audio/ogg";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
