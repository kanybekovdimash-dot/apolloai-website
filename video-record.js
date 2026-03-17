/**
 * Video recording overlay — record up to 2 min video and send to Telegram.
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

    // Inject styles once
    if (!document.getElementById("countdownStyles")) {
        var style = document.createElement("style");
        style.id = "countdownStyles";
        style.textContent =
            "@keyframes cdPulse{0%{transform:scale(0.6);opacity:0}30%{transform:scale(1.1);opacity:1}60%{transform:scale(0.95)}100%{transform:scale(1);opacity:1}}" +
            "@keyframes cdShrink{0%{transform:scale(1);opacity:1}100%{transform:scale(0.3);opacity:0}}" +
            "@keyframes cdVignette{0%{box-shadow:inset 0 0 80px rgba(0,0,0,0.8)}100%{box-shadow:inset 0 0 120px rgba(0,0,0,0.95)}}" +
            "@keyframes cdFlash{0%{opacity:1;background:#fff}100%{opacity:0;background:#fff}}" +
            "@keyframes cdSepiaFlicker{0%{opacity:0.04}50%{opacity:0.08}100%{opacity:0.04}}";
        document.head.appendChild(style);
    }

    var cdOverlay = document.createElement("div");
    cdOverlay.id = "countdownOverlay";
    cdOverlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:#1a1408;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100;overflow:hidden;animation:cdVignette 1s ease infinite alternate;";

    // Sepia grain overlay
    var grain = document.createElement("div");
    grain.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:overlay;animation:cdSepiaFlicker 0.3s infinite;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(139,119,80,0.03) 2px,rgba(139,119,80,0.03) 4px);";
    cdOverlay.appendChild(grain);

    // Film perforation holes (left + right)
    for (var side = 0; side < 2; side++) {
        for (var h = 0; h < 5; h++) {
            var hole = document.createElement("div");
            hole.style.cssText = "position:absolute;width:14px;height:20px;border-radius:3px;border:2px solid rgba(200,162,100,0.25);" +
                (side === 0 ? "left:6px;" : "right:6px;") +
                "top:" + (10 + h * 22) + "%;";
            cdOverlay.appendChild(hole);
        }
    }

    // Horizontal frame lines (top + bottom)
    var lineTop = document.createElement("div");
    lineTop.style.cssText = "position:absolute;top:15%;left:10%;right:10%;height:1px;background:rgba(200,162,100,0.2);";
    cdOverlay.appendChild(lineTop);
    var lineBot = document.createElement("div");
    lineBot.style.cssText = "position:absolute;bottom:15%;left:10%;right:10%;height:1px;background:rgba(200,162,100,0.2);";
    cdOverlay.appendChild(lineBot);

    // Number container
    var numBox = document.createElement("div");
    numBox.id = "countdownNum";
    numBox.style.cssText = "font-size:140px;font-weight:900;color:#c8a264;font-family:Georgia,'Times New Roman',serif;z-index:2;text-shadow:0 0 40px rgba(200,162,100,0.3),0 2px 8px rgba(0,0,0,0.5);line-height:1;opacity:0;";
    numBox.textContent = "3";
    cdOverlay.appendChild(numBox);

    // Small label below number
    var subText = document.createElement("div");
    subText.id = "countdownSub";
    subText.style.cssText = "font-size:14px;color:rgba(200,162,100,0.5);font-family:Georgia,serif;letter-spacing:4px;text-transform:uppercase;margin-top:12px;z-index:2;";
    subText.textContent = "MEYRAM CINEMA";
    cdOverlay.appendChild(subText);

    // Flash overlay (used at the end)
    var flash = document.createElement("div");
    flash.id = "countdownFlash";
    flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;pointer-events:none;z-index:10;";
    cdOverlay.appendChild(flash);

    videoWrap.style.position = "relative";
    videoWrap.appendChild(cdOverlay);

    // Beep sound
    function playBeep(freq, duration) {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = "sine";
            gain.gain.value = 0.12;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.stop(ctx.currentTime + duration);
        } catch(e) {}
    }

    var count = 3;

    function doCount() {
        var numEl = document.getElementById("countdownNum");
        if (!numEl) return;

        if (count <= 0) {
            // Film clapper flash
            var fl = document.getElementById("countdownFlash");
            if (fl) fl.style.animation = "cdFlash 0.4s ease-out forwards";
            playBeep(1200, 0.25);

            setTimeout(function() {
                cdOverlay.style.transition = "opacity 0.3s";
                cdOverlay.style.opacity = "0";
                setTimeout(function() {
                    if (cdOverlay.parentNode) cdOverlay.parentNode.removeChild(cdOverlay);
                    callback();
                }, 300);
            }, 350);
            return;
        }

        // Animate number: pop in then shrink out
        numEl.textContent = count;
        numEl.style.animation = "cdPulse 0.4s ease-out forwards";

        // Change sepia tone per count
        var colors = { 3: "#c8a264", 2: "#e0c080", 1: "#ff6b6b" };
        numEl.style.color = colors[count] || "#c8a264";
        numEl.style.textShadow = "0 0 40px " + (colors[count] || "#c8a264") + "40,0 2px 8px rgba(0,0,0,0.5)";

        playBeep(count === 1 ? 1000 : 800, 0.15);

        setTimeout(function() {
            if (numEl) numEl.style.animation = "cdShrink 0.3s ease-in forwards";
        }, 650);

        count--;
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

        var blob = new Blob(videoRecState.chunks, { type: recorder.mimeType || "video/webm" });
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
        sendVideoToTelegram(blob);
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

function sendVideoToTelegram(blob) {
    var sendBtn = document.getElementById("videoRecSend");
    sendBtn.disabled = true;
    sendBtn.textContent = "Жіберілуде...";

    document.getElementById("videoRecStatus").textContent = "Жүктелуде...";
    document.getElementById("videoRecDesc").textContent = "Видео менеджерге жіберілуде";

    var apiBase = (document.querySelector('meta[name="apollo-api-base"]') || {}).content || "";
    apiBase = apiBase.replace(/\/$/, "");

    var formData = new FormData();
    formData.append("video", blob, "video-vizitka-" + Date.now() + ".webm");
    formData.append("sessionId", "video-" + Date.now());

    fetch(apiBase + "/video", {
        method: "POST",
        body: formData
    }).then(function(res) {
        return res.json();
    }).then(function(data) {
        if (data.ok) {
            document.getElementById("videoRecStatus").textContent = "Жіберілді!";
            document.getElementById("videoRecStatus").style.color = "#4caf50";
            document.getElementById("videoRecDesc").textContent = "Видео менеджерге жетті. Рахмет!";

            var actions = document.getElementById("videoRecActions");
            actions.innerHTML = '<button class="casting-overlay__start-btn" id="videoRecDone" type="button">Жабу</button>';
            document.getElementById("videoRecDone").addEventListener("click", closeVideoRecord);
        } else {
            throw new Error(data.error || "Жіберу қатесі");
        }
    }).catch(function(err) {
        document.getElementById("videoRecStatus").textContent = "Қате!";
        document.getElementById("videoRecStatus").style.color = "#f44336";
        document.getElementById("videoRecDesc").textContent = err.message || "Видеоны жіберу мүмкін болмады";
        sendBtn.disabled = false;
        sendBtn.textContent = "Қайта жіберу";
    });
}

window.openVideoRecord = openVideoRecord;
window.closeVideoRecord = closeVideoRecord;
