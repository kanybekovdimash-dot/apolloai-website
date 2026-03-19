/**
 * Video recording overlay — record up to 2 min video and save to the casting backend.
 */

var MAX_RECORD_SEC = 120;
var videoRecState = null;

function createVideoRecordOverlay() {
    if (document.getElementById("videoRecOverlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "videoRecOverlay";
    overlay.className = "casting-overlay";
    overlay.innerHTML =
        '<div class="casting-overlay__header">' +
            '<h2>Видео визитка</h2>' +
            '<button class="casting-overlay__close" id="videoRecClose" type="button" aria-label="Жабу">&times;</button>' +
        '</div>' +
        '<div class="casting-overlay__body">' +
            '<div class="casting-overlay__video-wrap">' +
                '<video id="videoRecPreview" autoplay playsinline muted></video>' +
                '<video id="videoRecPlayback" playsinline hidden></video>' +
            '</div>' +
            '<div class="casting-overlay__panel">' +
                '<p class="casting-overlay__emotion-label" id="videoRecStatus">Дайын</p>' +
                '<p class="casting-overlay__emotion-desc" id="videoRecDesc">Өзіңіз туралы қысқа видео жазыңыз (2 мин дейін)</p>' +
                '<div class="casting-overlay__meter">' +
                    '<div class="casting-overlay__meter-fill" id="videoRecProgress" style="width:0%;background:linear-gradient(90deg,#c8a264,#e0c080)"></div>' +
                    '<span class="casting-overlay__meter-text" id="videoRecTimer">0:00 / 2:00</span>' +
                '</div>' +
                '<div id="videoRecActions" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' +
                    '<button class="casting-overlay__start-btn" id="videoRecStartBtn" type="button" style="background:linear-gradient(135deg,#4caf50,#66bb6a)">Видеоны бастау</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
    document.getElementById("videoRecClose").addEventListener("click", closeVideoRecord);
    document.getElementById("videoRecStartBtn").addEventListener("click", toggleRecording);
}

function openVideoRecord() {
    createVideoRecordOverlay();
    var overlay = document.getElementById("videoRecOverlay");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
    }).then(function(stream) {
        videoRecState = {
            stream: stream,
            recorder: null,
            chunks: [],
            timer: null,
            elapsed: 0,
            recording: false,
            blob: null
        };

        var preview = document.getElementById("videoRecPreview");
        preview.srcObject = stream;
        preview.play();
    }).catch(function(err) {
        document.getElementById("videoRecStatus").textContent = "Камера қатесі";
        document.getElementById("videoRecDesc").textContent = err.message || "Камера мен микрофонға рұқсат беріңіз";
        document.getElementById("videoRecStartBtn").disabled = true;
    });
}

function closeVideoRecord() {
    if (videoRecState) {
        if (videoRecState.recorder && videoRecState.recording) {
            videoRecState.recorder.stop();
        }
        if (videoRecState.timer) {
            clearInterval(videoRecState.timer);
        }
        if (videoRecState.stream) {
            videoRecState.stream.getTracks().forEach(function(t) { t.stop(); });
        }
        videoRecState = null;
    }

    var overlay = document.getElementById("videoRecOverlay");
    if (overlay) {
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
        setTimeout(function() { overlay.remove(); }, 300);
    }
}

function toggleRecording() {
    if (!videoRecState) return;

    if (videoRecState.recording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function showCountdown(callback) {
    var videoWrap = document.querySelector(".casting-overlay__video-wrap");
    if (!videoWrap) { callback(); return; }

    if (!document.getElementById("countdownStyles")) {
        var style = document.createElement("style");
        style.id = "countdownStyles";
        style.textContent =
            "@keyframes cdPop{0%{transform:scale(0.78);opacity:0}20%{transform:scale(1.05);opacity:1}100%{transform:scale(1);opacity:1}}" +
            "@keyframes cdFade{0%{opacity:1}100%{opacity:0}}" +
            "@keyframes cdFlash{0%{opacity:0}20%{opacity:0.8}100%{opacity:0}}" +
            "@keyframes cdFlicker{0%{opacity:0.06}50%{opacity:0.11}100%{opacity:0.06}}";
        document.head.appendChild(style);
    }

    var cdOverlay = document.createElement("div");
    cdOverlay.id = "countdownOverlay";
    cdOverlay.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:100;overflow:hidden;background:radial-gradient(circle at center,#575757 0%,#1f1f1f 52%,#050505 100%);";

    var grain = document.createElement("div");
    grain.style.cssText = "position:absolute;inset:0;pointer-events:none;opacity:0.08;mix-blend-mode:screen;animation:cdFlicker 0.18s infinite;background:repeating-linear-gradient(0deg,rgba(255,255,255,0.04) 0,rgba(255,255,255,0.04) 2px,transparent 2px,transparent 4px),repeating-linear-gradient(90deg,rgba(255,255,255,0.03) 0,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 3px);";
    cdOverlay.appendChild(grain);

    var horizontal = document.createElement("div");
    horizontal.style.cssText = "position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(255,255,255,0.32);transform:translateY(-50%);";
    cdOverlay.appendChild(horizontal);

    var vertical = document.createElement("div");
    vertical.style.cssText = "position:absolute;top:0;bottom:0;left:50%;width:2px;background:rgba(255,255,255,0.32);transform:translateX(-50%);";
    cdOverlay.appendChild(vertical);

    ["74%", "52%", "32%"].forEach(function(size) {
        var ring = document.createElement("div");
        ring.style.cssText = "position:absolute;width:" + size + ";height:" + size + ";border-radius:50%;border:4px solid rgba(255,255,255,0.72);";
        cdOverlay.appendChild(ring);
    });

    var numBox = document.createElement("div");
    numBox.id = "countdownNum";
    numBox.style.cssText = "position:relative;z-index:2;font-size:min(34vw,168px);font-weight:900;color:#fff;font-family:'Arial Black',Arial,sans-serif;line-height:1;text-shadow:0 8px 30px rgba(0,0,0,0.5);opacity:0;";
    cdOverlay.appendChild(numBox);

    var flash = document.createElement("div");
    flash.id = "countdownFlash";
    flash.style.cssText = "position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5;";
    cdOverlay.appendChild(flash);

    videoWrap.style.position = "relative";
    videoWrap.appendChild(cdOverlay);

    function playTick(freq) {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = "square";
            gain.gain.value = 0.06;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) {}
    }

    var count = 3;

    function doCount() {
        if (count <= 0) {
            flash.style.animation = "cdFlash 0.36s ease-out forwards";
            playTick(1280);
            setTimeout(function() {
                cdOverlay.style.transition = "opacity 0.22s ease";
                cdOverlay.style.opacity = "0";
                setTimeout(function() {
                    if (cdOverlay.parentNode) {
                        cdOverlay.parentNode.removeChild(cdOverlay);
                    }
                    callback();
                }, 220);
            }, 180);
            return;
        }

        numBox.textContent = String(count);
        numBox.style.animation = "none";
        void numBox.offsetWidth;
        numBox.style.animation = "cdPop 0.16s ease-out forwards, cdFade 0.22s ease-in 0.72s forwards";
        playTick(count === 1 ? 1120 : 920);

        count -= 1;
        setTimeout(doCount, 1000);
    }

    doCount();
}

function startRecording() {
    if (!videoRecState || !videoRecState.stream) return;

    // Disable button during countdown
    var startBtn = document.getElementById("videoRecStartBtn");
    if (startBtn) startBtn.disabled = true;

    document.getElementById("videoRecStatus").textContent = "Дайындалыңыз!";
    document.getElementById("videoRecDesc").textContent = "";

    showCountdown(function() {
        actuallyStartRecording();
    });
}

function actuallyStartRecording() {
    if (!videoRecState || !videoRecState.stream) return;

    videoRecState.chunks = [];
    videoRecState.elapsed = 0;
    videoRecState.blob = null;

    var mimeType = "video/webm;codecs=vp8,opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
    }

    var options = mimeType ? { mimeType: mimeType } : {};
    var recorder = new MediaRecorder(videoRecState.stream, options);
    videoRecState.recorder = recorder;

    recorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
            videoRecState.chunks.push(e.data);
        }
    };

    recorder.onstop = function() {
        videoRecState.recording = false;
        if (videoRecState.timer) {
            clearInterval(videoRecState.timer);
            videoRecState.timer = null;
        }

        var blob = new Blob(videoRecState.chunks, { type: normalizeVideoMimeType(recorder.mimeType || "video/webm") });
        videoRecState.blob = blob;
        showPlayback(blob);
    };

    recorder.start(1000);
    videoRecState.recording = true;

    var startBtn = document.getElementById("videoRecStartBtn");
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = "Тоқтату";
        startBtn.style.background = "#f44336";
    }
    document.getElementById("videoRecStatus").textContent = "Жазылуда...";
    document.getElementById("videoRecDesc").textContent = "Өзіңіз туралы айтыңыз";

    // Recording pulse
    var dot = document.getElementById("videoRecStatus");
    dot.style.color = "#f44336";

    videoRecState.timer = setInterval(function() {
        videoRecState.elapsed++;
        updateRecordTimer();

        if (videoRecState.elapsed >= MAX_RECORD_SEC) {
            stopRecording();
        }
    }, 1000);

    updateRecordTimer();
}

function stopRecording() {
    if (!videoRecState || !videoRecState.recorder) return;
    videoRecState.recorder.stop();
    videoRecState.stream.getTracks().forEach(function(t) { t.stop(); });
}

function updateRecordTimer() {
    if (!videoRecState) return;
    var el = videoRecState.elapsed;
    var min = Math.floor(el / 60);
    var sec = el % 60;
    var total = "2:00";
    var current = min + ":" + (sec < 10 ? "0" : "") + sec;

    document.getElementById("videoRecTimer").textContent = current + " / " + total;
    var pct = Math.min(100, (el / MAX_RECORD_SEC) * 100);
    document.getElementById("videoRecProgress").style.width = pct + "%";
}

function showPlayback(blob) {
    var preview = document.getElementById("videoRecPreview");
    var playback = document.getElementById("videoRecPlayback");

    preview.hidden = true;
    playback.hidden = false;
    playback.src = URL.createObjectURL(blob);
    playback.controls = true;
    playback.style.width = "100%";
    playback.style.height = "100%";
    playback.style.objectFit = "cover";
    playback.play();

    document.getElementById("videoRecStatus").textContent = "Дайын!";
    document.getElementById("videoRecStatus").style.color = "#4caf50";
    document.getElementById("videoRecDesc").textContent = "Видеоны қарап шығыңыз";

    var sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    document.getElementById("videoRecTimer").textContent = "Өлшемі: " + sizeMB + " MB";

    var actions = document.getElementById("videoRecActions");
    actions.innerHTML =
        '<button class="casting-overlay__start-btn" id="videoRecRetry" type="button" style="background:#666">Қайта жазу</button>' +
        '<button class="casting-overlay__start-btn" id="videoRecSend" type="button">Жіберу</button>';

    document.getElementById("videoRecRetry").addEventListener("click", retryRecording);
    document.getElementById("videoRecSend").addEventListener("click", function() {
        sendVideoToCastingApi(blob);
    });
}

function retryRecording() {
    var playback = document.getElementById("videoRecPlayback");
    var preview = document.getElementById("videoRecPreview");

    if (playback.src) {
        URL.revokeObjectURL(playback.src);
    }
    playback.hidden = true;
    preview.hidden = false;

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
    }).then(function(stream) {
        videoRecState.stream = stream;
        videoRecState.chunks = [];
        videoRecState.blob = null;
        preview.srcObject = stream;
        preview.play();

        document.getElementById("videoRecStatus").textContent = "Дайын";
        document.getElementById("videoRecStatus").style.color = "#ffffff";
        document.getElementById("videoRecDesc").textContent = "Өзіңіз туралы қысқа видео жазыңыз";

        var actions = document.getElementById("videoRecActions");
        actions.innerHTML = '<button class="casting-overlay__start-btn" id="videoRecStartBtn" type="button" style="background:linear-gradient(135deg,#4caf50,#66bb6a)">Видеоны бастау</button>';
        document.getElementById("videoRecStartBtn").addEventListener("click", toggleRecording);

        document.getElementById("videoRecProgress").style.width = "0%";
        document.getElementById("videoRecTimer").textContent = "0:00 / 2:00";
    });
}

function resolveVideoUploadTargets() {
    var metaBase = (document.querySelector('meta[name="apollo-api-base"]') || {}).content || "";
    var targets = [
        (metaBase || "").replace(/\/$/, ""),
        "https://apolloai-meyram-api.kanybekovdimash.workers.dev"
    ];

    return targets.filter(Boolean).filter(function(target, index, array) {
        return array.indexOf(target) === index;
    });
}

function normalizeVideoMimeType(value) {
    var mimeType = String(value || "video/webm").split(";")[0].trim().toLowerCase();
    if (!mimeType || mimeType === "video/x-matroska") {
        return "video/webm";
    }
    return mimeType;
}

function createVideoUploadFormData(blob, sessionId) {
    var formData = new FormData();
    var safeType = normalizeVideoMimeType(blob && blob.type);
    var safeBlob = new Blob([blob], { type: safeType });
    formData.append("video", safeBlob, "video-vizitka-" + Date.now() + ".webm");
    formData.append("sessionId", sessionId);
    return formData;
}

async function sendVideoToCastingApi(blob) {
    var sendBtn = document.getElementById("videoRecSend");
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "Жіберілуде...";
    }

    document.getElementById("videoRecStatus").textContent = "Жүктелуде...";
    document.getElementById("videoRecStatus").style.color = "#ffffff";
    document.getElementById("videoRecDesc").textContent = "Видео кастинг тобына сақталуда";

    var targets = resolveVideoUploadTargets();
    var sessionId = "video-" + Date.now();
    var lastError = "Видеоны жіберу мүмкін болмады";

    for (var i = 0; i < targets.length; i++) {
        var endpoint = targets[i] + "/video";
        var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 45000) : null;

        try {
            var response = await fetch(endpoint, {
                method: "POST",
                mode: "cors",
                credentials: "omit",
                body: createVideoUploadFormData(blob, sessionId),
                signal: controller ? controller.signal : undefined
            });

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            var raw = await response.text();
            var data = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch (parseError) {
                    data = { error: raw };
                }
            }

            if (!response.ok) {
                throw new Error(data.error || data.message || ("HTTP " + response.status));
            }

            if (!data.ok) {
                throw new Error(data.error || data.message || "Жіберу қатесі");
            }

            document.getElementById("videoRecStatus").textContent = "Жіберілді!";
            document.getElementById("videoRecStatus").style.color = "#4caf50";
            document.getElementById("videoRecDesc").textContent = "Видео кастинг тобына сақталды. Рахмет!";

            var actions = document.getElementById("videoRecActions");
            actions.innerHTML = '<button class="casting-overlay__start-btn" id="videoRecDone" type="button">Жабу</button>';
            document.getElementById("videoRecDone").addEventListener("click", closeVideoRecord);
            return;
        } catch (err) {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (err && err.name === "AbortError") {
                lastError = "Сервер тым баяу жауап берді. Қайта жіберіп көріңіз.";
            } else if (err && /Failed to fetch/i.test(err.message || "")) {
                lastError = "Серверге қосылу мүмкін болмады. Интернетті немесе API байланысын тексеріңіз.";
            } else {
                lastError = (err && err.message) || lastError;
            }
        }
    }

    document.getElementById("videoRecStatus").textContent = "Қате!";
    document.getElementById("videoRecStatus").style.color = "#f44336";
    document.getElementById("videoRecDesc").textContent = lastError;

    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "Қайта жіберу";
    }
}

window.openVideoRecord = openVideoRecord;
window.closeVideoRecord = closeVideoRecord;
