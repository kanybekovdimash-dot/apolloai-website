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

const STATIC_FAQ = {
  age: "Кастингке негізінен 4-18 жас аралығындағы балалар қатыса алады. Егер бала сәл кіші немесе үлкен болса, бәрібір өтінім қалдыруға болады — менеджер нақтылайды.",
  process: "Жазылу оңай: AI-көмекші қысқа анкета толтырады, содан кейін өтінімді кастинг жүйесіне сақтайды.",
  generic: "Мен кастингке жазылуға немесе жас, формат және келесі қадам туралы кеңес беруге көмектесе аламын."
};

const DEFAULT_CHAT_PROVIDER = "groq";
const DEFAULT_CHAT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
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
      const adminProjectMatch = url.pathname.match(/^\/admin\/projects\/([^/]+)$/);
      const adminProjectApplicationMatch = url.pathname.match(/^\/admin\/project-applications\/([^/]+)$/);
      const adminChatLeadMatch = url.pathname.match(/^\/admin\/chat-leads\/([^/]+)$/);
      const adminUserMatch = url.pathname.match(/^\/admin\/users\/([^/]+)$/);
      const adminVideoMatch = url.pathname.match(/^\/admin\/video-submissions\/([^/]+)$/);
      const adminVideoUrlMatch = url.pathname.match(/^\/admin\/video-submissions\/([^/]+)\/url$/);
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
        return await handleSession(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/chat") {
        return await handleChat(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/lead") {
        return await handleLead(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/transcribe") {
        return await handleTranscribe(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/tts") {
        return await handleTts(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/avatar-session") {
        return await handleAvatarSession(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/project-application") {
        return await handleProjectApplication(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/video") {
        return await handleVideo(request, env, corsHeaders);
      }

      if (request.method === "GET" && url.pathname === "/projects-catalog") {
        return await handleProjectsCatalog(request, env, corsHeaders);
      }

      if (request.method === "GET" && url.pathname === "/admin/dashboard") {
        return await handleAdminDashboard(request, env, corsHeaders);
      }

      if (request.method === "GET" && url.pathname === "/admin/project-applications") {
        return await handleAdminCollection(request, env, corsHeaders, {
          table: "project_applications",
          order: "created_at.desc"
        });
      }

      if (adminProjectApplicationMatch && request.method === "PATCH") {
        return await handleAdminUpdateProjectApplication(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminProjectApplicationMatch[1])
        );
      }

      if (adminProjectApplicationMatch && request.method === "DELETE") {
        return await handleAdminDeleteProjectApplication(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminProjectApplicationMatch[1])
        );
      }

      if (request.method === "GET" && url.pathname === "/admin/chat-leads") {
        return await handleAdminCollection(request, env, corsHeaders, {
          table: "chat_leads",
          order: "created_at.desc"
        });
      }

      if (adminChatLeadMatch && request.method === "PATCH") {
        return await handleAdminUpdateChatLead(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminChatLeadMatch[1])
        );
      }

      if (adminChatLeadMatch && request.method === "DELETE") {
        return await handleAdminDeleteChatLead(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminChatLeadMatch[1])
        );
      }

      if (request.method === "GET" && url.pathname === "/admin/users") {
        return await handleAdminUsers(request, env, corsHeaders);
      }

      if (adminUserMatch && request.method === "PATCH") {
        return await handleAdminUpdateUser(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminUserMatch[1])
        );
      }

      if (adminUserMatch && request.method === "DELETE") {
        return await handleAdminDeleteUser(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminUserMatch[1])
        );
      }

      if (request.method === "GET" && url.pathname === "/admin/video-submissions") {
        return await handleAdminCollection(request, env, corsHeaders, {
          table: "video_submissions",
          order: "created_at.desc"
        });
      }

      if (adminVideoUrlMatch && request.method === "GET") {
        return await handleAdminVideoUrl(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminVideoUrlMatch[1])
        );
      }

      if (adminVideoMatch && request.method === "DELETE") {
        return await handleAdminDeleteVideo(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminVideoMatch[1])
        );
      }

      if (request.method === "GET" && url.pathname === "/admin/projects") {
        return await handleAdminCollection(request, env, corsHeaders, {
          table: "projects_catalog",
          order: "updated_at.desc"
        });
      }

      if (request.method === "POST" && url.pathname === "/admin/projects") {
        return await handleAdminSaveProject(request, env, corsHeaders);
      }

      if (adminProjectMatch && request.method === "DELETE") {
        return await handleAdminDeleteProject(
          request,
          env,
          corsHeaders,
          decodeURIComponent(adminProjectMatch[1])
        );
      }

      if (request.method === "GET" && url.pathname === "/admin/ai-settings") {
        return await handleAdminGetAiSettings(request, env, corsHeaders);
      }

      if (request.method === "POST" && url.pathname === "/admin/ai-settings") {
        return await handleAdminSaveAiSettings(request, env, corsHeaders);
      }

      return json({ ok: false, error: "Not found" }, 404, corsHeaders);
    } catch (error) {
      const status = Number(error?.status) || 500;
      return json({ ok: false, error: error.message || "Internal error" }, status, corsHeaders);
    }
  }
};

async function handleSession(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const aiSettings = await loadAiSettings(env);
  const publicBrand = payload.brand || aiSettings.publicBrand;

  return json(
    {
      ok: true,
      sessionId: crypto.randomUUID(),
      publicBrand,
      assistantBrand: aiSettings.assistantBrand,
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
  const history = Array.isArray(payload.history) ? payload.history : [];
  const result = await orchestrateChat({ sessionId, message, history, clientState, env });

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

async function orchestrateChat({ sessionId, message, history, clientState, env }) {
  const normalizedMessage = normalize(message);
  const resetLead = wantsFreshLead(normalizedMessage);
  let lead = sanitizeLead(resetLead ? {} : clientState.lead);
  let submitted = resetLead ? false : Boolean(clientState.submittedAt);
  let submittedAt = resetLead ? null : clientState.submittedAt || null;

  const rawReply = await buildConversationalReply(message, history, env);
  const { cleanReply, extractedLead } = parseLeadFromReply(rawReply, lead);
  lead = sanitizeLead(extractedLead);

  let reply = cleanReply || STATIC_FAQ.generic;
  let leadActive = false;
  let currentField = null;
  let summary = null;
  let delivery = null;

  const nextField = getNextMissingField(lead);
  const shouldContinueLead = !submitted && (resetLead || clientState.leadActive || shouldStartLead(normalizedMessage) || hasAnyLeadData(lead));

  if (!submitted && isLeadComplete(lead)) {
    summary = buildSummaryPayload(lead);
    try {
      delivery = await deliverLead({ lead, sessionId, env });
      if (delivery.ok) {
        submitted = true;
        submittedAt = new Date().toISOString();
      }
    } catch (error) {
      delivery = {
        channel: "supabase",
        ok: false,
        error: error.message || "save failed"
      };
    }

    if (!cleanReply) {
      reply = delivery?.ok
        ? "Дайын! Өтінім қабылданды. Менеджер жақын арада хабарласады."
        : "Өтінім дайын. Қазір жүйе сақтауға тырысып жатыр, сәл кейін қайта тексереміз.";
    }
  } else if (shouldContinueLead) {
    leadActive = Boolean(nextField);
    currentField = nextField;

    if (currentField) {
      const question = getFieldDefinition(currentField).question;
      if (resetLead) {
        reply = `Жақсы, бастайық. ${question}`;
      } else if (!cleanReply) {
        reply = question;
      } else if (!hasFollowUpPrompt(cleanReply)) {
        reply = `${cleanReply}

${question}`;
      }
    }
  }

  if ((submitted || delivery) && !summary && hasAnyLeadData(lead)) {
    summary = buildSummaryPayload(lead);
  }

  return {
    reply,
    lead,
    leadActive,
    currentField,
    submitted,
    submittedAt,
    summary,
    delivery
  };
}


async function deliverLead({ lead, sessionId, env }) {
  const summary = buildSummaryPayload(lead);
  const [savedLead] = await insertSupabaseRow(env, "chat_leads", {
    session_id: sessionId,
    brand: env.PUBLIC_BRAND || "Meyram Cinema",
    child_name: summary.lead.childName === "—" ? null : summary.lead.childName,
    child_age: summary.lead.childAge === "—" ? null : summary.lead.childAge,
    city: summary.lead.city === "—" ? null : summary.lead.city,
    parent_name: summary.lead.parentName === "—" ? null : summary.lead.parentName,
    phone: summary.lead.phone === "—" ? null : summary.lead.phone,
    experience: summary.lead.experience === "—" ? null : summary.lead.experience,
    note: summary.lead.note === "—" ? null : summary.lead.note,
    source: "ai-chat"
  });

  return {
    channel: "supabase",
    ok: true,
    id: savedLead?.id || null
  };
}

async function buildConversationalReply(message, history, env) {
  const aiSettings = await loadAiSettings(env);
  try {
    const reply = await chatWithProvider({ message, history, env, provider: getChatProvider(env), settings: aiSettings });
    return sanitizeAssistantText(reply) || aiSettings.faqGeneric || STATIC_FAQ.generic;
  } catch {
    return aiSettings.faqGeneric || STATIC_FAQ.generic;
  }
}

function parseLeadFromReply(reply, existingLead) {
  const leadMatch = reply.match(/<!--LEAD_DATA:(.*?)-->/s);
  let cleanReply = reply.replace(/<!--LEAD_DATA:.*?-->/gs, "").trim();

  if (!leadMatch) {
    return { cleanReply, extractedLead: existingLead };
  }

  try {
    const extracted = JSON.parse(leadMatch[1]);
    const merged = { ...existingLead };
    for (const field of FIELD_DEFINITIONS) {
      const val = String(extracted[field.key] || "").trim();
      if (val) {
        merged[field.key] = val;
      }
    }
    return { cleanReply, extractedLead: merged };
  } catch {
    return { cleanReply, extractedLead: existingLead };
  }
}

async function chatWithProvider({ message, history, env, provider, settings }) {
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
        messages: buildProviderMessages(message, env, settings)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Ollama chat request failed");
    }

    return data.message?.content?.trim() || settings?.faqGeneric || STATIC_FAQ.generic;
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
        inputs: buildChatPrompt(message, env, settings)
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Hugging Face chat request failed");
    }

    return extractTextFromGenericResponse(data) || settings?.faqGeneric || STATIC_FAQ.generic;
  }


  return chatWithGroq(message, history, env, settings);
}

async function chatWithGroq(message, history, env, settings) {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  const messages = [{ role: "system", content: buildSystemPrompt(env, settings) }];
  if (Array.isArray(history)) {
    for (const msg of history.slice(-20)) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: String(msg.content || "") });
      }
    }
  }
  if (!messages.length || messages[messages.length - 1].content !== message) {
    messages.push({ role: "user", content: message });
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
      messages
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Groq chat request failed");
  }

  const reply = data.choices?.[0]?.message?.content;
  return typeof reply === "string" && reply.trim() ? reply.trim() : settings?.faqGeneric || STATIC_FAQ.generic;
}

async function transcribeWithProvider({ audio, language, env, provider }) {

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
    throw new Error("Ollama speech-to-text is not configured. Use Groq or Hugging Face for STT.");
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

  const voiceName = normalizeYandexVoice(voice || env.YANDEX_TTS_VOICE || "zhanar");
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

function buildProviderMessages(message, env, settings) {
  return [
    {
      role: "system",
      content: buildSystemPrompt(env, settings)
    },
    {
      role: "user",
      content: message
    }
  ];
}

function buildSystemPrompt(env, settings) {
  const effective = settings || getDefaultAiSettings(env);
  if (effective.systemPromptOverride) {
    return String(effective.systemPromptOverride).trim();
  }

  return `Сен ${effective.publicBrand} кастинг көмекшісісің. Сенің атың ${effective.assistantBrand}.

ТІЛ: Тек қазақ тілінде жауап бер. Ешқашан орысша немесе ағылшынша жауап берме. Егер пайдаланушы орысша жазса — бәрібір қазақша жауап бер.

МІНЕЗ: Сен жылы, достық, тірі адамдай сөйлейсің. Қысқа, табиғи жауаптар бер (1-3 сөйлем). Эмоция қос, қуан, мақта, қолда.

КАСТИНГ АҚПАРАТЫ:
- Кастингке 4-18 жас аралығындағы балалар қатыса алады
- Тіркелу тегін
- Берілмеген бағаларды, мерзімдерді, уәделерді ойлап таппа

ДЕРЕКТЕР ЖИНАУ:
Пайдаланушымен еркін сөйлес, бірақ біртіндеп мына деректерді жина:
1. Баланың аты
2. Баланың жасы
3. Қаласы
4. Ата-ана есімі
5. Телефон нөмірі (МАҢЫЗДЫ! Міндетті түрде сұра: "Телефон нөміріңізді жазыңыз, менеджер хабарласады")
6. Тәжірибесі бар ма (сахна, TikTok, курс, т.б.)
7. Қосымша ескерту

ЕРЕЖЕ: Бірден бәрін сұрама. Бір-екіден сұра, табиғи сөйлес. Телефонды міндетті сұра.

ДЕРЕКТЕР ЖІБЕРІЛГЕННЕН КЕЙІН:
Егер барлық деректер жиналса — пайдаланушыны құттықта, "менеджер жақын арада хабарласады" де. Содан кейін еркін сөйлесуді жалғастыр.

<think> тегтерін немесе ішкі жазбаларды шығарма.

ТЕХНИКАЛЫҚ ТАПСЫРМА (пайдаланушыға көрсетпе):
Жауаптың ең соңына міндетті түрде мына форматта JSON қос:
<!--LEAD_DATA:{"childName":"","childAge":"","city":"","parentName":"","phone":"","experience":"","note":""}-->
Сөйлесуде айтылған деректерді JSON-ға толтыр. Белгісіз өрістерді бос қалдыр (""). Ойлап таппа. Бұл блок ӘРҚАШАН болуы керек.`;
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

function buildChatPrompt(message, env, settings) {
  return `${buildSystemPrompt(env, settings)}\n\nUser: ${message}\nAssistant:`;
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

function hasAnyLeadData(lead) {
  return FIELD_DEFINITIONS.some((field) => Boolean(lead[field.key]));
}

function isLeadComplete(lead) {
  return !getNextMissingField(lead);
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
  return ["новая заявка", "заново", "снова", "тағы", "қайтадан", "қайта бастайық"].some((needle) => normalizedMessage.includes(needle));
}

function hasFollowUpPrompt(text) {
  return /\?|жазыңыз|айтыңыз|жіберіңіз|көрсетіңіз/i.test(String(text || ""));
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
    provider: env.AVATAR_PROVIDER || "Meyram Cinema",
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
      ? normalizeYandexVoice(env.YANDEX_TTS_VOICE || "zhanar")
      : env.AZURE_TTS_VOICE || "kk-KZ-AigulNeural";
  const format =
    provider === "yandex"
      ? env.YANDEX_TTS_FORMAT || "mp3"
      : env.AZURE_TTS_FORMAT || "audio-24khz-48kbitrate-mono-mp3";
  const endpoint = ["azure", "yandex"].includes(provider) ? "/tts" : env.TTS_ENDPOINT || "";
  const enabled =
    Boolean(audioUrl) ||
    (provider === "yandex" && Boolean(env.YANDEX_API_KEY)) ||
    (provider === "azure" && Boolean(env.AZURE_SPEECH_KEY && env.AZURE_SPEECH_REGION));

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
      voice: getTtsProvider(env) === "yandex" ? normalizeYandexVoice(env.YANDEX_TTS_VOICE || "zhanar") : env.AZURE_TTS_VOICE || "kk-KZ-AigulNeural",
      endpoint: ["azure", "yandex"].includes(getTtsProvider(env)) ? "/tts" : env.TTS_ENDPOINT || ""
    },
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
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
  return ["amira", "madi", "zhanar"].includes(normalized) ? normalized : "zhanar";
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

async function handleProjectApplication(request, env, corsHeaders) {
  const payload = await safeJson(request);
  const applicant = payload.applicant || {};
  const fullName = String(applicant.fullName || "").trim();
  const age = String(applicant.age || "").trim();
  const city = String(applicant.city || "").trim();
  const parentName = String(applicant.parentName || "").trim();
  const phone = String(applicant.phone || "").trim();
  const portfolioUrl = String(applicant.portfolioUrl || "").trim();
  const experience = String(applicant.experience || "").trim();
  const note = String(applicant.note || "").trim();
  const projectId = String(payload.projectId || crypto.randomUUID()).trim();
  const projectTitle = String(payload.projectTitle || "").trim();
  const roleId = String(payload.roleId || crypto.randomUUID()).trim();
  const roleTitle = String(payload.roleTitle || "").trim();

  if (!projectTitle || !roleTitle || !fullName || !age || !city || !parentName || !phone || !note) {
    return json({ ok: false, error: "Required application fields are missing" }, 400, corsHeaders);
  }

  const [savedApplication] = await insertSupabaseRow(env, "project_applications", {
    project_id: projectId,
    project_title: projectTitle,
    role_id: roleId,
    role_title: roleTitle,
    full_name: fullName,
    age,
    city,
    parent_name: parentName,
    phone,
    portfolio_url: portfolioUrl || null,
    experience: experience || null,
    note,
    status: "new",
    source: "site"
  });

  return json(
    {
      ok: true,
      id: savedApplication?.id || null,
      message: "Project application saved"
    },
    200,
    corsHeaders
  );
}

async function handleVideo(request, env, corsHeaders) {
  const formData = await request.formData();
  const videoFile = formData.get("video");
  const sessionId = String(formData.get("sessionId") || "unknown").trim();

  if (!videoFile || !(videoFile instanceof File)) {
    return json({ ok: false, error: "No video file provided" }, 400, corsHeaders);
  }

  const maxSize = 50 * 1024 * 1024;
  if (videoFile.size > maxSize) {
    return json({ ok: false, error: "Видео тым үлкен (50MB дейін)" }, 400, corsHeaders);
  }

  const bucket = resolveSupabaseVideoBucket(env);
  const storagePath = buildStoragePath(sessionId, videoFile.name || "video.webm");
  await uploadSupabaseObject(env, {
    bucket,
    path: storagePath,
    file: videoFile
  });

  const [savedVideo] = await insertSupabaseRow(env, "video_submissions", {
    session_id: sessionId,
    file_name: videoFile.name || "video.webm",
    file_size: videoFile.size,
    content_type: normalizeUploadedVideoContentType(videoFile.type || "video/webm"),
    storage_bucket: bucket,
    storage_path: storagePath,
    status: "uploaded"
  });

  return json(
    {
      ok: true,
      id: savedVideo?.id || null,
      message: "Video saved to casting storage"
    },
    200,
    corsHeaders
  );
}

async function handleAdminDashboard(request, env, corsHeaders) {
  await requireAdmin(request, env);

  const [projectApplications, chatLeads, videoSubmissions, recentApplications, recentLeads, recentVideos] = await Promise.all([
    fetchSupabaseCount(env, "project_applications"),
    fetchSupabaseCount(env, "chat_leads"),
    fetchSupabaseCount(env, "video_submissions"),
    fetchSupabaseRows(env, "project_applications", { limit: 6, order: "created_at.desc" }),
    fetchSupabaseRows(env, "chat_leads", { limit: 6, order: "created_at.desc" }),
    fetchSupabaseRows(env, "video_submissions", { limit: 6, order: "created_at.desc" })
  ]);

  return json(
    {
      ok: true,
      stats: {
        projectApplications,
        chatLeads,
        videoSubmissions
      },
      recent: {
        projectApplications: recentApplications,
        chatLeads: recentLeads,
        videoSubmissions: recentVideos
      },
      generatedAt: new Date().toISOString()
    },
    200,
    corsHeaders
  );
}

async function handleAdminCollection(request, env, corsHeaders, { table, order = "created_at.desc" }) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const limit = parseLimitParam(url.searchParams.get("limit"), 24);
  const items = await fetchSupabaseRows(env, table, { limit, order });
  const total = await fetchSupabaseCount(env, table);

  return json(
    {
      ok: true,
      table,
      total,
      limit,
      items
    },
    200,
    corsHeaders
  );
}


async function handleAdminUsers(request, env, corsHeaders) {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const limit = parseLimitParam(url.searchParams.get("limit"), 24);
  const pageRaw = Number.parseInt(String(url.searchParams.get("page") || "1"), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const [users, total] = await Promise.all([
    fetchSupabaseAuthUsers(env, { page, perPage: limit }),
    fetchSupabaseAuthUsersCount(env)
  ]);

  return json(
    {
      ok: true,
      total,
      limit,
      page,
      items: users.map(mapAdminAuthUser)
    },
    200,
    corsHeaders
  );
}

async function handleAdminUpdateUser(request, env, corsHeaders, userId) {
  await requireAdmin(request, env);
  const payload = await safeJson(request);
  const patch = sanitizeAdminUserUpdate(payload.item || payload.user || payload.patch || payload || {});

  if (!Object.keys(patch).length) {
    throw createHttpError("Nothing to update", 400);
  }

  const user = await updateSupabaseAuthUser(env, userId, patch);
  return json({ ok: true, item: mapAdminAuthUser(user) }, 200, corsHeaders);
}

async function handleAdminDeleteUser(request, env, corsHeaders, userId) {
  await requireAdmin(request, env);
  await deleteSupabaseAuthUser(env, userId);
  return json({ ok: true, id: userId }, 200, corsHeaders);
}
async function handleProjectsCatalog(request, env, corsHeaders) {
  const url = new URL(request.url);
  const limit = parseLimitParam(url.searchParams.get("limit"), 20);
  const rows = await fetchSupabaseRows(env, "projects_catalog", {
    limit,
    order: "countdown_date.asc",
    filters: {
      is_published: true
    }
  });

  return json(
    {
      ok: true,
      items: rows.map(mapProjectRecordToCatalogItem)
    },
    200,
    corsHeaders
  );
}

async function handleAdminSaveProject(request, env, corsHeaders) {
  await requireAdmin(request, env);
  const payload = await safeJson(request);
  const project = sanitizeProjectCatalogInput(payload.project || {});

  const [savedProject] = await upsertSupabaseRow(env, "projects_catalog", project, "id");

  return json(
    {
      ok: true,
      item: mapProjectRecordToCatalogItem(savedProject),
      raw: savedProject
    },
    200,
    corsHeaders
  );
}

async function handleAdminDeleteProject(request, env, corsHeaders, projectId) {
  await requireAdmin(request, env);
  await deleteSupabaseRows(env, "projects_catalog", "id", projectId);
  return json({ ok: true, id: projectId }, 200, corsHeaders);
}

async function handleAdminUpdateProjectApplication(request, env, corsHeaders, applicationId) {
  await requireAdmin(request, env);
  const payload = await safeJson(request);
  const patch = sanitizeProjectApplicationUpdate(payload.item || payload.application || payload.patch || payload || {});

  if (!Object.keys(patch).length) {
    throw createHttpError("Nothing to update", 400);
  }

  const [item] = await patchSupabaseRows(env, "project_applications", "id", applicationId, patch);
  return json({ ok: true, item }, 200, corsHeaders);
}

async function handleAdminDeleteProjectApplication(request, env, corsHeaders, applicationId) {
  await requireAdmin(request, env);
  await deleteSupabaseRows(env, "project_applications", "id", applicationId);
  return json({ ok: true, id: applicationId }, 200, corsHeaders);
}

async function handleAdminUpdateChatLead(request, env, corsHeaders, leadId) {
  await requireAdmin(request, env);
  const payload = await safeJson(request);
  const patch = sanitizeChatLeadUpdate(payload.item || payload.lead || payload.patch || payload || {});

  if (!Object.keys(patch).length) {
    throw createHttpError("Nothing to update", 400);
  }

  const [item] = await patchSupabaseRows(env, "chat_leads", "id", leadId, patch);
  return json({ ok: true, item }, 200, corsHeaders);
}

async function handleAdminDeleteChatLead(request, env, corsHeaders, leadId) {
  await requireAdmin(request, env);
  await deleteSupabaseRows(env, "chat_leads", "id", leadId);
  return json({ ok: true, id: leadId }, 200, corsHeaders);
}

async function handleAdminVideoUrl(request, env, corsHeaders, videoId) {
  await requireAdmin(request, env);
  const [item] = await fetchSupabaseRows(env, "video_submissions", {
    limit: 1,
    filters: { id: videoId }
  });

  if (!item) {
    throw createHttpError("Video not found", 404);
  }

  const bucket = String(item.storage_bucket || resolveSupabaseVideoBucket(env)).trim();
  const path = String(item.storage_path || "").trim();
  if (!bucket || !path) {
    throw createHttpError("Video storage path is missing", 400);
  }

  const signedUrl = await createSupabaseSignedObjectUrl(env, {
    bucket,
    path,
    expiresIn: 3600
  });

  return json({ ok: true, item, signedUrl }, 200, corsHeaders);
}

async function handleAdminDeleteVideo(request, env, corsHeaders, videoId) {
  await requireAdmin(request, env);
  const [item] = await fetchSupabaseRows(env, "video_submissions", {
    limit: 1,
    filters: { id: videoId }
  });

  if (!item) {
    throw createHttpError("Video not found", 404);
  }

  const bucket = String(item.storage_bucket || resolveSupabaseVideoBucket(env)).trim();
  const path = String(item.storage_path || "").trim();
  if (bucket && path) {
    await removeSupabaseObject(env, { bucket, path });
  }

  await deleteSupabaseRows(env, "video_submissions", "id", videoId);
  return json({ ok: true, id: videoId }, 200, corsHeaders);
}

async function handleAdminGetAiSettings(request, env, corsHeaders) {
  await requireAdmin(request, env);
  const settings = await loadAiSettings(env);
  return json({ ok: true, item: settings }, 200, corsHeaders);
}

async function handleAdminSaveAiSettings(request, env, corsHeaders) {
  await requireAdmin(request, env);
  const payload = await safeJson(request);
  const settings = sanitizeAiSettingsInput(payload.settings || {});
  const [savedSettings] = await upsertSupabaseRow(env, "ai_settings", settings, "id");
  return json({ ok: true, item: mapAiSettingsRecord(savedSettings) }, 200, corsHeaders);
}

function parseLimitParam(rawValue, fallback = 24) {
  const parsed = Number.parseInt(String(rawValue || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

async function requireAdmin(request, env) {
  const expected = String(env.ADMIN_ACCESS_TOKEN || "").trim();
  const provided = resolveAdminToken(request);

  if (expected && provided === expected) {
    return;
  }

  if (provided) {
    const user = await verifySupabaseAdminToken(provided, env);
    if (user) {
      return user;
    }
  }

  if (expected || String(env.SUPABASE_ANON_KEY || "").trim()) {
    throw createHttpError("Unauthorized", 401);
  }

  throw createHttpError("Admin auth is not configured", 500);
}

async function verifySupabaseAdminToken(token, env) {
  const url = normalizeSupabaseUrl(env.SUPABASE_URL);
  const apiKey = String(env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !apiKey || !token) {
    return null;
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`
    }
  });

  const data = await parseJsonResponse(response);
  if (!response.ok || !data?.id) {
    return null;
  }

  const adminEmails = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length) {
    const email = String(data.email || "").trim().toLowerCase();
    if (!email || !adminEmails.includes(email)) {
      throw createHttpError("Forbidden", 403);
    }
  }

  return data;
}

function resolveAdminToken(request) {

  const explicit = String(request.headers.get("X-Admin-Token") || "").trim();
  if (explicit) {
    return explicit;
  }

  const authHeader = String(request.headers.get("Authorization") || "").trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function insertSupabaseRow(env, table, payload) {
  ensureSupabaseConfigured(env);
  const response = await fetch(`${getSupabaseRestBaseUrl(env)}/${table}`, {
    method: "POST",
    headers: {
      ...buildSupabaseServiceHeaders(env),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || `Supabase insert failed for ${table}`, 502);
  }

  return Array.isArray(data) ? data : [data];
}

async function upsertSupabaseRow(env, table, payload, conflictColumn = "id") {
  ensureSupabaseConfigured(env);
  const response = await fetch(`${getSupabaseRestBaseUrl(env)}/${table}?on_conflict=${encodeURIComponent(conflictColumn)}`, {
    method: "POST",
    headers: {
      ...buildSupabaseServiceHeaders(env),
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || `Supabase upsert failed for ${table}`, 502);
  }

  return Array.isArray(data) ? data : [data];
}

async function patchSupabaseRows(env, table, idColumn, id, payload, { select = "*" } = {}) {
  ensureSupabaseConfigured(env);
  const params = new URLSearchParams();
  params.set(idColumn, `eq.${id}`);
  params.set("select", select);

  const response = await fetch(`${getSupabaseRestBaseUrl(env)}/${table}?${params.toString()}`, {
    method: "PATCH",
    headers: {
      ...buildSupabaseServiceHeaders(env),
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || `Supabase patch failed for ${table}`, 502);
  }

  return Array.isArray(data) ? data : [data];
}

async function deleteSupabaseRows(env, table, idColumn, id) {
  ensureSupabaseConfigured(env);
  const params = new URLSearchParams();
  params.set(idColumn, `eq.${id}`);
  params.set("select", "*");

  const response = await fetch(`${getSupabaseRestBaseUrl(env)}/${table}?${params.toString()}`, {
    method: "DELETE",
    headers: {
      ...buildSupabaseServiceHeaders(env),
      Prefer: "return=representation"
    }
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || `Supabase delete failed for ${table}`, 502);
  }

  return Array.isArray(data) ? data : [data];
}

async function fetchSupabaseRows(env, table, { limit = 24, order = "created_at.desc", select = "*", filters = {} } = {}) {
  ensureSupabaseConfigured(env);
  const params = new URLSearchParams();
  params.set("select", select);
  params.set("order", order);
  params.set("limit", String(limit));

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, `eq.${value}`);
  }

  const response = await fetch(`${getSupabaseRestBaseUrl(env)}/${table}?${params.toString()}`, {
    headers: buildSupabaseServiceHeaders(env)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || `Supabase fetch failed for ${table}`, 502);
  }

  return Array.isArray(data) ? data : [];
}

async function fetchSupabaseCount(env, table, filters = {}) {
  ensureSupabaseConfigured(env);
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("limit", "1");

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    params.set(key, `eq.${value}`);
  }

  const response = await fetch(`${getSupabaseRestBaseUrl(env)}/${table}?${params.toString()}`, {
    headers: {
      ...buildSupabaseServiceHeaders(env),
      Prefer: "count=exact",
      Range: "0-0"
    }
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || `Supabase count failed for ${table}`, 502);
  }

  const contentRange = response.headers.get("content-range") || "";
  const countPart = contentRange.split("/").pop();
  const parsed = Number.parseInt(countPart, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return Array.isArray(data) ? data.length : 0;
}
async function uploadSupabaseObject(env, { bucket, path, file }) {
  ensureSupabaseConfigured(env);
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(`${getSupabaseStorageBaseUrl(env)}/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      ...buildSupabaseServiceHeaders(env),
      "Content-Type": normalizeUploadedVideoContentType(file.type || "application/octet-stream"),
      "x-upsert": "false",
      "cache-control": "3600"
    },
    body: await file.arrayBuffer()
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || "Supabase storage upload failed", 502);
  }

  return data;
}

async function fetchSupabaseAuthUsers(env, { page = 1, perPage = 24 } = {}) {
  ensureSupabaseConfigured(env);
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, page)));
  params.set("per_page", String(Math.min(Math.max(1, perPage), 100)));

  const response = await fetch(`${normalizeSupabaseUrl(env.SUPABASE_URL)}/auth/v1/admin/users?${params.toString()}`, {
    headers: buildSupabaseServiceHeaders(env)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || "Supabase users fetch failed", 502);
  }

  return Array.isArray(data?.users) ? data.users : [];
}

async function fetchSupabaseAuthUsersCount(env) {
  const perPage = 100;
  let total = 0;

  for (let page = 1; page <= 50; page += 1) {
    const users = await fetchSupabaseAuthUsers(env, { page, perPage });
    total += users.length;
    if (users.length < perPage) {
      break;
    }
  }

  return total;
}

async function updateSupabaseAuthUser(env, userId, payload) {
  ensureSupabaseConfigured(env);
  const response = await fetch(`${normalizeSupabaseUrl(env.SUPABASE_URL)}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    headers: buildSupabaseServiceHeaders(env),
    body: JSON.stringify(payload)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || "Supabase user update failed", 502);
  }

  return data?.user || data;
}

async function deleteSupabaseAuthUser(env, userId) {
  ensureSupabaseConfigured(env);
  const response = await fetch(`${normalizeSupabaseUrl(env.SUPABASE_URL)}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: buildSupabaseServiceHeaders(env)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || "Supabase user delete failed", 502);
  }

  return data;
}

async function createSupabaseSignedObjectUrl(env, { bucket, path, expiresIn = 3600 }) {
  ensureSupabaseConfigured(env);
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(`${normalizeSupabaseUrl(env.SUPABASE_URL)}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: buildSupabaseServiceHeaders(env),
    body: JSON.stringify({ expiresIn })
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || "Supabase signed URL failed", 502);
  }

  const signedPath = String(data?.signedURL || data?.signedUrl || "").trim();
  if (!signedPath) {
    throw createHttpError("Supabase signed URL is empty", 502);
  }

  if (/^https?:\/\//i.test(signedPath)) {
    return signedPath;
  }

  return `${normalizeSupabaseUrl(env.SUPABASE_URL)}/storage/v1${signedPath}`;
}

async function removeSupabaseObject(env, { bucket, path }) {
  ensureSupabaseConfigured(env);
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(`${getSupabaseStorageBaseUrl(env)}/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "DELETE",
    headers: buildSupabaseServiceHeaders(env)
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw createHttpError(data?.message || data?.error || "Supabase storage delete failed", 502);
  }

  return data;
}

function mapAdminAuthUser(user) {
  const metadata = user?.user_metadata || {};
  return {
    id: String(user?.id || "").trim(),
    email: String(user?.email || "").trim(),
    phone: String(user?.phone || "").trim(),
    role: String(user?.app_metadata?.role || user?.role || metadata?.role || "authenticated").trim(),
    full_name: String(metadata?.full_name || metadata?.name || metadata?.fullName || "").trim(),
    created_at: String(user?.created_at || "").trim(),
    last_sign_in_at: String(user?.last_sign_in_at || "").trim(),
    confirmed_at: String(user?.confirmed_at || user?.email_confirmed_at || "").trim()
  };
}

function sanitizeOptionalText(value, maxLength = 1000) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizePatchPayload(payload, allowedKeys) {
  const patch = {};
  for (const key of allowedKeys) {
    if (!(key in payload)) {
      continue;
    }
    const value = sanitizeOptionalText(payload[key], 2000);
    if (value) {
      patch[key] = value;
    }
  }
  return patch;
}

function sanitizeProjectApplicationUpdate(payload) {
  const patch = sanitizePatchPayload(payload, [
    "project_title",
    "role_title",
    "full_name",
    "age",
    "city",
    "parent_name",
    "phone",
    "portfolio_url",
    "experience",
    "note",
    "status"
  ]);

  if (patch.age) {
    patch.age = patch.age.replace(/[^\d]/g, "");
  }

  return patch;
}

function sanitizeChatLeadUpdate(payload) {
  const patch = sanitizePatchPayload(payload, [
    "child_name",
    "child_age",
    "city",
    "parent_name",
    "phone",
    "experience",
    "note"
  ]);

  if (patch.child_age) {
    patch.child_age = patch.child_age.replace(/[^\d]/g, "");
  }

  return patch;
}

function sanitizeAdminUserUpdate(payload) {
  const update = {};
  const email = sanitizeOptionalText(payload.email, 320).toLowerCase();
  const phone = sanitizeOptionalText(payload.phone, 120);
  const fullName = sanitizeOptionalText(payload.full_name || payload.fullName, 200);
  const role = sanitizeOptionalText(payload.role, 80);

  if (email) {
    update.email = email;
  }

  if (phone) {
    update.phone = phone;
  }

  if (fullName) {
    update.user_metadata = {
      ...(update.user_metadata || {}),
      full_name: fullName,
      name: fullName,
      fullName
    };
  }

  if (role) {
    update.app_metadata = {
      ...(update.app_metadata || {}),
      role
    };
    update.user_metadata = {
      ...(update.user_metadata || {}),
      role
    };
  }

  return update;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function buildSupabaseServiceHeaders(env) {
  ensureSupabaseConfigured(env);
  return {
    "Content-Type": "application/json; charset=utf-8",
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
}

function getSupabaseRestBaseUrl(env) {
  return `${normalizeSupabaseUrl(env.SUPABASE_URL)}/rest/v1`;
}

function getSupabaseStorageBaseUrl(env) {
  return `${normalizeSupabaseUrl(env.SUPABASE_URL)}/storage/v1/object`;
}

function normalizeSupabaseUrl(value) {
  return trimTrailingSlash(String(value || "").trim());
}

function resolveSupabaseVideoBucket(env) {
  return String(env.SUPABASE_STORAGE_BUCKET || "casting-videos").trim() || "casting-videos";
}

function normalizeUploadedVideoContentType(value) {
  const type = String(value || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!type || type === "video/x-matroska") {
    return "video/webm";
  }
  return type;
}

function ensureSupabaseConfigured(env) {
  if (!normalizeSupabaseUrl(env.SUPABASE_URL)) {
    throw createHttpError("SUPABASE_URL is not configured", 500);
  }

  if (!String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim()) {
    throw createHttpError("SUPABASE_SERVICE_ROLE_KEY is not configured", 500);
  }
}

function buildStoragePath(sessionId, fileName) {
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  const safeSession = slugifyFilePart(sessionId || "session");
  const safeFile = slugifyFilePart(fileName || "video.webm");
  return `video-submissions/${timestamp.slice(0, 10)}/${timestamp}-${safeSession}-${safeFile}`;
}

function slugifyFilePart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яёіїңғүұқөһ._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
}

function createHttpError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sanitizeProjectCatalogInput(project) {
  const roles = Array.isArray(project.roles) ? project.roles : [];
  const id = slugifyProjectId(project.id || project.title || crypto.randomUUID());

  return {
    id,
    title: String(project.title || "").trim(),
    genre: String(project.genre || "").trim() || null,
    poster: String(project.poster || "").trim() || null,
    banner: String(project.banner || "").trim() || null,
    promo_video_url: String(project.promoVideoUrl || project.promo_video_url || "").trim() || null,
    countdown_date: String(project.countdownDate || project.countdown_date || "").trim() || null,
    description: String(project.description || "").trim() || null,
    director: String(project.director || "").trim() || null,
    age_range: String(project.ageRange || project.age_range || "").trim() || null,
    roles: roles.map(sanitizeProjectRole),
    is_published: project.isPublished !== false,
    updated_at: new Date().toISOString()
  };
}

function sanitizeProjectRole(role) {
  return {
    id: slugifyProjectId(role.id || role.title || crypto.randomUUID()),
    title: String(role.title || "").trim(),
    description: String(role.description || "").trim(),
    ageRange: String(role.ageRange || role.age_range || "").trim(),
    gender: String(role.gender || "").trim(),
    status: String(role.status || "open").trim() || "open",
    applicantsCount: Number(role.applicantsCount || role.applicants_count || 0) || 0,
    applicants: Array.isArray(role.applicants) ? role.applicants.map((item) => String(item || "").trim()).filter(Boolean) : [],
    selectedActor: role.selectedActor && typeof role.selectedActor === "object"
      ? {
          name: String(role.selectedActor.name || "").trim(),
          avatar: String(role.selectedActor.avatar || "").trim()
        }
      : null
  };
}

function mapProjectRecordToCatalogItem(record) {
  return {
    id: record.id,
    title: record.title,
    genre: record.genre || "",
    poster: record.poster || "",
    banner: record.banner || record.poster || "",
    promoVideoUrl: record.promo_video_url || "",
    countdownDate: record.countdown_date,
    description: record.description || "",
    director: record.director || "",
    ageRange: record.age_range || "",
    roles: Array.isArray(record.roles) ? record.roles : [],
    isPublished: record.is_published !== false,
    updatedAt: record.updated_at || record.created_at || null,
    createdAt: record.created_at || null
  };
}

function slugifyProjectId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яёіїңғүұқөһ]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "project";
}

async function loadAiSettings(env) {
  try {
    const rows = await fetchSupabaseRows(env, "ai_settings", {
      limit: 1,
      filters: { id: "default" }
    });
    if (rows.length) {
      return mapAiSettingsRecord(rows[0]);
    }
  } catch {
    // fallback to defaults when Supabase or table is unavailable
  }

  return getDefaultAiSettings(env);
}

function getDefaultAiSettings(env) {
  return {
    id: "default",
    publicBrand: env.PUBLIC_BRAND || "Meyram Cinema",
    assistantBrand: env.ASSISTANT_BRAND || "Meyram AI",
    faqAge: STATIC_FAQ.age,
    faqProcess: STATIC_FAQ.process,
    faqGeneric: STATIC_FAQ.generic,
    systemPromptOverride: ""
  };
}

function sanitizeAiSettingsInput(settings) {
  return {
    id: "default",
    public_brand: String(settings.publicBrand || settings.public_brand || "Meyram Cinema").trim() || "Meyram Cinema",
    assistant_brand: String(settings.assistantBrand || settings.assistant_brand || "Meyram AI").trim() || "Meyram AI",
    faq_age: String(settings.faqAge || settings.faq_age || STATIC_FAQ.age).trim() || STATIC_FAQ.age,
    faq_process: String(settings.faqProcess || settings.faq_process || STATIC_FAQ.process).trim() || STATIC_FAQ.process,
    faq_generic: String(settings.faqGeneric || settings.faq_generic || STATIC_FAQ.generic).trim() || STATIC_FAQ.generic,
    system_prompt_override: String(settings.systemPromptOverride || settings.system_prompt_override || "").trim() || null,
    updated_at: new Date().toISOString()
  };
}

function mapAiSettingsRecord(record) {
  const fallback = getDefaultAiSettings({});
  return {
    id: String(record?.id || fallback.id),
    publicBrand: String(record?.public_brand || fallback.publicBrand),
    assistantBrand: String(record?.assistant_brand || fallback.assistantBrand),
    faqAge: String(record?.faq_age || fallback.faqAge),
    faqProcess: String(record?.faq_process || fallback.faqProcess),
    faqGeneric: String(record?.faq_generic || fallback.faqGeneric),
    systemPromptOverride: String(record?.system_prompt_override || "")
  };
}
